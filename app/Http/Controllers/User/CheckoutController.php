<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use App\Models\Coupon;
use App\Models\Order;
use App\Models\PaymentMethod;
use App\Models\Sku;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\CouponService;
use App\Services\FlashSalePricingService;
use App\Services\LoyaltyService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class CheckoutController extends Controller
{
    public function create()
    {
        return Inertia::render('User/Checkout/Index', [
            'shop' => config('shop'),
            'paymentMethods' => PaymentMethod::active()->ordered()->get(),
            'loyalty' => [
                'points' => (int) auth()->user()->loyalty_points,
                'tier' => auth()->user()->tier,
                'redeemCurrencyPerPoint' => (float) config('loyalty.redeem_currency_per_point', 0.01),
                'minimumRedeemPoints' => (int) config('loyalty.minimum_redeem_points', 100),
            ],
        ]);
    }

    public function quote(
        Request $request,
        CouponService $couponService,
        LoyaltyService $loyaltyService,
        FlashSalePricingService $flashSalePricing,
    )
    {
        $validated = $request->validate([
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.sku_id' => ['required', 'integer', 'exists:skus,id'],
            'lines.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
        ]);

        return response()->json($this->calculateTotals(
            $validated,
            $request->user(),
            config('shop'),
            $couponService,
            $loyaltyService,
            $flashSalePricing,
        ));
    }

    public function store(
        Request $request,
        CouponService $couponService,
        LoyaltyService $loyaltyService,
        FlashSalePricingService $flashSalePricing,
        AuditLogService $auditLogService,
    )
    {
        $validated = $request->validate([
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.sku_id' => ['required', 'integer', 'exists:skus,id'],
            'lines.*.quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'lines.*.is_preorder' => ['nullable', 'boolean'],
            'receiver_name' => ['required', 'string', 'max:255'],
            'receiver_phone' => ['required', 'string', 'max:50'],
            'shipping_address' => ['required', 'string', 'max:2000'],
            'order_notes' => ['nullable', 'string', 'max:2000'],
            'payment_method_id' => ['required', 'integer', 'exists:payment_methods,id'],
            'payment_proof' => ['required', 'image', 'max:10240', 'mimes:jpg,jpeg,png,webp'],
            'coupon_code' => ['nullable', 'string', 'max:50'],
            'redeem_points' => ['nullable', 'integer', 'min:0'],
        ]);

        $paymentMethod = PaymentMethod::active()
            ->whereKey($validated['payment_method_id'])
            ->first();

        if (! $paymentMethod) {
            throw ValidationException::withMessages([
                'payment_method_id' => 'Please choose an active payment method.',
            ]);
        }

        $proofPath = $request->file('payment_proof')->store('payment-proofs', 'public');

        $shop = config('shop');

        try {
            $order = DB::transaction(function () use (
                $validated,
                $shop,
                $request,
                $proofPath,
                $couponService,
                $loyaltyService,
                $flashSalePricing,
                $auditLogService,
                $paymentMethod,
            ) {
                $user = User::query()->whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
                $linesInput = collect($validated['lines'])->keyBy('sku_id');

                $skuIds = $linesInput->keys()->all();
                $skus = Sku::query()
                    ->whereIn('id', $skuIds)
                    ->where('is_active', true)
                    ->with(['product' => function ($q) {
                        $q->where('status', 'active');
                    }])
                    ->lockForUpdate()
                    ->get()
                    ->keyBy('id');
                $saleItems = $flashSalePricing->activeItemsForSkuIds($skuIds, true);

                $orderItemsPayload = [];
                $subtotal = 0;

                foreach ($linesInput as $skuId => $row) {
                    $sku = $skus->get((int) $skuId);
                    if (! $sku || ! $sku->product) {
                        throw ValidationException::withMessages([
                            'lines' => 'One or more items are no longer available.',
                        ]);
                    }

                    $qty = (int) $row['quantity'];
                    $isPreorder = (bool) ($row['is_preorder'] ?? false);

                    if (! $isPreorder && $sku->stock_qty < $qty) {
                        throw ValidationException::withMessages([
                            'lines' => "Not enough stock for \"{$sku->product->name}\".",
                        ]);
                    }

                    $saleItem = $saleItems->get($sku->id);
                    if ($saleItem && $saleItem->remainingQuantity() !== null && $saleItem->remainingQuantity() < $qty) {
                        throw ValidationException::withMessages([
                            'lines' => "Flash sale quantity is no longer available for \"{$sku->product->name}\".",
                        ]);
                    }

                    $unit = $flashSalePricing->effectivePrice($sku, $saleItem);
                    $lineTotal = round($unit * $qty, 2);
                    $subtotal += $lineTotal;

                    $orderItemsPayload[] = [
                        'sku' => $sku,
                        'quantity' => $qty,
                        'is_preorder' => $isPreorder,
                        'unit_price' => $unit,
                        'total_price' => $lineTotal,
                        'flash_sale_item_id' => $saleItem?->id,
                    ];
                }

                $totals = $this->calculateTotals($validated, $user, $shop, $couponService, $loyaltyService, $flashSalePricing);
                $subtotal = $totals['subtotal'];
                $coupon = $couponService->findValid($validated['coupon_code'] ?? null, $subtotal);
                if ($coupon) {
                    $coupon = Coupon::query()->whereKey($coupon->id)->lockForUpdate()->firstOrFail();
                    $coupon = $couponService->findValid($coupon->code, $subtotal);
                }
                $redeemedPoints = $totals['redeemed_points'];
                $tax = $totals['tax'];
                $shipping = $totals['shipping'];
                $discount = $totals['discount'];
                $final = $totals['final'];

                $order = Order::create([
                    'user_id' => $user->id,
                    'coupon_id' => $coupon?->id,
                    'coupon_code' => $coupon?->code,
                    'order_number' => $this->makeOrderNumber(),
                    'total_amount' => $subtotal,
                    'discount_amount' => $discount,
                    'redeemed_points' => $redeemedPoints,
                    'tax_amount' => $tax,
                    'shipping_fee' => $shipping,
                    'final_amount' => $final,
                    'status' => 'pending',
                    'payment_status' => 'pending_review',
                    'payment_method' => $paymentMethod->banking_service,
                    'payment_method_id' => $paymentMethod->id,
                    'payment_method_snapshot' => $paymentMethod->snapshot(),
                    'payment_proof_path' => $proofPath,
                    'shipping_address' => $validated['shipping_address'],
                    'receiver_name' => $validated['receiver_name'],
                    'receiver_phone' => $validated['receiver_phone'],
                    'order_notes' => $validated['order_notes'] ?? null,
                ]);

                foreach ($orderItemsPayload as $row) {
                    /** @var \App\Models\Sku $sku */
                    $sku = $row['sku'];
                    $variants = $sku->attributes ?? [];
                    $variants['__preorder'] = (bool) ($row['is_preorder'] ?? false);
                    if ($row['flash_sale_item_id']) {
                        $variants['__flash_sale_item_id'] = $row['flash_sale_item_id'];
                    }

                    $order->items()->create([
                        'sku_id' => $sku->id,
                        'product_id' => $sku->product_id,
                        'quantity' => $row['quantity'],
                        'unit_price' => $row['unit_price'],
                        'total_price' => $row['total_price'],
                        'variants' => $variants,
                    ]);

                    if ($row['flash_sale_item_id']) {
                        $saleItems->firstWhere('id', $row['flash_sale_item_id'])?->increment('sold_count', $row['quantity']);
                    }
                }

                if ($coupon) {
                    $coupon->increment('used_count');
                }

                $loyaltyService->redeemForOrder($user, $order, $redeemedPoints);
                $auditLogService->record('order.created', $order, [
                    'order_number' => $order->order_number,
                    'coupon_code' => $coupon?->code,
                    'redeemed_points' => $redeemedPoints,
                ], $request);

                return $order;
            });
        } catch (ValidationException $e) {
            Storage::disk('public')->delete($proofPath);

            throw $e;
        } catch (\Throwable $e) {
            Storage::disk('public')->delete($proofPath);

            throw $e;
        }

        return redirect()
            ->route('orders.show', $order)
            ->with('success', 'Order submitted. We will verify your payment screenshot and confirm your order soon.');
    }

    private function makeOrderNumber(): string
    {
        do {
            $number = 'LP-'.now()->format('ymd').'-'.strtoupper(bin2hex(random_bytes(3)));
        } while (Order::where('order_number', $number)->exists());

        return $number;
    }

    private function calculateTotals(
        array $validated,
        User $user,
        array $shop,
        CouponService $couponService,
        LoyaltyService $loyaltyService,
        FlashSalePricingService $flashSalePricing,
    ): array {
        $linesInput = collect($validated['lines'])->keyBy('sku_id');
        $skus = Sku::query()
            ->whereIn('id', $linesInput->keys()->all())
            ->where('is_active', true)
            ->with(['product' => fn ($q) => $q->where('status', 'active')])
            ->get()
            ->keyBy('id');
        $saleItems = $flashSalePricing->activeItemsForSkuIds($linesInput->keys()->all());

        $subtotal = 0.0;
        foreach ($linesInput as $skuId => $row) {
            $sku = $skus->get((int) $skuId);
            if (! $sku || ! $sku->product) {
                throw ValidationException::withMessages([
                    'lines' => 'One or more items are no longer available.',
                ]);
            }

            $qty = (int) $row['quantity'];
            $saleItem = $saleItems->get($sku->id);
            if ($saleItem && $saleItem->remainingQuantity() !== null && $saleItem->remainingQuantity() < $qty) {
                throw ValidationException::withMessages([
                    'lines' => "Flash sale quantity is no longer available for \"{$sku->product->name}\".",
                ]);
            }

            $subtotal += $flashSalePricing->effectivePrice($sku, $saleItem) * $qty;
        }

        $subtotal = round($subtotal, 2);
        $coupon = $couponService->findValid($validated['coupon_code'] ?? null, $subtotal);
        $couponDiscount = $couponService->discountFor($coupon, $subtotal);
        $redeemedPoints = (int) ($validated['redeem_points'] ?? 0);
        $pointsValue = $loyaltyService->redemptionValue($user, $redeemedPoints);
        $taxableSubtotal = max(0, round($subtotal - $couponDiscount, 2));
        $tax = round($taxableSubtotal * (float) $shop['tax_rate'], 2);
        $shipping = $subtotal >= (float) $shop['free_shipping_minimum'] ? 0.0 : (float) $shop['shipping_flat'];
        $maxPointsValue = max(0, round($taxableSubtotal + $tax + $shipping, 2));

        if ($pointsValue > $maxPointsValue) {
            throw ValidationException::withMessages([
                'redeem_points' => 'Redeemed points exceed this order total.',
            ]);
        }

        $discount = round($couponDiscount + $pointsValue, 2);

        return [
            'subtotal' => $subtotal,
            'coupon_code' => $coupon?->code,
            'coupon_discount' => $couponDiscount,
            'redeemed_points' => $redeemedPoints,
            'points_value' => $pointsValue,
            'discount' => $discount,
            'tax' => $tax,
            'shipping' => $shipping,
            'final' => round($subtotal + $tax + $shipping - $discount, 2),
        ];
    }
}
