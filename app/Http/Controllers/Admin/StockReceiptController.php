<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Location;
use App\Models\Sku;
use App\Models\StockReceipt;
use App\Services\AuditLogService;
use App\Services\Inventory\StockReceiptService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class StockReceiptController extends Controller
{
    public function index(Request $request)
    {
        $this->authorize('viewAny', StockReceipt::class);
        return Inertia::render('Admin/Inventory/Receipts/Index', [
            'receipts' => StockReceipt::query()
                ->whereIn('location_id', $request->user()->accessibleLocationIds())
                ->with(['location:id,code,name', 'items'])
                ->latest()->paginate(20)->withQueryString(),
        ]);
    }

    public function create(Request $request)
    {
        $this->authorize('create', StockReceipt::class);
        return Inertia::render('Admin/Inventory/Receipts/Create', [
            'locations' => Location::query()->whereIn('id', $request->user()->accessibleLocationIds())->orderBy('name')->get(['id', 'code', 'name', 'type']),
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function store(Request $request, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('create', StockReceipt::class);
        $validated = $request->validate($this->receiptRules());
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $this->applySkuPriceUpdates($validated['items']);
        $receipt = $service->createDraft($location, $validated['items'], $request->user(), $validated['supplier_reference'] ?? null, $validated['notes'] ?? null);
        $audit->record('inventory.receipt.created', $receipt, ['location_id' => $location->id], $request);

        return redirect()->route('admin.inventory.receipts.show', $receipt)->with('success', 'Receipt draft created.');
    }

    public function edit(Request $request, StockReceipt $receipt)
    {
        $this->authorize('update', $receipt);
        $receipt->load([
            'items.sku.product:id,name',
            'items.sku.inventoryBalances' => fn ($query) => $query->where('location_id', $receipt->location_id),
        ]);

        return Inertia::render('Admin/Inventory/Receipts/Edit', [
            'receipt' => [
                'id' => $receipt->id,
                'receipt_number' => $receipt->receipt_number,
                'location_id' => $receipt->location_id,
                'supplier_reference' => $receipt->supplier_reference,
                'notes' => $receipt->notes,
                'items' => $receipt->items->map(fn ($item) => [
                    'sku_id' => $item->sku_id,
                    'received_quantity' => $item->received_quantity,
                    'unit_cost' => $item->unit_cost,
                    'wholesale_price' => $item->sku->wholesale_price,
                    'retail_price' => $item->sku->price,
                    'sku' => $this->receiptSkuPayload($item->sku),
                ])->values(),
            ],
            'locations' => Location::query()->whereIn('id', $request->user()->accessibleLocationIds())->orderBy('name')->get(['id', 'code', 'name', 'type']),
            'categories' => Category::query()->orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function update(Request $request, StockReceipt $receipt, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('update', $receipt);
        $validated = $request->validate($this->receiptRules());
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $this->applySkuPriceUpdates($validated['items']);
        $receipt = $service->updateDraft($receipt, $location, $validated['items'], $validated['supplier_reference'] ?? null, $validated['notes'] ?? null);
        $audit->record('inventory.receipt.updated', $receipt, ['location_id' => $location->id], $request);

        return redirect()->route('admin.inventory.receipts.show', $receipt)->with('success', 'Receipt draft updated.');
    }

    public function show(Request $request, StockReceipt $receipt)
    {
        $this->authorize('view', $receipt);
        return Inertia::render('Admin/Inventory/Receipts/Show', [
            'receipt' => $receipt->load(['location:id,code,name,type', 'items.sku.product:id,name']),
            'canEdit' => $request->user()->can('update', $receipt),
            'canPost' => $request->user()->hasAdminPermission('inventory.receive') && $receipt->status === 'draft',
            'canDelete' => $request->user()->can('delete', $receipt),
        ]);
    }

    public function post(Request $request, StockReceipt $receipt, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('update', $receipt);
        $service->post($receipt, $request->user());
        $audit->record('inventory.receipt.posted', $receipt, ['location_id' => $receipt->location_id], $request);
        return back()->with('success', 'Receipt posted and stock updated.');
    }

    public function destroy(Request $request, StockReceipt $receipt, StockReceiptService $service, AuditLogService $audit)
    {
        $this->authorize('delete', $receipt);
        $receiptNumber = $receipt->receipt_number;
        $locationId = $receipt->location_id;

        $service->delete($receipt, $request->user());
        $audit->record('inventory.receipt.deleted', null, ['receipt_number' => $receiptNumber, 'location_id' => $locationId], $request);

        return redirect()->route('admin.inventory.receipts.index')->with('success', "Receipt {$receiptNumber} deleted and stock adjusted.");
    }

    private function applySkuPriceUpdates(array $items): void
    {
        foreach ($items as $item) {
            $updates = [];
            foreach ([
                'unit_cost' => 'cost',
                'original_price' => 'cost',
                'wholesale_price' => 'wholesale_price',
                'retail_price' => 'price',
            ] as $input => $column) {
                if (array_key_exists($input, $item) && $item[$input] !== null && $item[$input] !== '') {
                    $updates[$column] = $item[$input];
                }
            }

            if (array_key_exists('cost', $updates)) {
                $updates['market_price'] = $updates['cost'];
            }

            if ($updates) {
                Sku::query()->whereKey($item['sku_id'])->update($updates);
            }
        }
    }

    private function receiptRules(): array
    {
        return [
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'supplier_reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sku_id' => ['required', 'integer', 'exists:skus,id'],
            'items.*.expected_quantity' => ['nullable', 'integer', 'min:0'],
            'items.*.received_quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_cost' => ['nullable', 'numeric', 'min:0'],
            'items.*.original_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.wholesale_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.retail_price' => ['nullable', 'numeric', 'min:0'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function receiptSkuPayload(Sku $sku): array
    {
        $balance = $sku->inventoryBalances->first();

        return [
            'id' => $sku->id,
            'sku_code' => $sku->sku_code,
            'barcode' => $sku->barcode,
            'product_name' => $sku->product->name,
            'title' => $sku->title,
            'cost' => $sku->cost,
            'original_price' => $sku->cost ?? $sku->market_price,
            'market_price' => $sku->cost ?? $sku->market_price,
            'retail_price' => $sku->price,
            'price' => $sku->price,
            'wholesale_price' => $sku->wholesale_price,
            'on_hand_qty' => (int) ($balance?->on_hand_qty ?? 0),
            'available_qty' => (int) ($balance?->available_qty ?? 0),
        ];
    }
}
