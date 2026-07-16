<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Review;
use App\Models\Category;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use App\Services\FlashSalePricingService;
use App\Services\Inventory\StorefrontInventoryService;
use App\Models\FlashSaleItem;

class ProductController extends Controller
{
    public function index(
        Request $request,
        FlashSalePricingService $flashSalePricing,
        StorefrontInventoryService $storefrontInventory
    )
    {
        $query = Product::with([
                'category',
                'primaryImage',
                'skus' => fn ($q) => $q->availableAnywhere()->with('image'),
            ])
            ->active()
            ->availableAnywhere();

        // Search
        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        // Category Filter
        if ($request->filled('category')) {
            $query->whereHas('category', function($q) use ($request) {
                $q->where('slug', $request->category);
            });
        }

        if ($request->filled('min_price')) {
            $query->whereHas('skus', fn ($q) => $q->availableAnywhere()->where('price', '>=', (float) $request->min_price));
        }

        if ($request->filled('max_price')) {
            $query->whereHas('skus', fn ($q) => $q->availableAnywhere()->where('price', '<=', (float) $request->max_price));
        }

        if ($request->filled('min_rating')) {
            $query->where('rating', '>=', (float) $request->min_rating);
        }

        if ($request->boolean('flash_sale')) {
            $saleSkuIds = FlashSaleItem::query()
                ->whereHas('flashSale', fn ($q) => $q->activeNow())
                ->pluck('sku_id');
            $query->whereHas('skus', fn ($q) => $q->availableAnywhere()->whereIn('id', $saleSkuIds));
        }

        // Sorting
        if ($request->filled('sort')) {
            switch ($request->sort) {
                case 'newest':
                    $query->latest();
                    break;
                case 'price_low':
                    $query->joinSub(
                        DB::table('skus')
                            ->join('inventory_balances', 'inventory_balances.sku_id', '=', 'skus.id')
                            ->join('locations', 'locations.id', '=', 'inventory_balances.location_id')
                            ->where('skus.is_active', true)
                            ->where('locations.is_active', true)
                            ->whereColumn('inventory_balances.on_hand_qty', '>', 'inventory_balances.reserved_qty')
                            ->selectRaw('product_id, MIN(price) as sort_price')
                            ->groupBy('product_id'),
                        'sku_sort',
                        'products.id',
                        '=',
                        'sku_sort.product_id'
                    )->select('products.*')->orderBy('sku_sort.sort_price', 'asc');
                    break;
                case 'price_high':
                    $query->joinSub(
                        DB::table('skus')
                            ->join('inventory_balances', 'inventory_balances.sku_id', '=', 'skus.id')
                            ->join('locations', 'locations.id', '=', 'inventory_balances.location_id')
                            ->where('skus.is_active', true)
                            ->where('locations.is_active', true)
                            ->whereColumn('inventory_balances.on_hand_qty', '>', 'inventory_balances.reserved_qty')
                            ->selectRaw('product_id, MAX(price) as sort_price')
                            ->groupBy('product_id'),
                        'sku_sort',
                        'products.id',
                        '=',
                        'sku_sort.product_id'
                    )->select('products.*')->orderBy('sku_sort.sort_price', 'desc');
                    break;
                case 'best_selling':
                    $query->leftJoinSub(
                        DB::table('order_items')
                            ->join('orders', 'orders.id', '=', 'order_items.order_id')
                            ->where('orders.payment_status', 'paid')
                            ->selectRaw('order_items.product_id, SUM(order_items.quantity) as sold_qty')
                            ->groupBy('order_items.product_id'),
                        'sales_sort',
                        'products.id',
                        '=',
                        'sales_sort.product_id'
                    )
                        ->select('products.*')
                        ->orderByDesc(DB::raw('COALESCE(sales_sort.sold_qty, 0)'))
                        ->latest('products.created_at');
                    break;
                case 'rating':
                    $query->orderByDesc('rating')->latest();
                    break;
                default:
                    $query->latest();
            }
        } else {
            $query->latest();
        }

        $products = $query->paginate(12)->withQueryString();
        $flashSalePricing->attachToProducts($products->getCollection());
        $storefrontInventory->attachAvailableQuantitiesAcrossLocations($products->getCollection());

        $categories = Category::where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        return Inertia::render('User/Products/Index', [
            'products' => $products,
            'categories' => $categories,
            'filters' => $request->only(['search', 'category', 'sort', 'min_price', 'max_price', 'min_rating', 'flash_sale'])
        ]);
    }

