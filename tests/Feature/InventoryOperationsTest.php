<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\FinancialEntry;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\ProductImage;
use App\Models\Location;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sku;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StockAdjustmentService;
use App\Services\Inventory\StockReceiptService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Database\Seeders\FinancialCategorySeeder;
use Tests\TestCase;

class InventoryOperationsTest extends TestCase
{
    use RefreshDatabase;

    public function test_receipt_posts_stock_cost_and_one_movement(): void
    {
        [$location, $sku, $actor] = $this->context();
        $service = app(StockReceiptService::class);
        $receipt = $service->createDraft($location, [[
            'sku_id' => $sku->id,
            'expected_quantity' => 8,
            'received_quantity' => 7,
            'unit_cost' => 42.50,
        ]], $actor, 'PO-100');

        $service->post($receipt, $actor);
        $service->post($receipt->fresh(), $actor);

        $this->assertSame('posted', $receipt->fresh()->status);
        $this->assertSame(7, InventoryBalance::query()->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertSame('42.50', $sku->fresh()->cost);
        $this->assertSame(1, InventoryMovement::query()->where('sku_id', $sku->id)->count());
        $this->assertDatabaseHas('financial_entries', [
            'type' => 'expense',
            'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'reference' => $receipt->receipt_number,
            'status' => 'approved',
            'amount' => 297.50,
        ]);
    }

    public function test_stock_receipt_finance_category_is_seeded_as_system_data(): void
    {
        $this->seed(FinancialCategorySeeder::class);

        $this->assertDatabaseHas('financial_categories', [
            'type' => 'expense',
            'value' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'label' => 'Stock receipts',
            'is_system' => true,
            'is_active' => true,
        ]);

        $this->assertContains(
            FinancialEntry::CATEGORY_STOCK_RECEIPT,
            collect(FinancialEntry::categoryOptions()['expense'])->pluck('value')->all()
        );
    }

    public function test_stock_receipt_finance_entries_cannot_be_changed_from_finance_ledger(): void
    {
        [$location, $sku, $actor] = $this->context();
        $receiptService = app(StockReceiptService::class);
        $receipt = $receiptService->createDraft($location, [[
            'sku_id' => $sku->id,
            'received_quantity' => 2,
            'unit_cost' => 25,
        ]], $actor);
        $receiptService->post($receipt, $actor);

        $entry = FinancialEntry::query()
            ->where('category', FinancialEntry::CATEGORY_STOCK_RECEIPT)
            ->where('reference', $receipt->receipt_number)
            ->firstOrFail();

        $this->actingAs($actor)
            ->get('/admin/finance')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('entries.data.0.is_stock_receipt_entry', true));

        $this->actingAs($actor)
            ->from('/admin/finance')
            ->patch("/admin/finance/entries/{$entry->id}", [
                'type' => 'expense',
                'category' => 'inventory',
                'title' => 'Changed by finance',
                'amount' => 999,
                'entry_date' => now()->toDateString(),
                'status' => 'approved',
            ])
            ->assertRedirect('/admin/finance')
            ->assertSessionHas('error');

        $this->assertDatabaseHas('financial_entries', [
            'id' => $entry->id,
            'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'reference' => $receipt->receipt_number,
            'title' => $entry->title,
            'amount' => 50,
        ]);

        $this->actingAs($actor)
            ->from('/admin/finance')
            ->delete("/admin/finance/entries/{$entry->id}")
            ->assertRedirect('/admin/finance')
            ->assertSessionHas('error');

        $this->assertDatabaseHas('financial_entries', [
            'id' => $entry->id,
            'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'reference' => $receipt->receipt_number,
        ]);
    }

