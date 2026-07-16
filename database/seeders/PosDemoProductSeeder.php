<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\PosRegister;
use App\Models\Product;
use App\Models\Sku;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class PosDemoProductSeeder extends Seeder
{
    public function run(): void
    {
        $warehouse = Location::query()->updateOrCreate(
            ['code' => 'MAIN-WH'],
            [
                'name' => 'Main Warehouse',
                'type' => 'warehouse',
                'timezone' => 'Asia/Yangon',
                'is_active' => true,
                'is_default_fulfillment' => true,
                'is_system' => true,
            ],
        );

        $store = Location::query()->updateOrCreate(
            ['code' => 'MAIN-STORE'],
            [
                'name' => 'Main Store',
                'type' => 'warehouse',
                'timezone' => 'Asia/Yangon',
                'is_active' => true,
                'is_default_fulfillment' => false,
                'is_system' => true,
            ],
        );

        PosRegister::query()->updateOrCreate(
            ['code' => 'POS-01'],
            [
                'location_id' => $store->id,
                'name' => 'Front Counter POS',
                'is_active' => true,
            ],
        );

        PosRegister::query()->updateOrCreate(
            ['code' => 'WH-POS-01'],
            [
                'location_id' => $warehouse->id,
                'name' => 'Warehouse Test POS',
                'is_active' => true,
            ],
        );

        $categories = collect([
            ['name' => 'Guitars', 'icon' => 'guitar', 'sort_order' => 10],
            ['name' => 'Keyboards', 'icon' => 'piano', 'sort_order' => 20],
            ['name' => 'Drums', 'icon' => 'drum', 'sort_order' => 30],
            ['name' => 'Accessories', 'icon' => 'cable', 'sort_order' => 40],
        ])->mapWithKeys(function (array $category) {
            $model = Category::query()->updateOrCreate(
                ['slug' => Str::slug($category['name'])],
                [
                    'name' => $category['name'],
                    'icon' => $category['icon'],
                    'description' => "Demo {$category['name']} for POS testing.",
                    'is_active' => true,
                    'sort_order' => $category['sort_order'],
                    'metadata' => ['homepage_featured' => true],
                ],
            );

            return [$category['name'] => $model];
        });

        $products = [
            [
                'category' => 'Guitars',
                'name' => 'Aquila Classic Acoustic Guitar',
                'description' => 'Warm full-size acoustic guitar for beginners and small stages.',
                'skus' => [
                    ['code' => 'GTR-AQU-NA', 'barcode' => '899100100001', 'title' => 'Natural', 'price' => 185000, 'wholesale' => 160000, 'cost' => 125000, 'warehouse' => 18, 'store' => 6],
                    ['code' => 'GTR-AQU-BK', 'barcode' => '899100100002', 'title' => 'Black', 'price' => 195000, 'wholesale' => 168000, 'cost' => 132000, 'warehouse' => 12, 'store' => 4],
                ],
            ],
            [
                'category' => 'Guitars',
                'name' => 'StagePro Electric Guitar',
                'description' => 'Solid-body electric guitar with dual humbuckers.',
                'skus' => [
                    ['code' => 'GTR-STP-RD', 'barcode' => '899100100003', 'title' => 'Red Burst', 'price' => 420000, 'wholesale' => 375000, 'cost' => 310000, 'warehouse' => 7, 'store' => 2],
                ],
            ],
            [
                'category' => 'Keyboards',
                'name' => 'Melody 61-Key Portable Keyboard',
                'description' => 'Lightweight keyboard with built-in speakers and practice modes.',
                'skus' => [
                    ['code' => 'KEY-MEL-61', 'barcode' => '899100100004', 'title' => '61 Keys', 'price' => 260000, 'wholesale' => 228000, 'cost' => 180000, 'warehouse' => 10, 'store' => 3],
                ],
            ],
            [
                'category' => 'Drums',
                'name' => 'Pulse Compact Cajon',
                'description' => 'Portable cajon with bright snare response.',
                'skus' => [
                    ['code' => 'DRM-PLS-CJN', 'barcode' => '899100100005', 'title' => 'Natural Wood', 'price' => 95000, 'wholesale' => 82000, 'cost' => 61000, 'warehouse' => 16, 'store' => 5],
                ],
            ],
            [
                'category' => 'Accessories',
                'name' => 'RoadLine Instrument Cable',
                'description' => 'Durable low-noise cable for guitar, bass, and keyboard rigs.',
                'skus' => [
                    ['code' => 'ACC-CBL-10FT', 'barcode' => '899100100006', 'title' => '10 ft', 'price' => 18000, 'wholesale' => 14500, 'cost' => 9000, 'warehouse' => 80, 'store' => 25],
                    ['code' => 'ACC-CBL-20FT', 'barcode' => '899100100007', 'title' => '20 ft', 'price' => 28000, 'wholesale' => 23000, 'cost' => 15000, 'warehouse' => 55, 'store' => 18],
                ],
            ],
            [
                'category' => 'Accessories',
                'name' => 'Clip-On Chromatic Tuner',
                'description' => 'Fast clip-on tuner for guitar, ukulele, violin, and bass.',
                'skus' => [
                    ['code' => 'ACC-TUN-CLIP', 'barcode' => '899100100008', 'title' => 'Standard', 'price' => 22000, 'wholesale' => 17500, 'cost' => 11000, 'warehouse' => 65, 'store' => 20],
                ],
            ],
            [
                'category' => 'Accessories',
                'name' => 'Demo Out-of-Stock Guitar Strings',
                'description' => 'Out-of-stock demo item for testing POS disabled add buttons.',
                'skus' => [
                    ['code' => 'ACC-STR-OOS', 'barcode' => '899100100009', 'title' => 'Light Gauge', 'price' => 16000, 'wholesale' => 12500, 'cost' => 8000, 'warehouse' => 0, 'store' => 0],
                ],
            ],
        ];

        foreach ($products as $productData) {
            $product = Product::query()->updateOrCreate(
                ['slug' => Str::slug($productData['name'])],
                [
                    'category_id' => $categories[$productData['category']]->id,
                    'name' => $productData['name'],
                    'description' => $productData['description'],
                    'status' => 'active',
                    'is_active' => true,
                    'is_featured' => true,
                    'rating' => 4.50,
                    'review_count' => 12,
                    'metadata' => ['demo_pos_product' => true],
                ],
            );

            foreach ($productData['skus'] as $skuData) {
                $sku = Sku::query()->updateOrCreate(
                    ['sku_code' => $skuData['code']],
                    [
                        'product_id' => $product->id,
                        'barcode' => $skuData['barcode'],
                        'title' => $skuData['title'],
                        'price' => $skuData['price'],
                        'wholesale_price' => $skuData['wholesale'],
                        'market_price' => $skuData['price'],
                        'cost' => $skuData['cost'],
                        'stock_qty' => $skuData['warehouse'] + $skuData['store'],
                        'reserved_qty' => 0,
                        'is_active' => true,
                        'attributes' => ['demo' => true],
                    ],
                );

                $this->setBalance($warehouse, $sku, $skuData['warehouse']);
                $this->setBalance($store, $sku, $skuData['store']);
            }
        }
    }

    private function setBalance(Location $location, Sku $sku, int $quantity): void
    {
        InventoryBalance::query()->updateOrCreate(
            [
                'location_id' => $location->id,
                'sku_id' => $sku->id,
            ],
            [
                'on_hand_qty' => $quantity,
                'reserved_qty' => 0,
                'reorder_point' => max(2, min(10, (int) floor($quantity / 4))),
                'par_level' => max($quantity, 10),
                'version' => 1,
            ],
        );
    }
}
