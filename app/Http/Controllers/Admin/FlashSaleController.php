<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\FlashSale;
use App\Models\FlashSaleItem;
use App\Models\Product;
use App\Models\Sku;
use App\Services\AuditLogService;
use App\Services\Inventory\StorefrontInventoryService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class FlashSaleController extends Controller
{
    public function __construct(private StorefrontInventoryService $storefrontInventory)
    {
    }

    public function index(Request $request)
    {
        $query = FlashSale::query()
            ->with(['items.sku.product'])
            ->withCount('items')
            ->latest();

        if ($request->filled('q')) {
            $query->where('name', 'like', '%'.trim($request->q).'%');
        }

        if ($request->filled('status')) {
            match ($request->status) {
                'live' => $query->activeNow(),
                'scheduled' => $query->where('is_active', true)->where('starts_at', '>', now()),
                'ended' => $query->where('ends_at', '<', now()),
                'inactive' => $query->where('is_active', false),
                default => null,
            };
        }

        return Spa::render('Admin/FlashSales/Index', [
            'flashSales' => $query->paginate(12)->withQueryString(),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'status' => $request->string('status')->toString(),
            ],
        ]);
    }

    public function create()
    {
        return Spa::render('Admin/FlashSales/Create', [
            'productOptions' => $this->productOptions(),
        ]);
    }

    public function edit(FlashSale $flashSale)
    {
        $flashSale->load(['items.sku.product']);

        return Spa::render('Admin/FlashSales/Edit', [
            'flashSale' => $flashSale,
            'productOptions' => $this->productOptions(),
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $validated = $this->validated($request);
        $this->ensureNoCatalogOverlap($validated);

        $flashSale = DB::transaction(function () use ($validated) {
            $flashSale = FlashSale::create($this->salePayload($validated));
            $this->syncItems($flashSale, $validated['items']);

            return $flashSale;
        });

        $auditLogService->record('flash_sale.created', $flashSale, ['name' => $flashSale->name], $request);

        return redirect()
            ->route('admin.flash-sales.index')
            ->with('success', 'Flash sale created.');
    }

    public function update(Request $request, FlashSale $flashSale, AuditLogService $auditLogService)
    {
        $validated = $this->validated($request);
        $this->ensureNoCatalogOverlap($validated, $flashSale);

        DB::transaction(function () use ($flashSale, $validated) {
            $flashSale->update($this->salePayload($validated));
            $this->syncItems($flashSale, $validated['items']);
        });

        $auditLogService->record('flash_sale.updated', $flashSale, ['name' => $flashSale->name], $request);

        return redirect()
            ->route('admin.flash-sales.index')
            ->with('success', 'Flash sale updated.');
    }

    public function destroy(Request $request, FlashSale $flashSale, AuditLogService $auditLogService)
    {
        $auditLogService->record('flash_sale.deleted', $flashSale, ['name' => $flashSale->name], $request);
        $flashSale->delete();

        return back()->with('success', 'Flash sale deleted.');
    }

    private function validated(Request $request): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'is_active' => ['required', 'boolean'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sku_id' => ['required', 'integer', 'exists:skus,id'],
            'items.*.discount_type' => ['required', Rule::in([FlashSaleItem::TYPE_PERCENTAGE, FlashSaleItem::TYPE_FIXED_PRICE])],
            'items.*.discount_value' => ['required', 'numeric', 'min:0.01'],
            'items.*.quantity_limit' => ['nullable', 'integer', 'min:1'],
        ]);

        $skuIds = collect($validated['items'])->pluck('sku_id')->map(fn ($id) => (int) $id);

        if ($skuIds->duplicates()->isNotEmpty()) {
            throw ValidationException::withMessages([
                'items' => 'Each SKU can only appear once in a flash sale.',
            ]);
        }

        $skus = Sku::query()->whereIn('id', $skuIds->all())->get()->keyBy('id');

        foreach ($validated['items'] as $index => $item) {
            $sku = $skus->get((int) $item['sku_id']);
            $value = (float) $item['discount_value'];

            if ($item['discount_type'] === FlashSaleItem::TYPE_PERCENTAGE && $value >= 100) {
                throw ValidationException::withMessages([
                    "items.{$index}.discount_value" => 'Percentage discount must be less than 100.',
                ]);
            }

            if ($item['discount_type'] === FlashSaleItem::TYPE_FIXED_PRICE && $sku && $value >= (float) $sku->price) {
                throw ValidationException::withMessages([
                    "items.{$index}.discount_value" => 'Fixed sale price must be lower than the SKU price.',
                ]);
            }
        }

        return $validated;
    }

    private function salePayload(array $validated): array
    {
        return [
            'name' => trim($validated['name']),
            'starts_at' => Carbon::parse($validated['starts_at']),
            'ends_at' => Carbon::parse($validated['ends_at']),
            'is_active' => (bool) $validated['is_active'],
        ];
    }

    private function ensureNoCatalogOverlap(array $validated, ?FlashSale $ignore = null): void
    {
        if (! (bool) $validated['is_active']) {
            return;
        }

        $items = collect($validated['items'])->values();
        $skuIds = $items
            ->pluck('sku_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($skuIds->isEmpty()) {
            return;
        }

        $skus = Sku::query()
            ->with('product:id,name')
            ->whereIn('id', $skuIds->all())
            ->get()
            ->keyBy('id');

        $productIds = $skus
            ->pluck('product_id')
            ->filter()
            ->unique()
            ->values();

        if ($productIds->isEmpty()) {
            return;
        }

        $starts = Carbon::parse($validated['starts_at']);
        $ends = Carbon::parse($validated['ends_at']);

        $conflicts = FlashSaleItem::query()
            ->select('flash_sale_items.*')
            ->join('flash_sales', 'flash_sales.id', '=', 'flash_sale_items.flash_sale_id')
            ->join('skus', 'skus.id', '=', 'flash_sale_items.sku_id')
            ->where('flash_sales.is_active', true)
            ->when($ignore, fn ($query) => $query->where('flash_sales.id', '!=', $ignore->id))
            ->where('flash_sales.starts_at', '<', $ends)
            ->where('flash_sales.ends_at', '>', $starts)
            ->where(function ($query) use ($skuIds, $productIds) {
                $query
                    ->whereIn('flash_sale_items.sku_id', $skuIds->all())
                    ->orWhereIn('skus.product_id', $productIds->all());
            })
            ->with(['flashSale', 'sku.product'])
            ->get();

        if ($conflicts->isEmpty()) {
            return;
        }

        $messages = [
            'items' => 'Remove highlighted SKUs that overlap with another active flash sale.',
        ];

        foreach ($items as $index => $item) {
            $incomingSku = $skus->get((int) $item['sku_id']);
            if (! $incomingSku) {
                continue;
            }

            $conflict = $conflicts->firstWhere('sku_id', $incomingSku->id)
                ?: $conflicts->first(fn (FlashSaleItem $conflict) => (int) $conflict->sku?->product_id === (int) $incomingSku->product_id);

            if (! $conflict) {
                continue;
            }

            $saleName = $conflict->flashSale?->name ?: 'another flash sale';
            $skuCode = $incomingSku->sku_code ?: 'this SKU';
            $productName = $incomingSku->product?->name ?: 'this product';
            $messages["items.{$index}.sku_id"] = (int) $conflict->sku_id === (int) $incomingSku->id
                ? "SKU {$skuCode} is already in overlapping flash sale \"{$saleName}\"."
                : "Product {$productName} is already in overlapping flash sale \"{$saleName}\".";
        }

        if (count($messages) > 1) {
            throw ValidationException::withMessages($messages);
        }
    }

    private function syncItems(FlashSale $flashSale, array $items): void
    {
        $incomingIds = collect($items)->pluck('sku_id')->map(fn ($id) => (int) $id)->all();
        $existing = $flashSale->items()->get()->keyBy('sku_id');

        $flashSale->items()
            ->whereNotIn('sku_id', $incomingIds)
            ->delete();

        foreach ($items as $item) {
            $payload = [
                'discount_type' => $item['discount_type'],
                'discount_value' => $item['discount_value'],
                'quantity_limit' => $item['quantity_limit'] ?? null,
            ];

            $existingItem = $existing->get((int) $item['sku_id']);

            if ($existingItem) {
                $existingItem->update($payload);
            } else {
                $flashSale->items()->create(array_merge($payload, [
                    'sku_id' => (int) $item['sku_id'],
                    'sold_count' => 0,
                ]));
            }
        }
    }

    private function productOptions(): array
    {
        $products = Product::query()
            ->where('status', 'active')
            ->with(['category:id,name', 'skus' => fn ($query) => $query->where('is_active', true)->orderBy('sku_code')])
            ->orderBy('name')
            ->get(['id', 'category_id', 'name']);

        $this->storefrontInventory->attachAvailableQuantities($products);

        return $products
            ->map(fn (Product $product) => [
                'id' => $product->id,
                'name' => $product->name,
                'category' => $product->category?->name,
                'skus' => $product->skus->map(fn (Sku $sku) => [
                    'id' => $sku->id,
                    'sku_code' => $sku->sku_code,
                    'title' => $sku->title,
                    'price' => (float) $sku->price,
                    'available_qty' => $sku->available_qty,
                    'attributes' => $sku->attributes ?? [],
                ])->values(),
            ])
            ->values()
            ->all();
    }
}
