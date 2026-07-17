<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\HeldCart;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Order;
use App\Models\PosRegister;
use App\Models\PosShift;
use App\Models\Sku;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\POS\PosCheckoutService;
use App\Services\POS\PosShiftService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use App\Support\Spa;

class PosController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access') && config('inventory.pos_enabled', true), 403);

        $locationIds = $request->user()->accessibleLocationIds();
        $locations = Location::query()
            ->whereIn('id', $locationIds)
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'code', 'name', 'type']);

        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'parent_id', 'name']);

        return Spa::render('Admin/POS/Index', [
            'locations' => $locations,
            'categories' => $categories,
            'can' => [
                'discount' => $request->user()->hasAdminPermission('pos.discount'),
            ],
            'taxRate' => (float) config('shop.tax_rate', 0),
        ]);
    }

    public function products(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access'), 403);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'q' => ['nullable', 'string', 'max:120'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:12', 'max:60'],
        ]);

        $location = Location::query()->where('is_active', true)->findOrFail($validated['location_id']);
        abort_unless($request->user()->canAccessLocation($location), 403);

        $term = trim($validated['q'] ?? '');
        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? 24);

        $products = Sku::query()
            ->where('is_active', true)
            ->with([
                'image:id,product_id,image_path',
                'product:id,name,status,category_id',
                'product.primaryImage:id,product_id,image_path',
                'inventoryBalances' => fn ($query) => $query->where('location_id', $location->id),
            ])
            ->withSum([
                'orderItems as pos_sold_qty' => fn ($query) => $query->whereHas('order', fn ($order) => $order
                    ->where('sales_channel', 'pos')
                    ->where('location_id', $location->id)),
            ], 'quantity')
            ->when(! empty($validated['category_id']), function ($query) use ($validated) {
                $query->whereHas('product', fn ($product) => $product->where('category_id', $validated['category_id']));
            })
            ->when($term !== '', function ($query) use ($term) {
                $query->where(function ($inner) use ($term) {
                    $inner->where('sku_code', 'like', "%{$term}%")
                        ->orWhere('barcode', 'like', "%{$term}%")
                        ->orWhereHas('product', fn ($product) => $product->where('name', 'like', "%{$term}%"));
                });
            })
            ->whereHas('product', fn ($product) => $product->where('status', 'active')->where('is_active', true))
            ->when($term !== '', function ($query) use ($term) {
                $query->orderByRaw(
                    'CASE WHEN skus.barcode = ? THEN 0 WHEN skus.sku_code = ? THEN 1 ELSE 2 END',
                    [$term, $term]
                );
            })
            ->orderByDesc('pos_sold_qty')
            ->orderBy('sku_code')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage + 1)
            ->get()
            ->map(function (Sku $sku) {
                $balance = $sku->inventoryBalances->first();

                return [
                    'id' => $sku->id,
                    'sku_code' => $sku->sku_code,
                    'barcode' => $sku->barcode,
                    'title' => $sku->title,
                    'product_name' => $sku->product->name,
                    'image_path' => $sku->image?->image_path ?: $sku->product->primaryImage?->image_path,
                    'price' => (float) $sku->price,
                    'wholesale_price' => $sku->wholesale_price !== null ? (float) $sku->wholesale_price : null,
                    'available_qty' => (int) ($balance?->available_qty ?? 0),
                    'sold_qty' => (int) ($sku->pos_sold_qty ?? 0),
                ];
            });

        $hasMore = $products->count() > $perPage;

        return [
            'data' => $products->take($perPage)->values(),
            'meta' => [
                'page' => $page,
                'per_page' => $perPage,
                'has_more' => $hasMore,
                'next_page' => $hasMore ? $page + 1 : null,
                'mode' => $term === '' ? 'popular' : 'search',
            ],
        ];
    }

    public function customers(Request $request)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access'), 403);
        $term = trim($request->string('q')->toString());

        return User::query()
            ->where('role', User::CUSTOMER_ROLE)
            ->when($term !== '', function ($query) use ($term) {
                $like = "%{$term}%";
                $query->where(fn ($inner) => $inner->where('name', 'like', $like)->orWhere('email', 'like', $like)->orWhere('phone', 'like', $like));
            })
            ->orderBy('name')
            ->limit(20)
            ->get(['id', 'name', 'email', 'phone']);
    }

    public function openShift(Request $request, PosShiftService $service)
    {
        abort_unless($request->user()->hasAdminPermission('pos.shift.open'), 403);
        $validated = $request->validate([
            'register_id' => ['required', 'integer', 'exists:pos_registers,id'],
            'opening_cash' => ['required', 'numeric', 'min:0'],
        ]);

        $shift = $service->open(PosRegister::with('location')->findOrFail($validated['register_id']), $request->user(), (float) $validated['opening_cash']);

        return response()->json(['shift' => $shift]);
    }

    public function closeShift(Request $request, PosShiftService $service)
    {
        abort_unless($request->user()->hasAdminPermission('pos.shift.close'), 403);
        $validated = $request->validate([
            'shift_id' => ['required', 'integer', 'exists:pos_shifts,id'],
            'counted_cash' => ['required', 'numeric', 'min:0'],
            'closing_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $shift = $service->close(PosShift::findOrFail($validated['shift_id']), $request->user(), (float) $validated['counted_cash'], $validated['closing_notes'] ?? null);

        return response()->json(['shift' => $shift]);
    }

    public function checkout(Request $request, PosCheckoutService $service)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access'), 403);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.sku_id' => ['required', 'integer', 'exists:skus,id'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'items.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'discount_type' => ['nullable', 'string', Rule::in(['percent', 'amount'])],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'tender_type' => ['required', 'string', Rule::in(['cash', 'card', 'mobile'])],
            'payment_details' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            $order = $service->checkout($validated, $request->user());
        } catch (ValidationException $exception) {
            return response()->json(['errors' => $exception->errors()], 422);
        }

        return response()->json([
            'order' => $order,
            'receipt_url' => route('admin.pos.orders.receipt', $order),
        ]);
    }

    public function holdCart(Request $request, AuditLogService $audit)
    {
        abort_unless($request->user()->hasAdminPermission('pos.hold'), 403);
        $validated = $request->validate([
            'location_id' => ['required', 'integer', 'exists:locations,id'],
            'register_id' => ['required', 'integer', 'exists:pos_registers,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'label' => ['nullable', 'string', 'max:80'],
            'cart_payload' => ['required', 'array'],
        ]);

        $register = PosRegister::query()->with('location')->findOrFail($validated['register_id']);
        abort_unless((int) $register->location_id === (int) $validated['location_id'] && $request->user()->canAccessLocation($register->location), 403);

        $cart = HeldCart::create([
            'location_id' => $register->location_id,
            'pos_register_id' => $register->id,
            'cashier_id' => $request->user()->id,
            'customer_id' => $validated['customer_id'] ?? null,
            'label' => $validated['label'] ?: 'Held cart',
            'cart_payload' => $validated['cart_payload'],
            'expires_at' => now()->addDay(),
        ]);

        $audit->record('pos.cart.held', $cart, ['register_id' => $register->id], $request);

        return response()->json(['heldCart' => $cart, 'heldCarts' => $this->heldCarts($request)]);
    }

    public function deleteHeldCart(Request $request, HeldCart $heldCart)
    {
        abort_unless($request->user()->hasAdminPermission('pos.hold'), 403);
        abort_unless((int) $heldCart->cashier_id === (int) $request->user()->id || $request->user()->hasAdminPermission('pos.void'), 403);

        $heldCart->delete();

        return response()->json(['heldCarts' => $this->heldCarts($request)]);
    }

    public function receipt(Request $request, Order $order)
    {
        abort_unless($request->user()->hasAdminPermission('pos.access') || $request->user()->hasAdminPermission('orders.view'), 403);
        abort_unless($order->sales_channel === 'pos', 404);

        $order->load(['items.product', 'items.sku', 'payments', 'location', 'register', 'shift.cashier', 'server', 'user']);

        return Spa::render('Admin/POS/Receipt', ['order' => $order]);
    }

    private function heldCarts(Request $request)
    {
        return HeldCart::query()
            ->where('cashier_id', $request->user()->id)
            ->where(fn ($query) => $query->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->with(['register:id,code,name', 'location:id,code,name', 'customer:id,name,email,phone'])
            ->latest()
            ->get();
    }
}
