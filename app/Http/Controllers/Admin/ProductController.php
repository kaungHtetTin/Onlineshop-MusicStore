<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Product;
use App\Models\Category;
use App\Models\ProductImage;
use App\Models\Sku;
use App\Models\Location;
use App\Services\Inventory\InventoryService;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class ProductController extends Controller
{
    public function index()
    {
        return Spa::render('Admin/Products/Index', [
            'products' => Product::with(['category', 'primaryImage', 'skus.inventoryBalances'])
                ->latest()
                ->paginate(15)
                ->through(function (Product $product) {
                    $product->total_on_hand = $product->skus->sum(
                        fn (Sku $sku) => $sku->inventoryBalances->sum('on_hand_qty')
                    );

                    return $product;
                })
                ->withQueryString(),
            'categories' => Category::where('is_active', true)->get()
        ]);
    }

    public function create()
    {
        return Spa::render('Admin/Products/Create', [
            'categories' => Category::where('is_active', true)->get()
        ]);
    }

    public function generateBarcode(Request $request)
    {
        $validated = $request->validate([
            'reserved' => 'nullable|array',
            'reserved.*' => 'nullable|string|max:255',
        ]);

        $reserved = collect($validated['reserved'] ?? [])
            ->map(fn ($barcode) => trim((string) $barcode))
            ->filter()
            ->values()
            ->all();

        return response()->json([
            'barcode' => $this->generateUniqueBarcode($reserved),
        ]);
    }

    public function barcodes(Request $request)
    {
        $this->ensureSkuBarcodes();

        $filters = $request->validate([
            'q' => 'nullable|string|max:255',
            'category_id' => 'nullable|integer|exists:categories,id',
            'product_status' => 'nullable|string|in:all,active,inactive,draft',
            'sku_status' => 'nullable|string|in:all,active,inactive',
            'per_page' => 'nullable|integer|in:10,25,50,100',
        ]);
        $perPage = $filters['per_page'] ?? 25;

        $query = Sku::query()
            ->with(['product.category'])
            ->whereHas('product');

        if (! empty($filters['q'])) {
            $search = trim($filters['q']);
            $query->where(function ($scope) use ($search) {
                $scope
                    ->where('sku_code', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%")
                    ->orWhereHas('product', fn ($product) => $product->where('name', 'like', "%{$search}%"));
            });
        }

        if (! empty($filters['category_id'])) {
            $query->whereHas('product', fn ($product) => $product->where('category_id', $filters['category_id']));
        }

        if (($filters['product_status'] ?? 'all') !== 'all') {
            $query->whereHas('product', fn ($product) => $product->where('status', $filters['product_status']));
        }

        if (($filters['sku_status'] ?? 'all') !== 'all') {
            $query->where('is_active', ($filters['sku_status'] ?? 'all') === 'active');
        }

        return Spa::render('Admin/Products/Barcodes', [
            'skus' => $query
                ->join('products', 'skus.product_id', '=', 'products.id')
                ->orderBy('products.name')
                ->orderBy('skus.sku_code')
                ->select('skus.*')
                ->paginate($perPage)
                ->through(fn (Sku $sku) => [
                    'id' => $sku->id,
                    'sku_code' => $sku->sku_code,
                    'barcode' => $sku->barcode,
                    'price' => $sku->price,
                    'is_active' => $sku->is_active,
                    'attributes' => $sku->attributes ?? [],
                    'product' => [
                        'id' => $sku->product?->id,
                        'name' => $sku->product?->name,
                        'status' => $sku->product?->status,
                    ],
                    'category' => [
                        'id' => $sku->product?->category?->id,
                        'name' => $sku->product?->category?->name,
                    ],
                ])
                ->withQueryString(),
            'categories' => Category::where('is_active', true)->orderBy('name')->get(['id', 'name']),
            'filters' => [
                'q' => $filters['q'] ?? '',
                'category_id' => $filters['category_id'] ?? '',
                'product_status' => $filters['product_status'] ?? 'all',
                'sku_status' => $filters['sku_status'] ?? 'all',
                'per_page' => $perPage,
            ],
        ]);
    }

    public function store(Request $request, InventoryService $inventoryService)
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'required|string|in:active,inactive,draft',
            'is_featured' => 'boolean',
            'metadata' => 'nullable|array',
            'mainImageAttachmentId' => 'nullable|integer',
            'imageAttachmentIds' => 'nullable|array',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpg,jpeg,png,webp|max:1024',
            'skus' => 'required|array|min:1',
            'skus.*.sku_code' => 'required|string|unique:skus,sku_code',
            'skus.*.barcode' => 'nullable|string|max:255',
            'skus.*.price' => 'required|numeric|min:0',
            'skus.*.market_price' => 'nullable|numeric|min:0',
            'skus.*.wholesale_price' => 'nullable|numeric|min:0',
            'skus.*.cost' => 'nullable|numeric|min:0',
            'skus.*.is_active' => 'boolean',
            'skus.*.attributes' => 'nullable|array',
            'skus.*.image_index' => 'nullable|integer',
        ]);

        $validated['skus'] = $this->withGeneratedBarcodes($validated['skus']);
        $this->assertUniqueBarcodes($validated['skus']);

        return DB::transaction(function () use ($request, $validated, $inventoryService) {
            $validated['slug'] = Str::slug($validated['name']);
            
            $product = Product::create([
                'category_id' => $validated['category_id'],
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'description' => $validated['description'],
                'status' => $validated['status'],
                'is_featured' => $validated['is_featured'] ?? false,
                'metadata' => $validated['metadata'] ?? null,
            ]);

            // Save Images first to get IDs
            $savedImageIds = [];
            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $index => $image) {
                    $path = $image->store('products', 'public');
                    $img = ProductImage::create([
                        'product_id' => $product->id,
                        'image_path' => $path,
                        'is_primary' => $index === 0,
                    ]);
                    $savedImageIds[$index] = $img->id;
                }
            }

            foreach ($validated['skus'] as $skuData) {
                $originalPrice = $skuData['cost'] ?? $skuData['market_price'] ?? null;
                $imgId = null;
                if (isset($skuData['image_index']) && isset($savedImageIds[$skuData['image_index']])) {
                    $imgId = $savedImageIds[$skuData['image_index']];
                }

                $sku = $product->skus()->create([
                    'sku_code' => $skuData['sku_code'],
                    'barcode' => $skuData['barcode'],
                    'price' => $skuData['price'],
                    'market_price' => $originalPrice,
                    'wholesale_price' => $skuData['wholesale_price'] ?? null,
                    'cost' => $originalPrice,
                    'is_active' => $skuData['is_active'] ?? true,
                    'attributes' => $skuData['attributes'] ?? null,
                    'image_attachment_id' => $imgId,
                ]);

                $defaultLocation = Location::query()->where('is_default_fulfillment', true)->where('is_active', true)->first();
                if ($defaultLocation) {
                    $inventoryService->ensureBalance($defaultLocation, $sku);
                }
            }

            return redirect()->route('admin.products.index')->with('success', 'Product created successfully.');
        });
    }

    public function edit(Product $product)
    {
        return Spa::render('Admin/Products/Edit', [
            'product' => $product->load(['images', 'skus']),
            'categories' => Category::where('is_active', true)->get()
        ]);
    }

    public function update(Request $request, Product $product, InventoryService $inventoryService)
    {
        $validated = $request->validate([
            'category_id' => 'required|exists:categories,id',
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'status' => 'required|string|in:active,inactive,draft',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
            'metadata' => 'nullable|array',
            'mainImageAttachmentId' => 'nullable|integer',
            'imageAttachmentIds' => 'nullable|array',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpg,jpeg,png,webp|max:1024',
            'skus' => 'required|array|min:1',
            'skus.*.id' => 'nullable|exists:skus,id',
            'skus.*.sku_code' => 'required|string|unique:skus,sku_code,' . $product->id . ',product_id',
            'skus.*.barcode' => 'nullable|string|max:255',
            'skus.*.price' => 'required|numeric|min:0',
            'skus.*.market_price' => 'nullable|numeric|min:0',
            'skus.*.wholesale_price' => 'nullable|numeric|min:0',
            'skus.*.cost' => 'nullable|numeric|min:0',
            'skus.*.is_active' => 'boolean',
            'skus.*.attributes' => 'nullable|array',
            'skus.*.image_attachment_id' => 'nullable|integer',
        ]);

        $validated['skus'] = $this->withGeneratedBarcodes($validated['skus']);
        $this->assertUniqueBarcodes($validated['skus']);

        $newSkuIds = collect($validated['skus'])->pluck('id')->filter()->map(fn ($id) => (int) $id)->all();
        if ($product->skus()->whereNotIn('id', $newSkuIds)->whereHas('inventoryMovements')->exists()) {
            return redirect()->back()->withErrors(['skus' => 'A SKU with inventory history cannot be removed. Deactivate it instead.']);
        }

        return DB::transaction(function () use ($validated, $product, $request, $inventoryService) {
            $validated['slug'] = Str::slug($validated['name']);
            $product->update([
                'category_id' => $validated['category_id'],
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'description' => $validated['description'],
                'status' => $validated['status'],
                'is_featured' => $validated['is_featured'] ?? false,
                'is_active' => $validated['is_active'] ?? true,
                'metadata' => $validated['metadata'] ?? null,
            ]);

            // Handle Image Gallery first to handle removals
            if (isset($validated['imageAttachmentIds'])) {
                // Remove images not in the list
                $product->images()->whereNotIn('id', $validated['imageAttachmentIds'])->each(function($img) {
                    Storage::disk('public')->delete($img->image_path);
                    $img->delete();
                });
            }

            // Upload new images
            if ($request->hasFile('images')) {
                foreach ($request->file('images') as $image) {
                    $path = $image->store('products', 'public');
                    ProductImage::create([
                        'product_id' => $product->id,
                        'image_path' => $path,
                        'is_primary' => false,
                    ]);
                }
            }

            // Update primary image
            if (isset($validated['mainImageAttachmentId'])) {
                ProductImage::where('product_id', $product->id)->update(['is_primary' => false]);
                ProductImage::where('product_id', $product->id)
                    ->where('id', $validated['mainImageAttachmentId'])
                    ->update(['is_primary' => true]);
            } elseif (! $product->images()->where('is_primary', true)->exists()) {
                $primaryImage = $product->images()->oldest('id')->first();
                if ($primaryImage) {
                    $primaryImage->update(['is_primary' => true]);
                }
            }

            // Sync SKUs
            $newSkuIds = collect($validated['skus'])->pluck('id')->filter()->toArray();
            $product->skus()->whereNotIn('id', $newSkuIds)->delete();

            foreach ($validated['skus'] as $skuData) {
                $originalPrice = $skuData['cost'] ?? $skuData['market_price'] ?? null;
                $payload = [
                    'sku_code' => $skuData['sku_code'],
                    'barcode' => $skuData['barcode'],
                    'price' => $skuData['price'],
                    'market_price' => $originalPrice,
                    'wholesale_price' => $skuData['wholesale_price'] ?? null,
                    'cost' => $originalPrice,
                    'is_active' => $skuData['is_active'] ?? true,
                    'attributes' => $skuData['attributes'] ?? null,
                    'image_attachment_id' => $skuData['image_attachment_id'] ?? null,
                ];

                if (isset($skuData['id'])) {
                    $product->skus()->where('id', $skuData['id'])->update($payload);
                } else {
                    $sku = $product->skus()->create($payload);
                    $defaultLocation = Location::query()->where('is_default_fulfillment', true)->where('is_active', true)->first();
                    if ($defaultLocation) {
                        $inventoryService->ensureBalance($defaultLocation, $sku);
                    }
                }
            }

            return redirect()->route('admin.products.index')->with('success', 'Product updated successfully.');
        });
    }

    public function destroy(Product $product)
    {
        if ($product->skus()->whereHas('inventoryMovements')->exists()) {
            return redirect()->back()->with('error', 'A product with inventory history cannot be deleted. Deactivate it instead.');
        }
        // Delete images from storage
        foreach ($product->images as $image) {
            Storage::disk('public')->delete($image->image_path);
        }
        
        $product->delete();

        return redirect()->back()->with('success', 'Product deleted successfully.');
    }

    private function generateUniqueBarcode(array $reservedBarcodes = []): string
    {
        $reserved = array_fill_keys(array_map('strval', $reservedBarcodes), true);

        do {
            $barcode = '20' . str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
        } while (isset($reserved[$barcode]) || Sku::where('barcode', $barcode)->exists());

        return $barcode;
    }

    private function withGeneratedBarcodes(array $skus): array
    {
        $reserved = collect($skus)
            ->pluck('barcode')
            ->map(fn ($barcode) => trim((string) $barcode))
            ->filter()
            ->values()
            ->all();

        return array_map(function (array $sku) use (&$reserved) {
            $barcode = trim((string) ($sku['barcode'] ?? ''));

            if ($barcode === '') {
                $barcode = $this->generateUniqueBarcode($reserved);
            }

            $reserved[] = $barcode;

            return array_merge($sku, [
                'barcode' => $barcode,
            ]);
        }, $skus);
    }

    private function assertUniqueBarcodes(array $skus): void
    {
        $errors = [];
        $seen = [];

        foreach ($skus as $index => $sku) {
            $barcode = trim((string) ($sku['barcode'] ?? ''));

            if ($barcode === '') {
                continue;
            }

            $barcodeKey = strtoupper($barcode);
            if (isset($seen[$barcodeKey])) {
                $errors["skus.{$index}.barcode"] = 'Barcode must be unique.';
                continue;
            }

            $seen[$barcodeKey] = true;
            $skuId = isset($sku['id']) ? (int) $sku['id'] : null;
            $exists = Sku::query()
                ->where('barcode', $barcode)
                ->when($skuId, fn ($query) => $query->whereKeyNot($skuId))
                ->exists();

            if ($exists) {
                $errors["skus.{$index}.barcode"] = 'Barcode has already been taken.';
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function ensureSkuBarcodes(): void
    {
        Sku::query()
            ->where(fn ($query) => $query->whereNull('barcode')->orWhere('barcode', ''))
            ->orderBy('id')
            ->select(['id', 'barcode'])
            ->chunkById(100, function ($skus) {
                foreach ($skus as $sku) {
                    $sku->update(['barcode' => $this->generateUniqueBarcode()]);
                }
            });
    }
}
