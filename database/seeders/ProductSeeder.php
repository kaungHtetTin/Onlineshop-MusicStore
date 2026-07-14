<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Sku;
use Illuminate\Database\Seeder;

class ProductSeeder extends Seeder
{
    /**
     * Seed categories, products, SKUs, and primary images for the storefront.
     * Safe to run multiple times (matched by slug / sku_code).
     */
    public function run(): void
    {
        $categories = [
            ['name' => 'Romantic Bouquets', 'slug' => 'romantic-bouquets', 'sort_order' => 1, 'description' => 'Hand-tied bouquets for dates, anniversaries, and “just because”.'],
            ['name' => 'Compact Gifts', 'slug' => 'compact-gifts', 'sort_order' => 2, 'description' => 'Small luxuries that ship beautifully and fit any shelf.'],
            ['name' => 'Self-Care & Spa', 'slug' => 'self-care-spa', 'sort_order' => 3, 'description' => 'Candles, bath sets, and calm moments at home.'],
            ['name' => 'Seasonal Picks', 'slug' => 'seasonal-picks', 'sort_order' => 4, 'description' => 'Limited editions and holiday-ready bundles.'],
        ];

        $categoryIds = [];
        foreach ($categories as $row) {
            $cat = Category::updateOrCreate(
                ['slug' => $row['slug']],
                [
                    'name' => $row['name'],
                    'description' => $row['description'],
                    'is_active' => true,
                    'sort_order' => $row['sort_order'],
                ]
            );
            $categoryIds[$row['slug']] = $cat->id;
        }

        $items = $this->catalog($categoryIds);

        foreach ($items as $item) {
            $product = Product::updateOrCreate(
                ['slug' => $item['slug']],
                [
                    'category_id' => $item['category_id'],
                    'name' => $item['name'],
                    'description' => $item['description'],
                    'status' => $item['status'] ?? 'active',
                    'is_featured' => $item['is_featured'] ?? false,
                    'is_active' => true,
                    'rating' => $item['rating'] ?? 4.5,
                    'review_count' => $item['review_count'] ?? 12,
                    'metadata' => $item['metadata'] ?? null,
                ]
            );

            $product->images()->delete();

            foreach ($item['images'] as $idx => $url) {
                ProductImage::create([
                    'product_id' => $product->id,
                    'image_path' => $url,
                    'is_primary' => $idx === 0,
                ]);
            }

            foreach ($item['skus'] as $skuRow) {
                Sku::updateOrCreate(
                    ['sku_code' => $skuRow['sku_code']],
                    array_merge($skuRow, [
                        'product_id' => $product->id,
                        'is_active' => $skuRow['is_active'] ?? true,
                    ])
                );
            }
        }
    }

