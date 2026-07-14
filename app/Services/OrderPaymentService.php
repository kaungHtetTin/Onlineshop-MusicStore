<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Sku;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderPaymentService
{
    private LoyaltyService $loyaltyService;

    private AuditLogService $auditLogService;

    public function __construct(LoyaltyService $loyaltyService, AuditLogService $auditLogService)
    {
        $this->loyaltyService = $loyaltyService;
        $this->auditLogService = $auditLogService;
    }

    public function confirmPayment(Order $order, User $reviewer, array $approvalDiscount = []): Order
    {
        if ($order->payment_status !== 'pending_review') {
            throw ValidationException::withMessages([
                'order' => 'This order is not awaiting payment review.',
            ]);
        }

        if ($order->status === 'cancelled') {
            throw ValidationException::withMessages([
                'order' => 'This order has been cancelled.',
            ]);
        }

        return DB::transaction(function () use ($order, $reviewer, $approvalDiscount) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $order->load(['items.sku.product']);

            if ($order->payment_status !== 'pending_review') {
                throw ValidationException::withMessages([
                    'order' => 'This order is not awaiting payment review.',
                ]);
            }

            foreach ($order->items as $item) {
                $sku = $item->sku_id
                    ? Sku::query()->whereKey($item->sku_id)->lockForUpdate()->first()
                    : null;

                if (! $sku || ! $sku->is_active || ! $sku->product || $sku->product->status !== 'active') {
                    throw ValidationException::withMessages([
                        'order' => "Item \"{$item->product?->name}\" is no longer available.",
                    ]);
                }

                if ($sku->stock_qty < $item->quantity) {
                    throw ValidationException::withMessages([
                        'order' => "Insufficient stock for \"{$sku->product->name}\" (need {$item->quantity}, have {$sku->stock_qty}).",
                    ]);
                }
            }

            foreach ($order->items as $item) {
                if ($item->sku_id) {
                    Sku::query()->whereKey($item->sku_id)->decrement('stock_qty', $item->quantity);
                }
            }

            $discount = $this->approvalDiscountFor($order, $approvalDiscount);

            $order->forceFill([
                'discount_amount' => round((float) $order->discount_amount + $discount['amount'], 2),
                'admin_discount_type' => $discount['type'],
                'admin_discount_value' => $discount['value'],
                'admin_discount_amount' => $discount['amount'],
                'final_amount' => $discount['final_amount'],
                'payment_status' => 'paid',
                'status' => 'processing',
                'payment_rejection_reason' => null,
                'payment_reviewed_at' => now(),
                'payment_reviewed_by' => $reviewer->id,
            ])->save();

            $this->loyaltyService->awardForPaidOrder($order->fresh('user'));
            $this->auditLogService->record('order.payment_confirmed', $order, [
                'reviewer_id' => $reviewer->id,
                'order_number' => $order->order_number,
                'admin_discount_type' => $discount['type'],
                'admin_discount_value' => $discount['value'],
                'admin_discount_amount' => $discount['amount'],
            ]);

            return $order->fresh(['items.product', 'items.sku', 'user', 'paymentReviewer']);
        });
    }

    /**
     * @return array{type: ?string, value: float, amount: float, final_amount: float}
     */
    private function approvalDiscountFor(Order $order, array $approvalDiscount): array
    {
        $type = $approvalDiscount['discount_type'] ?? null;
        $value = isset($approvalDiscount['discount_value']) ? (float) $approvalDiscount['discount_value'] : 0.0;

        $currentPayable = max(0, round((float) $order->final_amount, 2));

        if ($value <= 0 || ! $type) {
            return [
                'type' => null,
                'value' => 0.0,
                'amount' => 0.0,
                'final_amount' => $currentPayable,
            ];
        }

        if (! in_array($type, ['percent', 'amount'], true)) {
            throw ValidationException::withMessages([
                'discount_type' => 'Choose a valid discount mode.',
            ]);
        }

        if ($type === 'percent' && $value > 100) {
            throw ValidationException::withMessages([
                'discount_value' => 'Percent discount cannot be greater than 100.',
            ]);
        }

        $amount = $type === 'percent'
            ? round($currentPayable * ($value / 100), 2)
            : round($value, 2);

        if ($amount > $currentPayable) {
            throw ValidationException::withMessages([
                'discount_value' => 'Discount cannot be greater than the current order total.',
            ]);
        }

        return [
            'type' => $type,
            'value' => round($value, 2),
            'amount' => $amount,
            'final_amount' => round($currentPayable - $amount, 2),
        ];
    }

    public function rejectPayment(Order $order, User $reviewer, ?string $reason = null): Order
    {
        if ($order->payment_status !== 'pending_review') {
            throw ValidationException::withMessages([
                'order' => 'This order is not awaiting payment review.',
            ]);
        }

        return DB::transaction(function () use ($order, $reviewer, $reason) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($order->payment_status !== 'pending_review') {
                throw ValidationException::withMessages([
                    'order' => 'This order is not awaiting payment review.',
                ]);
            }

            $order->forceFill([
                'payment_status' => 'rejected',
                'status' => 'cancelled',
                'payment_rejection_reason' => $reason ?: 'Payment could not be verified. Please place a new order with a valid transfer screenshot.',
                'payment_reviewed_at' => now(),
                'payment_reviewed_by' => $reviewer->id,
            ])->save();

            $this->loyaltyService->restoreRedeemedPoints($order->fresh('user'), 'Payment rejected');
            $this->auditLogService->record('order.payment_rejected', $order, [
                'reviewer_id' => $reviewer->id,
                'reason' => $reason,
                'order_number' => $order->order_number,
            ]);

            return $order->fresh(['items.product', 'items.sku', 'user', 'paymentReviewer']);
        });
    }
}