    public function test_receipt_create_can_update_sku_prices(): void
    {
        [$location, $sku, $actor] = $this->context();

        $this->actingAs($actor)->post('/admin/inventory/receipts', [
            'location_id' => $location->id,
            'supplier_reference' => 'PO-PRICE-1',
            'items' => [[
                'sku_id' => $sku->id,
                'expected_quantity' => 3,
                'received_quantity' => 3,
                'unit_cost' => 150,
                'wholesale_price' => 95,
                'retail_price' => 120,
            ]],
        ])->assertRedirect();

        $sku->refresh();
        $this->assertSame('150.00', $sku->cost);
        $this->assertSame('150.00', $sku->market_price);
        $this->assertSame('95.00', $sku->wholesale_price);
        $this->assertSame('120.00', $sku->price);
    }

    public function test_draft_receipt_can_be_edited_before_posting(): void
    {
        [$location, $sku, $actor] = $this->context();
        $replacementSku = Sku::create([
            'product_id' => $sku->product_id,
            'sku_code' => 'SKU-EDIT-'.uniqid(),
            'price' => 90,
            'cost' => 30,
            'stock_qty' => 0,
            'is_active' => true,
        ]);

        $receipt = app(StockReceiptService::class)->createDraft($location, [[
            'sku_id' => $sku->id,
            'received_quantity' => 2,
            'unit_cost' => 20,
        ]], $actor, 'PO-OLD');

        $this->actingAs($actor)->put("/admin/inventory/receipts/{$receipt->id}", [
            'location_id' => $location->id,
            'supplier_reference' => 'PO-UPDATED',
            'notes' => 'Edited draft',
            'items' => [[
                'sku_id' => $replacementSku->id,
                'received_quantity' => 5,
                'unit_cost' => 44,
                'retail_price' => 110,
            ]],
        ])->assertRedirect(route('admin.inventory.receipts.show', $receipt));

        $receipt->refresh();
        $this->assertSame('draft', $receipt->status);
        $this->assertSame('PO-UPDATED', $receipt->supplier_reference);
        $this->assertSame('Edited draft', $receipt->notes);
        $this->assertSame(1, $receipt->items()->count());
        $this->assertDatabaseHas('stock_receipt_items', [
            'stock_receipt_id' => $receipt->id,
            'sku_id' => $replacementSku->id,
            'received_quantity' => 5,
            'unit_cost' => 44,
        ]);
        $this->assertDatabaseMissing('stock_receipt_items', [
            'stock_receipt_id' => $receipt->id,
            'sku_id' => $sku->id,
        ]);
        $this->assertSame(0, InventoryMovement::query()->where('reference_id', $receipt->id)->count());
        $this->assertSame('44.00', $replacementSku->fresh()->cost);
        $this->assertSame('110.00', $replacementSku->fresh()->price);
    }

    public function test_adjustment_posts_immediately_and_records_before_after_quantities(): void
    {
        [$location, $sku, $actor] = $this->context();
        app(InventoryService::class)->receive($location, $sku, 20, $actor, 'adjustment-stock');
        $service = app(StockAdjustmentService::class);
        $adjustment = $service->createPosted($location, [[
            'sku_id' => $sku->id,
            'counted_quantity' => 5,
            'notes' => 'Damaged during storage.',
        ]], 'damage', $actor);

        $line = $adjustment->items->first();
        $this->assertSame('posted', $adjustment->status);
        $this->assertFalse($adjustment->requires_approval);
        $this->assertSame(20, $line->system_quantity);
        $this->assertSame(5, $line->counted_quantity);
        $this->assertSame(-15, $line->quantity_delta);
        $this->assertNotNull($line->movement_id);
        $this->assertDatabaseCount('notifications', 0);
        $this->assertSame(5, InventoryBalance::query()->where('sku_id', $sku->id)->value('on_hand_qty'));
    }

