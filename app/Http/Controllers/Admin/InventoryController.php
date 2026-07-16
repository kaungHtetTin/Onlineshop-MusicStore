<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\Sku;
use App\Models\StockAdjustment;
use App\Models\StockReceipt;
use App\Models\StockTransfer;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use App\Support\Spa;

class InventoryController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.view'), 403);
        $locationIds = $request->user()->accessibleLocationIds();
        $locations = Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name', 'type']);
        $categories = Category::query()->orderBy('name')->get(['id', 'name']);

        $filteredLocationIds = $this->filteredLocationIds($request, $locationIds);
        $aggregateWarehouses = $this->isAllWarehousesFilter($request);
        $query = $this->stockOverviewQuery($filteredLocationIds, $aggregateWarehouses);

        if ($request->filled('q')) {
            $term = trim($request->q);
            $query->where(function ($query) use ($term) {
                $query->where('skus.sku_code', 'like', "%{$term}%")
                    ->orWhere('skus.barcode', 'like', "%{$term}%")
                    ->orWhere('skus.title', 'like', "%{$term}%")
                    ->orWhere('products.name', 'like', "%{$term}%");
            });
        }
        if ($request->filled('category') && $request->category !== 'all') {
            $query->where('products.category_id', (int) $request->category);
        }
        if ($request->boolean('out_of_stock')) {
            $aggregateWarehouses
                ? $query->havingRaw('(SUM(COALESCE(balances.on_hand_qty, 0)) - SUM(COALESCE(balances.reserved_qty, 0))) <= 0')
                : $query->whereRaw('(COALESCE(balances.on_hand_qty, 0) - COALESCE(balances.reserved_qty, 0)) <= 0');
        }

        $paginator = $query->orderBy('products.name')
            ->orderBy('skus.sku_code')
            ->when(! $aggregateWarehouses, fn ($query) => $query->orderBy('locations.name'))
            ->paginate(30)
            ->withQueryString();
        $inTransitMap = $this->inTransitQuantities(
            $aggregateWarehouses ? $filteredLocationIds : $paginator->getCollection()->pluck('location_id')->map(fn ($id) => (int) $id)->unique()->all(),
            $paginator->getCollection()->pluck('sku_id')->map(fn ($id) => (int) $id)->unique()->all(),
            $aggregateWarehouses
        );

        $paginator->getCollection()->transform(function (object $row) use ($aggregateWarehouses, $inTransitMap) {
            $key = $aggregateWarehouses ? "all:{$row->sku_id}" : "{$row->location_id}:{$row->sku_id}";

            return $this->stockOverviewRow($row, (int) ($inTransitMap[$key] ?? 0));
        });

        return Spa::render('Admin/Inventory/Index', [
            'balances' => $paginator,
            'locations' => $locations,
            'categories' => $categories,
            'filters' => [
                'location' => $request->string('location')->toString() ?: 'all',
                'category' => $request->string('category')->toString() ?: 'all',
                'q' => $request->string('q')->toString(),
                'out_of_stock' => $request->boolean('out_of_stock'),
            ],
            'can' => [
                'history' => $request->user()->hasAdminPermission('inventory.history'),
                'receive' => $request->user()->hasAdminPermission('inventory.receive'),
                'adjust' => $request->user()->hasAdminPermission('inventory.adjust.create'),
                'transfer' => $request->user()->hasAdminPermission('inventory.transfer.create'),
                'realtimeAll' => $request->user()->hasAdminPermission('locations.manage'),
            ],
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

    public function show(Request $request, Sku $sku)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.history'), 403);
        $locationIds = $request->user()->accessibleLocationIds();
        $sku->load('product:id,name');

        $movementQuery = InventoryMovement::query()
            ->where('sku_id', $sku->id)
            ->whereIn('location_id', $locationIds)
            ->with(['location:id,code,name,type', 'creator:id,name']);

        if ($request->filled('location')) {
            $movementQuery->where('location_id', (int) $request->location);
        }
        if ($request->filled('type')) {
            $movementQuery->where('type', $request->type);
        }
        if ($request->filled('from')) {
            $movementQuery->where('occurred_at', '>=', Carbon::parse($request->from)->startOfDay());
        }
        if ($request->filled('to')) {
            $movementQuery->where('occurred_at', '<=', Carbon::parse($request->to)->endOfDay());
        }

        return Spa::render('Admin/Inventory/SkuShow', [
            'sku' => $sku,
            'balances' => InventoryBalance::query()
                ->where('sku_id', $sku->id)
                ->whereIn('location_id', $locationIds)
                ->with('location:id,code,name,type')
                ->orderBy('location_id')
                ->get(),
            'movements' => $movementQuery->latest('occurred_at')->paginate(30)->withQueryString()
                ->through(fn (InventoryMovement $movement) => array_merge($movement->toArray(), [
                    'document' => $this->movementDocument($movement),
                ])),
            'locations' => Location::query()->whereIn('id', $locationIds)->orderBy('name')->get(['id', 'code', 'name']),
            'types' => InventoryMovement::query()->where('sku_id', $sku->id)->distinct()->orderBy('type')->pluck('type'),
            'filters' => $request->only(['location', 'type', 'from', 'to']),
            'realtime' => [
                'locationIds' => $locationIds,
                'canAll' => $request->user()->hasAdminPermission('locations.manage'),
            ],
            'lastUpdated' => now()->toIso8601String(),
            'pollIntervalMs' => 20000,
        ]);
    }

    public function searchSkus(Request $request)
    {
        abort_unless(
            $request->user()->hasAdminPermission('inventory.view')
            || $request->user()->hasAdminPermission('inventory.receive')
            || $request->user()->hasAdminPermission('inventory.adjust.create')
            || $request->user()->hasAdminPermission('inventory.transfer.create'),
            403
        );

        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'paginated' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ]);
        $location = Location::findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);
        $term = trim($validated['q'] ?? '');

        $query = Sku::query()
            ->where('is_active', true)
            ->with([
                'image:id,image_path',
                'product:id,name',
                'product.primaryImage:id,product_id,image_path',
            ])
            ->when($term !== '', function ($query) use ($term) {
                $query->where(function ($query) use ($term) {
                    $query->where('sku_code', 'like', "%{$term}%")
                        ->orWhere('barcode', 'like', "%{$term}%")
                        ->orWhereHas('product', fn ($productQuery) => $productQuery->where('name', 'like', "%{$term}%"));
                });
            })
            ->when(! empty($validated['category_id']), fn ($query) => $query->whereHas('product', fn ($productQuery) => $productQuery->where('category_id', (int) $validated['category_id'])))
            ->with(['inventoryBalances' => fn ($query) => $query->where('location_id', $location->id)])
            ->orderBy(Product::select('name')->whereColumn('products.id', 'skus.product_id'))
            ->orderBy('sku_code');

        $mapSku = fn (Sku $sku) => [
            'id' => $sku->id,
            'sku_code' => $sku->sku_code,
            'barcode' => $sku->barcode,
            'product_name' => $sku->product->name,
            'title' => $sku->title,
            'image_path' => $sku->image?->image_path ?: $sku->product->primaryImage?->image_path,
            'product_image_path' => $sku->product->primaryImage?->image_path,
            'cost' => $sku->cost,
            'original_price' => $sku->cost ?? $sku->market_price,
            'market_price' => $sku->cost ?? $sku->market_price,
            'retail_price' => $sku->price,
            'price' => $sku->price,
            'wholesale_price' => $sku->wholesale_price,
            'on_hand_qty' => (int) ($sku->inventoryBalances->first()?->on_hand_qty ?? 0),
            'available_qty' => (int) ($sku->inventoryBalances->first()?->available_qty ?? 0),
        ];

        if ($request->boolean('paginated')) {
            return $query
                ->paginate((int) ($validated['per_page'] ?? 10))
                ->withQueryString()
                ->through($mapSku);
        }

        return $query
            ->limit(20)
            ->get()
            ->map($mapSku);
    }

    public function exportBalances(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.view'), 403);
        $locationIds = $request->user()->accessibleLocationIds();
        $filteredLocationIds = $this->filteredLocationIds($request, $locationIds);
        $aggregateWarehouses = $this->isAllWarehousesFilter($request);
        $rows = $this->stockOverviewQuery($filteredLocationIds, $aggregateWarehouses)
            ->orderBy('products.name')
            ->orderBy('skus.sku_code')
            ->when(! $aggregateWarehouses, fn ($query) => $query->orderBy('locations.name'))
            ->cursor();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['warehouse_code', 'warehouse_name', 'product', 'sku_code', 'on_hand', 'reserved', 'available', 'reorder_point']);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row->location_code, $row->location_name, $row->product_name,
                    $row->sku_code, $row->on_hand_qty, $row->reserved_qty,
                    $row->available_qty, $row->reorder_point,
                ]);
            }
            fclose($out);
        }, 'inventory-balances-'.now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    public function exportMovements(Request $request, Sku $sku)
    {
        abort_unless($request->user()->hasAdminPermission('inventory.history'), 403);
        $rows = InventoryMovement::query()
            ->where('sku_id', $sku->id)
            ->whereIn('location_id', $request->user()->accessibleLocationIds())
            ->with(['location:id,code', 'creator:id,name'])
            ->latest('occurred_at')->cursor();

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['occurred_at', 'location', 'type', 'quantity_delta', 'before', 'after', 'reserved_delta', 'user', 'reason', 'notes']);
            foreach ($rows as $movement) {
                fputcsv($out, [
                    $movement->occurred_at, $movement->location->code, $movement->type, $movement->quantity_delta,
                    $movement->on_hand_before, $movement->on_hand_after, $movement->reserved_delta,
                    $movement->creator?->name, $movement->reason_code, $movement->notes,
                ]);
            }
            fclose($out);
        }, "movements-{$sku->sku_code}-".now()->format('Ymd-His').'.csv', ['Content-Type' => 'text/csv']);
    }

    private function inTransitQuantities(array $locationIds, array $skuIds, bool $aggregateBySku = false): array
    {
        if (! $locationIds || ! $skuIds) {
            return [];
        }

        $outgoing = DB::table('stock_transfer_items')
            ->join('stock_transfers', 'stock_transfers.id', '=', 'stock_transfer_items.stock_transfer_id')
            ->where('stock_transfers.status', 'in_transit')
            ->whereIn('stock_transfers.source_location_id', $locationIds)
            ->whereIn('stock_transfer_items.sku_id', $skuIds)
            ->whereNotNull('stock_transfer_items.shipped_quantity')
            ->selectRaw('stock_transfers.source_location_id as location_id, stock_transfer_items.sku_id, SUM(stock_transfer_items.shipped_quantity - COALESCE(stock_transfer_items.received_quantity, 0)) as in_transit_qty')
            ->groupBy('stock_transfers.source_location_id', 'stock_transfer_items.sku_id')
            ->get();

        $incoming = DB::table('stock_transfer_items')
            ->join('stock_transfers', 'stock_transfers.id', '=', 'stock_transfer_items.stock_transfer_id')
            ->where('stock_transfers.status', 'in_transit')
            ->whereIn('stock_transfers.destination_location_id', $locationIds)
            ->whereIn('stock_transfer_items.sku_id', $skuIds)
            ->whereNotNull('stock_transfer_items.shipped_quantity')
            ->selectRaw('stock_transfers.destination_location_id as location_id, stock_transfer_items.sku_id, SUM(stock_transfer_items.shipped_quantity - COALESCE(stock_transfer_items.received_quantity, 0)) as in_transit_qty')
            ->groupBy('stock_transfers.destination_location_id', 'stock_transfer_items.sku_id')
            ->get();

        $map = [];
        foreach ($outgoing->concat($incoming) as $row) {
            $key = "{$row->location_id}:{$row->sku_id}";
            $map[$key] = ($map[$key] ?? 0) + (int) $row->in_transit_qty;
        }

        if ($aggregateBySku) {
            $skuMap = [];
            foreach ($map as $key => $quantity) {
                [, $skuId] = explode(':', $key, 2);
                $skuMap["all:{$skuId}"] = ($skuMap["all:{$skuId}"] ?? 0) + $quantity;
            }

            return $skuMap;
        }

        return $map;
    }

    private function isAllWarehousesFilter(Request $request): bool
    {
        return ! $request->filled('location') || $request->location === 'all';
    }

    private function filteredLocationIds(Request $request, array $locationIds): array
    {
        if (! $request->filled('location') || $request->location === 'all') {
            return $locationIds;
        }

        $locationId = (int) $request->location;

        return in_array($locationId, $locationIds, true) ? [$locationId] : [];
    }

    private function stockOverviewQuery(array $locationIds, bool $aggregateWarehouses = false)
    {
        $query = DB::table('skus')
            ->join('products', 'products.id', '=', 'skus.product_id')
            ->leftJoin('product_images as sku_images', 'sku_images.id', '=', 'skus.image_attachment_id')
            ->leftJoin('product_images as primary_images', function ($join) {
                $join->on('primary_images.product_id', '=', 'products.id')
                    ->where('primary_images.is_primary', true);
            });

        if ($aggregateWarehouses) {
            return $query
                ->leftJoin('inventory_balances as balances', function ($join) use ($locationIds) {
                    $join->on('balances.sku_id', '=', 'skus.id')
                        ->whereIn('balances.location_id', $locationIds);
                })
                ->select([
                    'skus.id as sku_id',
                    'skus.sku_code',
                    'skus.barcode',
                    'skus.title as sku_title',
                    'sku_images.image_path as sku_image_path',
                    'primary_images.image_path as product_image_path',
                    'products.id as product_id',
                    'products.name as product_name',
                ])
                ->selectRaw('NULL as balance_id')
                ->selectRaw('0 as location_id')
                ->selectRaw("'ALL' as location_code")
                ->selectRaw("'All warehouses' as location_name")
                ->selectRaw("'warehouse' as location_type")
                ->selectRaw('SUM(COALESCE(balances.on_hand_qty, 0)) as on_hand_qty')
                ->selectRaw('SUM(COALESCE(balances.reserved_qty, 0)) as reserved_qty')
                ->selectRaw('MAX(COALESCE(balances.reorder_point, 0)) as reorder_point')
                ->selectRaw('MAX(COALESCE(balances.par_level, 0)) as par_level')
                ->selectRaw('MAX(COALESCE(balances.version, 0)) as version')
                ->selectRaw('(SUM(COALESCE(balances.on_hand_qty, 0)) - SUM(COALESCE(balances.reserved_qty, 0))) as available_qty')
                ->groupBy([
                    'skus.id',
                    'skus.sku_code',
                    'skus.barcode',
                    'skus.title',
                    'sku_images.image_path',
                    'primary_images.image_path',
                    'products.id',
                    'products.name',
                ]);
        }

        return $query
            ->crossJoin('locations')
            ->leftJoin('inventory_balances as balances', function ($join) {
                $join->on('balances.sku_id', '=', 'skus.id')
                    ->on('balances.location_id', '=', 'locations.id');
            })
            ->whereIn('locations.id', $locationIds)
            ->select([
                'balances.id as balance_id',
                'locations.id as location_id',
                'locations.code as location_code',
                'locations.name as location_name',
                'locations.type as location_type',
                'skus.id as sku_id',
                'skus.sku_code',
                'skus.barcode',
                'skus.title as sku_title',
                'sku_images.image_path as sku_image_path',
                'primary_images.image_path as product_image_path',
                'products.id as product_id',
                'products.name as product_name',
            ])
            ->selectRaw('COALESCE(balances.on_hand_qty, 0) as on_hand_qty')
            ->selectRaw('COALESCE(balances.reserved_qty, 0) as reserved_qty')
            ->selectRaw('COALESCE(balances.reorder_point, 0) as reorder_point')
            ->selectRaw('COALESCE(balances.par_level, 0) as par_level')
            ->selectRaw('COALESCE(balances.version, 0) as version')
            ->selectRaw('(COALESCE(balances.on_hand_qty, 0) - COALESCE(balances.reserved_qty, 0)) as available_qty');
    }

    private function stockOverviewRow(object $row, int $inTransitQty): array
    {
        $locationId = (int) $row->location_id;
        $skuId = (int) $row->sku_id;

        return [
            'id' => $row->balance_id ? (int) $row->balance_id : "sku-{$skuId}-warehouse-{$locationId}",
            'balance_id' => $row->balance_id ? (int) $row->balance_id : null,
            'location_id' => $locationId,
            'sku_id' => $skuId,
            'on_hand_qty' => (int) $row->on_hand_qty,
            'reserved_qty' => (int) $row->reserved_qty,
            'available_qty' => (int) $row->available_qty,
            'reorder_point' => (int) $row->reorder_point,
            'par_level' => (int) $row->par_level,
            'version' => (int) $row->version,
            'in_transit_qty' => $inTransitQty,
            'location' => [
                'id' => $locationId,
                'code' => $row->location_code,
                'name' => $row->location_name,
                'type' => $row->location_type,
            ],
            'sku' => [
                'id' => $skuId,
                'sku_code' => $row->sku_code,
                'barcode' => $row->barcode,
                'title' => $row->sku_title,
                'image_path' => $row->sku_image_path ?: $row->product_image_path,
                'product' => [
                    'id' => (int) $row->product_id,
                    'name' => $row->product_name,
                    'primary_image_path' => $row->product_image_path,
                ],
            ],
        ];
    }

    private function movementDocument(InventoryMovement $movement): ?array
    {
        if (! $movement->reference_type || ! $movement->reference_id) {
            return null;
        }

        return match ($movement->reference_type) {
            StockReceipt::class => $this->documentLink(
                StockReceipt::query()->find($movement->reference_id),
                'receipt_number',
                'admin.inventory.receipts.show'
            ),
            StockAdjustment::class => ($adjustment = StockAdjustment::query()->find($movement->reference_id)) ? [
                'label' => $adjustment->adjustment_number,
                'href' => route('admin.inventory.adjustments.index'),
            ] : null,
            StockTransfer::class => $this->documentLink(
                StockTransfer::query()->find($movement->reference_id),
                'transfer_number',
                'admin.inventory.transfers.show'
            ),
            default => null,
        };
    }

    private function documentLink(?object $model, string $numberField, string $routeName): ?array
    {
        if (! $model) {
            return null;
        }

        return [
            'label' => $model->{$numberField},
            'href' => route($routeName, $model),
        ];
    }
}
