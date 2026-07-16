<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Services\FlashSalePricingService;
use App\Services\Inventory\StorefrontInventoryService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class CategoryController extends Controller
{
    public function index()
    {
        $rootsQuery = Category::query()
            ->where('is_active', true)
            ->whereNull('parent_id')
            ->with([
                'children' => function ($q) {
                    $q->where('is_active', true)
                        ->orderBy('sort_order')
                        ->withCount([
                            'products' => fn ($pq) => $pq->where('status', 'active'),
                        ]);
                },
            ])
            ->withCount([
                'products' => fn ($q) => $q->where('status', 'active'),
            ])
            ->orderBy('sort_order');

        $roots = $rootsQuery->paginate(12)->withQueryString();

        if ($roots->total() === 0) {
            $roots = Category::query()
                ->where('is_active', true)
                ->withCount([
                    'products' => fn ($q) => $q->where('status', 'active'),
                ])
                ->orderBy('sort_order')
                ->paginate(12)
                ->withQueryString();
        }

        return Inertia::render('User/Categories/Index', [
            'categories' => $roots,
        ]);
    }

    public function show(
        Request $request,
        string $slug,
        FlashSalePricingService $flashSalePricing,
        StorefrontInventoryService $storefrontInventory
    )
    {
        $category = Category::query()
            ->where('slug', $slug)
            ->where('is_active', true)
            ->with([
                'parent:id,name,slug',
                'children' => function ($q) {
                    $q->where('is_active', true)
                        ->orderBy('sort_order')
                        ->withCount([
                            'products' => fn ($pq) => $pq->where('status', 'active'),
                        ]);
                },
            ])
            ->withCount([
                'products' => fn ($q) => $q->where('status', 'active'),
            ])
            ->firstOrFail();

        $products = Product::with(['category', 'primaryImage', 'skus.image'])
            ->where('category_id', $category->id)
            ->where('status', 'active')
            ->latest()
            ->paginate(12)
            ->withQueryString();
        $flashSalePricing->attachToProducts($products->getCollection());
        $storefrontInventory->attachAvailableQuantities($products->getCollection());

        return Inertia::render('User/Categories/Show', [
            'category' => $category,
            'products' => $products,
        ]);
    }
}
