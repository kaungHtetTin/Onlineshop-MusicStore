<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\FlashSale;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use App\Models\Sku;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class HomeFlashSaleEventsTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_homepage_returns_each_active_flash_sale_event(): void
    {
        Carbon::setTestNow('2026-07-16 11:00:00');

        $location = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        [, $morningSku] = $this->productWithStock('Morning Sale Product', $location);
        [, $lunchSku] = $this->productWithStock('Lunch Sale Product', $location);

        $this->flashSaleWithItem($lunchSku, 'Lunch Sale', '2026-07-16 09:00:00', '2026-07-16 13:00:00');
        $this->flashSaleWithItem($morningSku, 'Morning Sale', '2026-07-16 10:00:00', '2026-07-16 14:00:00');

        $this->get('/')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('User/Welcome')
                ->has('flashSaleEvents', 2)
                ->where('flashSaleEvents.0.name', 'Morning Sale')
                ->where('flashSaleEvents.0.products.0.name', 'Morning Sale Product')
                ->where('flashSaleEvents.1.name', 'Lunch Sale')
                ->where('flashSaleEvents.1.products.0.name', 'Lunch Sale Product')
            );
    }

    private function productWithStock(string $name, Location $location): array
    {
        $category = Category::query()->firstOrCreate(
            ['slug' => 'flash-sale-events'],
            ['name' => 'Flash Sale Events', 'is_active' => true]
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
            'sku_code' => 'HOME-FS-'.uniqid(),
            'price' => 100,
            'stock_qty' => 10,
            'reserved_qty' => 0,
            'is_active' => true,
        ]);

        InventoryBalance::query()->create([
            'location_id' => $location->id,
            'sku_id' => $sku->id,
            'on_hand_qty' => 10,
            'reserved_qty' => 0,
        ]);

        return [$product, $sku];
    }

    private function flashSaleWithItem(Sku $sku, string $name, string $startsAt, string $endsAt): FlashSale
    {
        $sale = FlashSale::query()->create([
            'name' => $name,
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
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
}
