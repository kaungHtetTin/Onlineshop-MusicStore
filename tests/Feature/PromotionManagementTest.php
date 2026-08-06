<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Coupon;
use App\Models\FlashSale;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sku;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class PromotionManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_percentage_coupon_cannot_exceed_one_hundred_percent(): void
    {
        $this->actingAs($this->admin())
            ->from('/admin/coupons')
            ->post('/admin/coupons', $this->couponPayload(['value' => 150]))
            ->assertRedirect('/admin/coupons')
            ->assertSessionHasErrors('value');

        $this->assertDatabaseCount('coupons', 0);
    }

    public function test_date_only_coupon_expiry_is_normalized_to_end_of_day(): void
    {
        $this->actingAs($this->admin())
            ->post('/admin/coupons', $this->couponPayload([
                'starts_at' => '2026-08-10',
                'expires_at' => '2026-08-10',
            ]))
            ->assertSessionHasNoErrors();

        $coupon = Coupon::query()->firstOrFail();
        $this->assertSame('2026-08-10 00:00:00', $coupon->starts_at->format('Y-m-d H:i:s'));
        $this->assertSame('2026-08-10 23:59:59', $coupon->expires_at->format('Y-m-d H:i:s'));
    }

    public function test_coupon_status_reflects_effective_availability(): void
    {
        Carbon::setTestNow('2026-08-06 12:00:00');

        $active = Coupon::create($this->couponPayload(['code' => 'ACTIVE']));
        $scheduled = Coupon::create($this->couponPayload(['code' => 'SCHEDULED', 'starts_at' => '2026-08-07 00:00:00']));
        $expired = Coupon::create($this->couponPayload(['code' => 'EXPIRED', 'expires_at' => '2026-08-05 23:59:59']));
        $exhausted = Coupon::create($this->couponPayload(['code' => 'EXHAUSTED', 'usage_limit' => 2, 'used_count' => 2]));
        $inactive = Coupon::create($this->couponPayload(['code' => 'INACTIVE', 'is_active' => false]));

        $this->assertSame('active', $active->status);
        $this->assertSame('scheduled', $scheduled->status);
        $this->assertSame('expired', $expired->status);
        $this->assertSame('exhausted', $exhausted->status);
        $this->assertSame('inactive', $inactive->status);
    }

    public function test_flash_sale_iso_times_are_stored_as_the_supplied_utc_instants(): void
    {
        $sku = $this->sku();

        $this->actingAs($this->admin())
            ->post('/admin/flash-sales', $this->flashPayload($sku, [
                'starts_at' => '2026-08-10T03:30:00.000Z',
                'ends_at' => '2026-08-10T05:30:00.000Z',
            ]))
            ->assertSessionHasNoErrors();

        $sale = FlashSale::query()->firstOrFail();
        $this->assertSame('2026-08-10T03:30:00+00:00', $sale->starts_at->toIso8601String());
        $this->assertSame('2026-08-10T05:30:00+00:00', $sale->ends_at->toIso8601String());
    }

    public function test_flash_sale_detail_page_includes_item_pricing_and_availability(): void
    {
        [$sale, $item] = $this->saleWithItem(3);

        $this->actingAs($this->admin())
            ->withHeader('X-SPA', 'true')
            ->get("/admin/flash-sales/{$sale->id}")
            ->assertOk()
            ->assertJsonPath('component', 'Admin/FlashSales/Show')
            ->assertJsonPath('props.flashSale.id', $sale->id)
            ->assertJsonPath('props.flashSale.items.0.id', $item->id)
            ->assertJsonPath('props.flashSale.items.0.sold_count', 3)
            ->assertJsonPath('props.flashSale.items.0.remaining_quantity', 7);
    }

    public function test_deleting_flash_sale_with_sales_history_deactivates_and_preserves_it(): void
    {
        [$sale, $item] = $this->saleWithItem(3);

        $this->actingAs($this->admin())
            ->delete("/admin/flash-sales/{$sale->id}")
            ->assertSessionHasNoErrors();

        $this->assertDatabaseHas('flash_sales', ['id' => $sale->id, 'is_active' => false]);
        $this->assertDatabaseHas('flash_sale_items', ['id' => $item->id, 'sold_count' => 3]);
    }

    public function test_sold_flash_sale_item_cannot_be_removed_or_repriced(): void
    {
        [$sale, $item] = $this->saleWithItem(2);
        $replacementSku = $this->sku();
        $base = $this->flashPayload($item->sku, [
            'name' => $sale->name,
            'starts_at' => $sale->starts_at->toIso8601String(),
            'ends_at' => $sale->ends_at->toIso8601String(),
        ]);

        $withoutSoldItem = $this->flashPayload($replacementSku, [
            'name' => $sale->name,
            'starts_at' => $sale->starts_at->toIso8601String(),
            'ends_at' => $sale->ends_at->toIso8601String(),
        ]);

        $this->actingAs($this->admin())
            ->from("/admin/flash-sales/{$sale->id}/edit")
            ->patch("/admin/flash-sales/{$sale->id}", $withoutSoldItem)
            ->assertSessionHasErrors('items');

        $repriced = $base;
        $repriced['items'][0]['discount_value'] = 35;
        $this->actingAs($this->admin())
            ->from("/admin/flash-sales/{$sale->id}/edit")
            ->patch("/admin/flash-sales/{$sale->id}", $repriced)
            ->assertSessionHasErrors('items.0.discount_value');

        $this->assertDatabaseHas('flash_sale_items', [
            'id' => $item->id,
            'discount_value' => 20,
            'sold_count' => 2,
        ]);
    }

    private function couponPayload(array $overrides = []): array
    {
        return array_merge([
            'code' => 'SAVE10',
            'type' => 'percentage',
            'value' => 10,
            'min_order_amount' => 0,
            'starts_at' => null,
            'expires_at' => null,
            'usage_limit' => null,
            'used_count' => 0,
            'is_active' => true,
        ], $overrides);
    }

    private function flashPayload(Sku $sku, array $overrides = []): array
    {
        return array_merge([
            'name' => 'Myanmar Morning Sale',
            'starts_at' => '2026-08-10T03:30:00.000Z',
            'ends_at' => '2026-08-10T05:30:00.000Z',
            'is_active' => true,
            'items' => [[
                'sku_id' => $sku->id,
                'discount_type' => 'percentage',
                'discount_value' => 20,
                'quantity_limit' => null,
            ]],
        ], $overrides);
    }

    /** @return array{0: FlashSale, 1: \App\Models\FlashSaleItem} */
    private function saleWithItem(int $soldCount): array
    {
        $sku = $this->sku();
        $sale = FlashSale::create([
            'name' => 'Sale with History',
            'starts_at' => '2026-08-10 03:30:00',
            'ends_at' => '2026-08-10 05:30:00',
            'is_active' => true,
        ]);
        $item = $sale->items()->create([
            'sku_id' => $sku->id,
            'discount_type' => 'percentage',
            'discount_value' => 20,
            'quantity_limit' => 10,
            'sold_count' => $soldCount,
        ]);

        return [$sale, $item];
    }

    private function sku(): Sku
    {
        $category = Category::query()->firstOrCreate(
            ['slug' => 'promotion-management'],
            ['name' => 'Promotion Management', 'is_active' => true]
        );
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Promotion Product '.uniqid(),
            'slug' => 'promotion-product-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);

        return Sku::create([
            'product_id' => $product->id,
            'sku_code' => 'PROMO-'.uniqid(),
            'price' => 100,
            'stock_qty' => 20,
            'reserved_qty' => 0,
            'is_active' => true,
        ]);
    }

    private function admin(): User
    {
        $role = Role::query()->where('name', 'super_admin')->firstOrFail();
        $admin = User::factory()->create([
            'role' => 'super_admin',
            'status' => 'active',
            'permissions' => [],
        ]);
        $admin->roles()->sync([$role->id]);

        return $admin->fresh();
    }
}