    public function test_adjustment_create_route_updates_stock_and_redirects_to_records(): void
    {
        [$location, $sku, $actor] = $this->context();
        app(InventoryService::class)->receive($location, $sku, 5, $actor, 'adjust-route-start');

        $this->actingAs($actor)
            ->post('/admin/inventory/adjustments', [
                'location_id' => $location->id,
                'reason_code' => 'physical_count',
                'items' => [[
                    'sku_id' => $sku->id,
                    'counted_quantity' => 7,
                ]],
            ])
            ->assertRedirect(route('admin.inventory.adjustments.index'));

        $this->assertSame(7, InventoryBalance::query()->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertDatabaseHas('stock_adjustment_items', [
            'sku_id' => $sku->id,
            'system_quantity' => 5,
            'counted_quantity' => 7,
            'quantity_delta' => 2,
        ]);
    }

    public function test_posted_receipt_can_be_deleted_and_removes_stock_and_finance_entry(): void
    {
        [$location, $sku, $actor] = $this->context();
        $receiptService = app(StockReceiptService::class);
        $receipt = $receiptService->createDraft($location, [[
            'sku_id' => $sku->id,
            'received_quantity' => 7,
            'unit_cost' => 12,
        ]], $actor);
        $receiptService->post($receipt, $actor);

        $this->assertSame(7, InventoryBalance::query()->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertDatabaseHas('financial_entries', [
            'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'reference' => $receipt->receipt_number,
            'amount' => 84,
        ]);

        $this->actingAs($actor)
            ->delete("/admin/inventory/receipts/{$receipt->id}")
            ->assertRedirect(route('admin.inventory.receipts.index'));

        $this->assertDatabaseMissing('stock_receipts', ['id' => $receipt->id]);
        $this->assertDatabaseMissing('financial_entries', [
            'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
            'reference' => $receipt->receipt_number,
        ]);
        $this->assertSame(0, InventoryBalance::query()->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertSame(2, InventoryMovement::query()->where('sku_id', $sku->id)->count());
        $this->assertDatabaseHas('inventory_movements', [
            'sku_id' => $sku->id,
            'type' => 'adjustment_loss',
            'quantity_delta' => -7,
            'reason_code' => 'receipt_delete',
        ]);
    }

    public function test_adjustment_record_index_shows_line_level_before_and_after_quantities(): void
    {
        [$location, $sku, $actor] = $this->context();
        app(InventoryService::class)->receive($location, $sku, 10, $actor, 'adjustment-index-base');
        $service = app(StockAdjustmentService::class);
        $adjustment = $service->createPosted($location, [[
            'sku_id' => $sku->id,
            'counted_quantity' => 12,
        ]], 'physical_count', $actor);

        $this->actingAs($actor)
            ->get('/admin/inventory/adjustments')
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Inventory/Adjustments/Index')
                ->where('adjustments.data.0.id', $adjustment->id)
                ->where('adjustments.data.0.items.0.system_quantity', 10)
                ->where('adjustments.data.0.items.0.counted_quantity', 12)
                ->where('adjustments.data.0.items.0.quantity_delta', 2)
            );
    }

    public function test_product_creation_ignores_direct_stock_and_initializes_default_balance(): void
    {
        $actor = $this->staffWithRole('super_admin');
        $category = Category::create(['name' => 'Keys', 'slug' => 'keys', 'is_active' => true]);

        $this->actingAs($actor)->post('/admin/products', [
            'category_id' => $category->id,
            'name' => 'Stage Piano',
            'description' => '',
            'status' => 'active',
            'is_featured' => false,
            'skus' => [[
                'sku_code' => 'PIANO-1',
                'barcode' => '100200300',
                'price' => 800,
                'market_price' => 900,
                'wholesale_price' => 700,
                'cost' => 600,
                'stock_qty' => 99,
                'is_active' => true,
                'attributes' => [],
            ]],
        ])->assertRedirect();

        $sku = Sku::query()->where('sku_code', 'PIANO-1')->firstOrFail();
        $this->assertSame(0, $sku->stock_qty);
        $this->assertDatabaseHas('inventory_balances', [
            'location_id' => Location::query()->where('code', 'MAIN-WH')->value('id'),
            'sku_id' => $sku->id,
            'on_hand_qty' => 0,
        ]);
    }

    public function test_stock_overview_lists_variants_without_balance_rows_with_pagination(): void
    {
        $actor = $this->staffWithRole('inventory_staff');
        $warehouse = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $actor->locations()->sync([$warehouse->id => ['is_default' => true]]);
        $category = Category::create(['name' => 'Overview', 'slug' => 'overview-'.uniqid(), 'is_active' => true]);
        $otherCategory = Category::create(['name' => 'Other Overview', 'slug' => 'other-overview-'.uniqid(), 'is_active' => true]);

        for ($i = 1; $i <= 31; $i++) {
            $product = Product::create([
                'category_id' => $category->id,
                'name' => sprintf('Overview Product %02d', $i),
                'slug' => 'overview-product-'.$i.'-'.uniqid(),
                'status' => 'active',
                'is_active' => true,
            ]);
            if ($i === 1) {
                ProductImage::create([
                    'product_id' => $product->id,
                    'image_path' => 'products/overview-product-01.jpg',
                    'is_primary' => true,
                ]);
            }
            Sku::create([
                'product_id' => $product->id,
                'sku_code' => sprintf('OVR-%02d', $i),
                'price' => 100,
                'stock_qty' => 0,
                'is_active' => true,
            ]);
        }
        $otherProduct = Product::create([
            'category_id' => $otherCategory->id,
            'name' => 'Z Other Overview Product',
            'slug' => 'other-overview-product-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);
        Sku::create([
            'product_id' => $otherProduct->id,
            'sku_code' => 'OTHER-OVR-01',
            'price' => 100,
            'stock_qty' => 0,
            'is_active' => true,
        ]);

        $this->actingAs($actor)
            ->get('/admin/inventory')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Inventory/Index')
                ->where('balances.total', 32)
                ->where('balances.per_page', 30)
                ->has('categories', 2)
                ->has('balances.data', 30)
                ->where('balances.data.0.sku.sku_code', 'OVR-01')
                ->where('balances.data.0.sku.image_path', 'products/overview-product-01.jpg')
                ->where('balances.data.0.location.name', 'All warehouses')
                ->where('balances.data.0.location.code', 'ALL')
                ->where('balances.data.0.on_hand_qty', 0));

        $admin = $this->staffWithRole('super_admin');
        $this->actingAs($admin)
            ->get('/admin/inventory?location=all')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.location', 'all')
                ->where('balances.total', 32)
                ->where('balances.data.0.location.name', 'All warehouses'));

        $this->actingAs($admin)
            ->get('/admin/inventory?location='.$warehouse->id)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.location', (string) $warehouse->id)
                ->where('balances.total', 32)
                ->where('balances.data.0.location.code', 'MAIN-WH'));

        $this->actingAs($admin)
            ->get('/admin/inventory?category='.$category->id)
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('filters.category', (string) $category->id)
                ->where('balances.total', 31));
    }

    private function context(): array
    {
        $category = Category::create(['name' => 'Category', 'slug' => 'category-'.uniqid(), 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Test Product',
            'slug' => 'test-product-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);
        $sku = Sku::create([
            'product_id' => $product->id,
            'sku_code' => 'SKU-'.uniqid(),
            'price' => 100,
            'cost' => 20,
            'stock_qty' => 0,
            'is_active' => true,
        ]);
        $actor = $this->staffWithRole('super_admin');

        return [Location::query()->where('code', 'MAIN-WH')->firstOrFail(), $sku, $actor];
    }

    private function staffWithRole(string $roleName): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();
        $user = User::factory()->create(['role' => $roleName, 'status' => 'active', 'permissions' => []]);
        $user->roles()->sync([$role->id]);
        $user->locations()->sync(Location::query()->pluck('id')->mapWithKeys(fn ($id) => [$id => ['is_default' => false]])->all());
        return $user->fresh();
    }
}
