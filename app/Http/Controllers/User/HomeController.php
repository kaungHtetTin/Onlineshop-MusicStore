<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Illuminate\Foundation\Application;
use Inertia\Inertia;

use App\Models\Product;
use App\Models\BlogPost;
use App\Models\Category;
use App\Models\OrderItem;
use App\Models\PaymentMethod;
use App\Models\StorefrontBlock;
use App\Services\FlashSalePricingService;
use App\Services\Inventory\StorefrontInventoryService;
use Illuminate\Support\Facades\DB;

class HomeController extends Controller
{
    public function index(
        FlashSalePricingService $flashSalePricing,
        StorefrontInventoryService $storefrontInventory
    )
    {
        $latestProducts = Product::with(['category', 'primaryImage', 'skus.image'])
            ->where('status', 'active')
            ->latest()
            ->take(12)
            ->get();

        $bestSellerIds = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', 'paid')
            ->groupBy('order_items.product_id')
            ->orderByDesc(DB::raw('SUM(order_items.quantity)'))
            ->limit(12)
            ->pluck('order_items.product_id')
            ->all();

        $products = $latestProducts;
        if (! empty($bestSellerIds)) {
            $products = Product::with(['category', 'primaryImage', 'skus.image'])
                ->whereIn('id', $bestSellerIds)
                ->where('status', 'active')
                ->orderByRaw('FIELD(id, '.implode(',', array_map('intval', $bestSellerIds)).')')
                ->get();
        }

        $activeFlashSale = $flashSalePricing->activeSale();
        $flashSaleProducts = collect();
        if ($activeFlashSale) {
            $flashSaleProductIds = $activeFlashSale->items
                ->pluck('sku.product_id')
                ->filter()
                ->unique()
                ->values()
                ->all();

            if (! empty($flashSaleProductIds)) {
                $flashSaleProducts = Product::with(['category', 'primaryImage', 'skus.image'])
                    ->whereIn('id', $flashSaleProductIds)
                    ->where('status', 'active')
                    ->orderByRaw('FIELD(id, '.implode(',', array_map('intval', $flashSaleProductIds)).')')
                    ->take(8)
                    ->get();
            }
        }

        $flashSalePricing->attachToProducts($products);
        $flashSalePricing->attachToProducts($flashSaleProducts);
        $storefrontInventory->attachAvailableQuantities($products);
        $storefrontInventory->attachAvailableQuantities($flashSaleProducts);

        $categories = Category::where('is_active', true)
            ->orderBy('sort_order')
            ->get()
            ->filter(fn ($category) => ($category->metadata['homepage_featured'] ?? true) === true)
            ->values();

        $hero = StorefrontBlock::where('type', StorefrontBlock::TYPE_HERO)
            ->orderBy('sort_order')
            ->first();
        $promos = StorefrontBlock::where('type', StorefrontBlock::TYPE_PROMO)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();
        $sections = StorefrontBlock::where('type', StorefrontBlock::TYPE_SECTION)
            ->where('key', '!=', 'newsletter')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get()
            ->keyBy('key')
            ->map(fn ($section) => [
                'key' => $section->key,
                'title' => $section->title,
                'subtitle' => $section->subtitle,
                'sort_order' => $section->sort_order,
                'is_active' => $section->is_active,
            ])
            ->all();

        $latestBlogs = BlogPost::query()
            ->published()
            ->with(['category', 'tags', 'author:id,name'])
            ->latest('published_at')
            ->take(3)
            ->get();

        $paymentMethods = PaymentMethod::active()
            ->ordered()
            ->take(6)
            ->get();

        return Inertia::render('User/Welcome', [
            'products' => $products,
            'flashSaleProducts' => $flashSaleProducts,
            'activeFlashSale' => $activeFlashSale ? [
                'id' => $activeFlashSale->id,
                'name' => $activeFlashSale->name,
                'starts_at' => $activeFlashSale->starts_at,
                'ends_at' => $activeFlashSale->ends_at,
            ] : null,
            'categories' => $categories,
            'storefront' => [
                'hero' => $hero,
                'promos' => $promos,
                'sections' => $sections,
            ],
            'latestBlogs' => $latestBlogs,
            'paymentMethods' => $paymentMethods,
            'canLogin' => true,
            'canRegister' => true,
            'laravelVersion' => Application::VERSION,
            'phpVersion' => PHP_VERSION,
        ]);
    }
}