    public function show(
        $slug,
        FlashSalePricingService $flashSalePricing,
        StorefrontInventoryService $storefrontInventory
    )
    {
        $product = Product::with([
                'category',
                'images',
                'skus' => fn ($q) => $q->availableAnywhere()->with('image'),
            ])
            ->where('slug', $slug)
            ->active()
            ->availableAnywhere()
            ->firstOrFail();

        $reviews = Review::query()
            ->where('product_id', $product->id)
            ->where('is_approved', true)
            ->with('user:id,name')
            ->latest()
            ->paginate(6, ['*'], 'reviews_page')
            ->withQueryString();

        // Category-based related products
        $relatedProducts = Product::with([
                'category',
                'primaryImage',
                'skus' => fn ($q) => $q->availableAnywhere()->with('image'),
            ])
            ->where('category_id', $product->category_id)
            ->where('id', '!=', $product->id)
            ->active()
            ->availableAnywhere()
            ->take(6)
            ->get();

        // Personalized recommendations for logged-in users (category affinity by order history).
        $recommendedProducts = collect();
        if (auth()->check()) {
            $preferredCategoryIds = OrderItem::query()
                ->join('orders', 'orders.id', '=', 'order_items.order_id')
                ->join('products', 'products.id', '=', 'order_items.product_id')
                ->where('orders.user_id', auth()->id())
                ->groupBy('products.category_id')
                ->orderByRaw('SUM(order_items.quantity) DESC')
                ->pluck('products.category_id');

            if ($preferredCategoryIds->isNotEmpty()) {
                $recommendedProducts = Product::with([
                        'category',
                        'primaryImage',
                        'skus' => fn ($q) => $q->availableAnywhere()->with('image'),
                    ])
                    ->active()
                    ->availableAnywhere()
                    ->where('id', '!=', $product->id)
                    ->whereIn('category_id', $preferredCategoryIds->all())
                    ->orderByRaw('FIELD(category_id, '.implode(',', $preferredCategoryIds->all()).')')
                    ->latest()
                    ->take(6)
                    ->get();
            }
        }

        if ($recommendedProducts->isEmpty()) {
            $recommendedProducts = $relatedProducts;
        }

        $frequentlyBoughtTogetherIds = OrderItem::query()
            ->from('order_items as current_items')
            ->join('order_items as other_items', 'other_items.order_id', '=', 'current_items.order_id')
            ->join('orders', 'orders.id', '=', 'current_items.order_id')
            ->where('current_items.product_id', $product->id)
            ->whereColumn('other_items.product_id', '!=', 'current_items.product_id')
            ->where('orders.payment_status', 'paid')
            ->groupBy('other_items.product_id')
            ->orderByDesc(DB::raw('SUM(other_items.quantity)'))
            ->limit(6)
            ->pluck('other_items.product_id')
            ->all();

        $frequentlyBoughtTogether = collect();
        if (! empty($frequentlyBoughtTogetherIds)) {
            $frequentlyBoughtTogether = Product::with([
                    'category',
                    'primaryImage',
                    'skus' => fn ($q) => $q->availableAnywhere()->with('image'),
                ])
                ->whereIn('id', $frequentlyBoughtTogetherIds)
                ->active()
                ->availableAnywhere()
                ->orderByRaw('FIELD(id, '.implode(',', array_map('intval', $frequentlyBoughtTogetherIds)).')')
                ->get();
        }

        $flashSalePricing->attachToProducts(collect([$product]));
        $flashSalePricing->attachToProducts($relatedProducts);
        $flashSalePricing->attachToProducts($recommendedProducts);
        $flashSalePricing->attachToProducts($frequentlyBoughtTogether);

        $storefrontInventory->attachAvailableQuantitiesAcrossLocations(
            collect([$product])
                ->concat($relatedProducts)
                ->concat($recommendedProducts)
                ->concat($frequentlyBoughtTogether)
                ->unique('id')
        );

        return Inertia::render('User/Products/Show', [
            'product' => $product,
            'relatedProducts' => $relatedProducts,
            'recommendedProducts' => $recommendedProducts,
            'frequentlyBoughtTogether' => $frequentlyBoughtTogether,
            'reviews' => $reviews,
        ]);
    }

    public function storeReview(Request $request, $slug)
    {
        $product = Product::query()
            ->where('slug', $slug)
            ->where('status', 'active')
            ->firstOrFail();

        $validated = $request->validate([
            'rating' => ['required', 'integer', Rule::in([1, 2, 3, 4, 5])],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        Review::updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'product_id' => $product->id,
            ],
            [
                'rating' => (int) $validated['rating'],
                'comment' => $validated['comment'] ?? null,
                'is_approved' => true,
            ]
        );

        $stats = Review::query()
            ->where('product_id', $product->id)
            ->where('is_approved', true)
            ->selectRaw('COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as review_count')
            ->first();

        $product->update([
            'rating' => round((float) ($stats->avg_rating ?? 0), 2),
            'review_count' => (int) ($stats->review_count ?? 0),
        ]);

        return back()->with('success', 'Thanks! Your rating has been saved.');
    }
}
