<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Product;
use App\Models\Category;
use App\Models\ProductImage;
use App\Models\Sku;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function index()
    {
        return Inertia::render('Admin/Products/Index', [
            'products' => Product::with(['category', 'primaryImage', 'skus'])
                ->latest()
                ->paginate(15)
                ->withQueryString(),
            'categories' => Category::where('is_active', true)->get()
        ]);
    }

    public function create()
    {
        return Inertia::render('Admin/Products/Create', [
            'categories' => Category::where('is_active', true)->get()
        ]);
    }

    public function store(Request $request)
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
            'skus' => 'required|array|min:1',
            'skus.*.sku_code' => 'required|string|unique:skus,sku_code',
            'skus.*.barcode' => 'nullable|string|max:255',
            'skus.*.price' => 'required|numeric|min:0',
            'skus.*.stock_qty' => 'required|integer|min:0',
            'skus.*.is_active' => 'boolean',
            'skus.*.attributes' => 'nullable|array',
            'skus.*.image_index' => 'nullable|integer',
        ]);

        return DB::transaction(function () use ($request, $validated) {
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
                $imgId = null;
                if (isset($skuData['image_index']) && isset($savedImageIds[$skuData['image_index']])) {
                    $imgId = $savedImageIds[$skuData['image_index']];
                }

                $product->skus()->create([
                    'sku_code' => $skuData['sku_code'],
                    'barcode' => $skuData['barcode'] ?? null,
                    'price' => $skuData['price'],
                    'stock_qty' => $skuData['stock_qty'],
                    'is_active' => $skuData['is_active'] ?? true,
                    'attributes' => $skuData['attributes'] ?? null,
                    'image_attachment_id' => $imgId,
                ]);
            }

            return redirect()->route('admin.products.index')->with('success', 'Product created successfully.');
        });
    }

    public function edit(Product $product)
    {
        return Inertia::render('Admin/Products/Edit', [
            'product' => $product->load(['images', 'skus']),
            'categories' => Category::where('is_active', true)->get()
        ]);
    }

    public function update(Request $request, Product $product)
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
            'skus' => 'required|array|min:1',
            'skus.*.id' => 'nullable|exists:skus,id',
            'skus.*.sku_code' => 'required|string|unique:skus,sku_code,' . $product->id . ',product_id',
            'skus.*.barcode' => 'nullable|string|max:255',
            'skus.*.price' => 'required|numeric|min:0',
            'skus.*.stock_qty' => 'required|integer|min:0',
            'skus.*.is_active' => 'boolean',
            'skus.*.attributes' => 'nullable|array',
            'skus.*.image_attachment_id' => 'nullable|integer',
        ]);

        return DB::transaction(function () use ($validated, $product, $request) {
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
                ProductImage::where('id', $validated['mainImageAttachmentId'])->update(['is_primary' => true]);
            }

            // Sync SKUs
            $newSkuIds = collect($validated['skus'])->pluck('id')->filter()->toArray();
            $product->skus()->whereNotIn('id', $newSkuIds)->delete();

            foreach ($validated['skus'] as $skuData) {
                $payload = [
                    'sku_code' => $skuData['sku_code'],
                    'barcode' => $skuData['barcode'] ?? null,
                    'price' => $skuData['price'],
                    'stock_qty' => $skuData['stock_qty'],
                    'is_active' => $skuData['is_active'] ?? true,
                    'attributes' => $skuData['attributes'] ?? null,
                    'image_attachment_id' => $skuData['image_attachment_id'] ?? null,
                ];

                if (isset($skuData['id'])) {
                    $product->skus()->where('id', $skuData['id'])->update($payload);
                } else {
                    $product->skus()->create($payload);
                }
            }

            return redirect()->route('admin.products.index')->with('success', 'Product updated successfully.');
        });
    }

    public function destroy(Product $product)
    {
        // Delete images from storage
        foreach ($product->images as $image) {
            Storage::disk('public')->delete($image->image_path);
        }
        
        $product->delete();

        return redirect()->back()->with('success', 'Product deleted successfully.');
    }
}
