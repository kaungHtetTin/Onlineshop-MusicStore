<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sku;
use App\Models\StockTransfer;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StockTransferService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class StockTransferTest extends TestCase
{
    use RefreshDatabase;

    public function test_transfer_immediately_moves_stock_between_warehouses(): void
    {
        [$sourceWarehouse, $destinationWarehouse, $sku, $actor] = $this->context();
        app(InventoryService::class)->receive($sourceWarehouse, $sku, 20, $actor, 'transfer-seed');

        $service = app(StockTransferService::class);
        $transfer = $service->transferNow($sourceWarehouse, $destinationWarehouse, [[
            'sku_id' => $sku->id,
            'requested_quantity' => 8,
        ]], $actor);

        $this->assertSame('received', $transfer->fresh()->status);
        $this->assertSame(12, InventoryBalance::query()->where('location_id', $sourceWarehouse->id)->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertSame(8, InventoryBalance::query()->where('location_id', $destinationWarehouse->id)->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertSame(1, InventoryMovement::query()->where('type', 'transfer_out')->count());
        $this->assertSame(1, InventoryMovement::query()->where('type', 'transfer_in')->count());
        $this->assertSame(8, $transfer->items()->value('shipped_quantity'));
        $this->assertSame(8, $transfer->items()->value('received_quantity'));
    }

    public function test_transfer_cannot_post_without_available_stock(): void
    {
        [$warehouse, $store, $sku, $actor] = $this->context();
        app(InventoryService::class)->receive($warehouse, $sku, 5, $actor, 'ship-guard-seed');
        app(InventoryService::class)->completeSale($warehouse, $sku, 5, 0, $actor, 'ship-guard-consume');

        $this->expectException(ValidationException::class);
        app(StockTransferService::class)->transferNow($warehouse, $store, [[
            'sku_id' => $sku->id,
            'requested_quantity' => 3,
        ]], $actor);
    }

    public function test_transfer_index_requires_transfer_permission(): void
    {
        $user = $this->staffWithRole('sales');
        $this->actingAs($user)->get('/admin/inventory/transfers')->assertForbidden();
    }

    public function test_manager_can_view_transfer_index(): void
    {
        $user = $this->staffWithRole('manager');
        $this->actingAs($user)->get('/admin/inventory/transfers')->assertOk();
    }

    private function context(): array
    {
        $category = Category::create(['name' => 'Category', 'slug' => 'category-'.uniqid(), 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Transfer Product',
            'slug' => 'transfer-product-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);
        $sku = Sku::create([
            'product_id' => $product->id,
            'sku_code' => 'TRF-'.uniqid(),
            'price' => 100,
            'cost' => 20,
            'stock_qty' => 0,
            'is_active' => true,
        ]);
        $actor = $this->staffWithRole('super_admin');
        $warehouse = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $store = Location::query()->where('code', 'MAIN-STORE')->firstOrFail();

        return [$warehouse, $store, $sku, $actor];
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