    /**
     * @param  array<string, int>  $categoryIds
     * @return array<int, array<string, mixed>>
     */
    private function catalog(array $categoryIds): array
    {
        $img = static fn (string $seed, int $w = 720, int $h = 960) => "https://picsum.photos/seed/{$seed}/{$w}/{$h}";

        return [
            [
                'category_id' => $categoryIds['romantic-bouquets'],
                'slug' => 'blush-garden-rose-bouquet',
                'name' => 'Blush Garden Rose Bouquet',
                'description' => 'Soft pink roses with eucalyptus and waxflower — compact, fragrant, and photo-ready.',
                'is_featured' => true,
                'rating' => 4.9,
                'review_count' => 48,
                'images' => [$img('lalapick-blush-1'), $img('lalapick-blush-2')],
                'skus' => [
                    ['sku_code' => 'LP-ROS-BLUSH-S', 'title' => 'Standard', 'price' => 42.00, 'stock_qty' => 24, 'attributes' => ['size' => 'Standard']],
                    ['sku_code' => 'LP-ROS-BLUSH-L', 'title' => 'Large', 'price' => 58.00, 'stock_qty' => 14, 'attributes' => ['size' => 'Large']],
                ],
            ],
            [
                'category_id' => $categoryIds['romantic-bouquets'],
                'slug' => 'midnight-peony-wrap',
                'name' => 'Midnight Peony Wrap',
                'description' => 'Deep magenta tones with silver-green foliage — dramatic and romantic.',
                'is_featured' => true,
                'rating' => 4.7,
                'review_count' => 31,
                'images' => [$img('lalapick-peony-1')],
                'skus' => [
                    ['sku_code' => 'LP-PEO-MID-01', 'title' => 'Single wrap', 'price' => 54.00, 'stock_qty' => 18, 'attributes' => []],
                ],
            ],
            [
                'category_id' => $categoryIds['romantic-bouquets'],
                'slug' => 'sweetheart-mini-posy',
                'name' => 'Sweetheart Mini Posy',
                'description' => 'A tiny bouquet for desks and first dates — roses, spray roses, and baby’s breath.',
                'rating' => 4.6,
                'review_count' => 67,
                'images' => [$img('lalapick-posy-1'), $img('lalapick-posy-2')],
                'skus' => [
                    ['sku_code' => 'LP-POSY-SW-01', 'title' => 'Default', 'price' => 24.00, 'stock_qty' => 60, 'attributes' => []],
                ],
            ],
            [
                'category_id' => $categoryIds['compact-gifts'],
                'slug' => 'velvet-trinket-box-set',
                'name' => 'Velvet Trinket Box Set',
                'description' => 'Two nesting boxes in dusty rose velvet — perfect for jewelry or keepsakes.',
                'is_featured' => true,
                'rating' => 4.8,
                'review_count' => 22,
                'images' => [$img('lalapick-velvet-1')],
                'skus' => [
                    ['sku_code' => 'LP-GIFT-VBX-R', 'title' => 'Rose', 'price' => 36.00, 'stock_qty' => 40, 'attributes' => ['color' => 'Rose']],
                    ['sku_code' => 'LP-GIFT-VBX-I', 'title' => 'Ivory', 'price' => 36.00, 'stock_qty' => 35, 'attributes' => ['color' => 'Ivory']],
                ],
            ],
            [
                'category_id' => $categoryIds['compact-gifts'],
                'slug' => 'gold-rim-stacking-mugs',
                'name' => 'Gold Rim Stacking Mugs (pair)',
                'description' => 'Fine ceramic mugs with a delicate gold rim — dishwasher-safe gold glaze.',
                'rating' => 4.5,
                'review_count' => 19,
                'images' => [$img('lalapick-mugs-1')],
                'skus' => [
                    ['sku_code' => 'LP-MUG-GOLD-2', 'title' => 'Set of 2', 'price' => 28.00, 'stock_qty' => 45, 'attributes' => []],
                ],
            ],
            [
                'category_id' => $categoryIds['compact-gifts'],
                'slug' => 'letterpress-greeting-cards-5',
                'name' => 'Letterpress Greeting Cards (5-pack)',
                'description' => 'Blank inside, cotton paper, blush envelopes — for birthdays, thank-yous, and love notes.',
                'rating' => 4.4,
                'review_count' => 14,
                'images' => [$img('lalapick-cards-1')],
                'skus' => [
                    ['sku_code' => 'LP-CARD-LP-5', 'title' => '5-pack', 'price' => 16.00, 'stock_qty' => 80, 'attributes' => []],
                ],
            ],
            [
                'category_id' => $categoryIds['self-care-spa'],
                'slug' => 'rose-oat-bath-milk',
                'name' => 'Rose & Oat Bath Milk',
                'description' => 'Powdered bath milk with colloidal oat and rose absolute — two ritual-sized sachets.',
                'rating' => 4.7,
                'review_count' => 41,
                'images' => [$img('lalapick-bath-1')],
                'skus' => [
                    ['sku_code' => 'LP-SPA-BATH-2', 'title' => '2 sachets', 'price' => 19.50, 'stock_qty' => 55, 'attributes' => []],
                ],
            ],
            [
                'category_id' => $categoryIds['self-care-spa'],
                'slug' => 'soy-candle-no04-fig',
                'name' => 'Soy Candle N°04 — Fig & Blackcurrant',
                'description' => '45-hour burn, cotton wick, matte blush vessel. Hand-poured in small batches.',
                'is_featured' => true,
                'rating' => 4.9,
                'review_count' => 58,
                'images' => [$img('lalapick-candle-1'), $img('lalapick-candle-2')],
                'skus' => [
                    ['sku_code' => 'LP-CNDL-04-180', 'title' => '180g', 'price' => 32.00, 'stock_qty' => 30, 'attributes' => ['size' => '180g']],
                    ['sku_code' => 'LP-CNDL-04-90', 'title' => '90g', 'price' => 19.00, 'stock_qty' => 42, 'attributes' => ['size' => '90g']],
                ],
            ],
            [
                'category_id' => $categoryIds['self-care-spa'],
                'slug' => 'silk-eye-mask-charcoal',
                'name' => 'Silk Eye Mask — Charcoal',
                'description' => '22 momme mulberry silk, light-blocking fill, gentle elastic.',
                'rating' => 4.6,
                'review_count' => 27,
                'images' => [$img('lalapick-silk-1')],
                'skus' => [
                    ['sku_code' => 'LP-SLK-MSK-C', 'title' => 'Charcoal', 'price' => 34.00, 'stock_qty' => 25, 'attributes' => ['color' => 'Charcoal']],
                ],
            ],
            [
                'category_id' => $categoryIds['seasonal-picks'],
                'slug' => 'spring-tulip-bundle',
                'name' => 'Spring Tulip Bundle',
                'description' => 'Fresh mixed tulips in pastel tones — seasonal availability.',
                'rating' => 4.8,
                'review_count' => 36,
                'images' => [$img('lalapick-tulip-1')],
                'skus' => [
                    ['sku_code' => 'LP-SEA-TUL-10', 'title' => '10 stems', 'price' => 38.00, 'stock_qty' => 20, 'attributes' => ['stems' => '10']],
                    ['sku_code' => 'LP-SEA-TUL-20', 'title' => '20 stems', 'price' => 64.00, 'stock_qty' => 12, 'attributes' => ['stems' => '20']],
                ],
            ],
            [
                'category_id' => $categoryIds['seasonal-picks'],
                'slug' => 'limited-edition-gift-tin',
                'name' => 'Limited Edition Gift Tin',
                'description' => 'Curated mini treats: two macaron packs, a tea tin, and a ribboned spoon.',
                'status' => 'active',
                'rating' => 4.5,
                'review_count' => 9,
                'images' => [$img('lalapick-tin-1')],
                'skus' => [
                    ['sku_code' => 'LP-SEA-TIN-01', 'title' => 'Standard tin', 'price' => 44.00, 'stock_qty' => 15, 'attributes' => []],
                ],
            ],
            [
                'category_id' => $categoryIds['seasonal-picks'],
                'slug' => 'draft-winter-wreath-8',
                'name' => 'Winter Wreath — 8" (draft)',
                'description' => 'Coming soon: frosted pine and blush berries. Not yet for sale.',
                'status' => 'draft',
                'is_featured' => false,
                'rating' => 0,
                'review_count' => 0,
                'images' => [$img('lalapick-wreath-1')],
                'skus' => [
                    ['sku_code' => 'LP-SEA-WR8-D', 'title' => 'Preview', 'price' => 52.00, 'stock_qty' => 0, 'is_active' => false, 'attributes' => []],
                ],
            ],
        ];
    }
}
