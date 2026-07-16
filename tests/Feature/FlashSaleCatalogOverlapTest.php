<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\FlashSale;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sku;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FlashSaleCatalogOverlapTest extends TestCase
{
    use RefreshDatabase;

    public function test_overlapping_flash_sale_cannot_reuse_the_same_sku(): void
    {
        $admin = $this->staffWithRole('super_admin');
        [, $sku] = $this->productWithSkus('Shared SKU Product');
        $this->flashSaleWithItem($sku, 'Existing Sale');

        $this
            ->actingAs($admin)
            ->from('/admin/flash-sales/create')
            ->post('/admin/flash-sales', $this->payload('New Sale', $sku))
            ->assertRedirect('/admin/flash-sales/create')
            ->assertSessionHasErrors('items');

        $this->assertDatabaseCount('flash_sales', 1);
    }

    public function test_overlapping_flash_sale_cannot_reuse_the_same_product_with_another_sku(): void
    {
        $admin = $this->staffWithRole('super_admin');
        [, $firstSku, $secondSku] = $this->productWithSkus('Shared Product', 2);
        $this->flashSaleWithItem($firstSku, 'Existing Sale');

        $this
            ->actingAs($admin)
            ->from('/admin/flash-sales/create')
            ->post('/admin/flash-sales', $this->payload('New Sale', $secondSku))
            ->assertRedirect('/admin/flash-sales/create')
            ->assertSessionHasErrors('items');

        $this->assertDatabaseCount('flash_sales', 1);
    }

    public function test_overlapping_flash_sale_can_use_a_different_product(): void
    {
        $admin = $this->staffWithRole('super_admin');
        [, $firstSku] = $this->productWithSkus('First Product');
        [, $secondSku] = $this->productWithSkus('Second Product');
        $this->flashSaleWithItem($firstSku, 'Existing Sale');

        $this
            ->actingAs($admin)
            ->post('/admin/flash-sales', $this->payload('New Sale', $secondSku))
            ->assertRedirect(route('admin.flash-sales.index'));

        $this->assertDatabaseCount('flash_sales', 2);
    }

    private function payload(string $name, Sku $sku): array
    {
        return [
            'name' => $name,
            'starts_at' => '2026-07-16 10:00:00',
            'ends_at' => '2026-07-16 13:00:00',
            'is_active' => true,
            'items' => [
                [
                    'sku_id' => $sku->id,
                    'discount_type' => 'percentage',
                    'discount_value' => 10,
                    'quantity_limit' => null,
                ],
            ],
        ];
    }

    private function flashSaleWithItem(Sku $sku, string $name): FlashSale
    {
        $sale = FlashSale::query()->create([
            'name' => $name,
            'starts_at' => '2026-07-16 09:00:00',
            'ends_at' => '2026-07-16 12:00:00',
            'is_active' => true,
        ]);

        $sale->items()->create([
            'sku_id' => $sku->id,
            'discount_type' => 'percentage',
            'discount_value' => 20,
            'quantity_limit' => null,
            'sold_count' => 0,
        ]);

        return $sale;
    }

    /**
     * @return array{0: \App\Models\Product, 1: \App\Models\Sku, 2?: \App\Models\Sku}
     */
    private function productWithSkus(string $name, int $skuCount = 1): array
    {
        $category = Category::query()->firstOrCreate(
            ['slug' => 'flash-sale-test'],
            ['name' => 'Flash Sale Test', 'is_active' => true]
        );

        $product = Product::query()->create([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);

        $skus = collect(range(1, $skuCount))
            ->map(fn (int $index) => Sku::query()->create([
                'product_id' => $product->id,
                'sku_code' => 'FS-'.$index.'-'.uniqid(),
                'price' => 100,
                'stock_qty' => 10,
                'reserved_qty' => 0,
                'is_active' => true,
            ]))
            ->all();

        return [$product, ...$skus];
    }

    private function staffWithRole(string $roleName): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();
        $user = User::factory()->create([
            'role' => $roleName,
            'status' => 'active',
            'permissions' => [],
        ]);
        $user->roles()->sync([$role->id]);

        return $user->fresh();
    }
}
