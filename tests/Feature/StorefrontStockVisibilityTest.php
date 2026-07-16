<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use App\Models\Sku;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class StorefrontStockVisibilityTest extends TestCase
{
    use RefreshDatabase;

    public function test_product_index_shows_products_with_stock_in_any_active_warehouse(): void
    {
        $mainWarehouse = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $secondaryWarehouse = Location::query()->where('code', 'MAIN-STORE')->firstOrFail();

        $this->productWithStock('Available Guitar', $mainWarehouse, 5);
        $otherWarehouse = $this->productWithStock('Other Warehouse Guitar', $secondaryWarehouse, 3);
        $soldOut = $this->productWithStock('Sold Out Guitar', $mainWarehouse, 0);
        $this->productWithStock('Fully Reserved Guitar', $mainWarehouse, 5, 5);

        $this->get('/products')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('User/Products/Index')
                ->has('products.data', 2)
                ->where('products.data.0.name', 'Available Guitar')
                ->where('products.data.1.name', 'Other Warehouse Guitar')
                ->where('products.data.1.skus.0.available_qty', 3)
                ->has('products.data.0.skus', 1)
            );

        $this->get("/products/{$otherWarehouse->slug}")->assertOk();
        $this->get("/products/{$soldOut->slug}")->assertNotFound();
    }

    private function productWithStock(string $name, Location $location, int $onHand, int $reserved = 0): Product
    {
        $category = Category::query()->firstOrCreate(
            ['slug' => 'guitars'],
            ['name' => 'Guitars', 'is_active' => true]
        );

        $product = Product::query()->create([
            'category_id' => $category->id,
            'name' => $name,
            'slug' => str($name)->slug().'-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);

        $sku = Sku::query()->create([
            'product_id' => $product->id,
            'sku_code' => 'SKU-'.uniqid(),
            'price' => 100,
            'stock_qty' => 0,
            'reserved_qty' => 0,
            'is_active' => true,
        ]);

        InventoryBalance::query()->create([
            'location_id' => $location->id,
            'sku_id' => $sku->id,
            'on_hand_qty' => $onHand,
            'reserved_qty' => $reserved,
        ]);

        return $product;
    }
}
