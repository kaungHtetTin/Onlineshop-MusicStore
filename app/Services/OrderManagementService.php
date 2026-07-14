<?php

namespace App\Services;

use App\Models\Order;
use App\Models\FlashSaleItem;
use App\Models\Sku;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class OrderManagementService
{
    private LoyaltyService $loyaltyService;

    private AuditLogService $auditLogService;

    public function __construct(LoyaltyService $loyaltyService, AuditLogService $auditLogService)
    {
        $this->loyaltyService = $loyaltyService;
        $this->auditLogService = $auditLogService;
    }

    /** @var array<string, list<string>> */
    private const STATUS_TRANSITIONS = [
        'pending' => ['processing', 'cancelled'],
        'processing' => ['shipped', 'cancelled'],
        'shipped' => ['delivered', 'cancelled'],
        'delivered' => [],
        'cancelled' => [],
    ];

    public function updateStatus(Order $order, string $newStatus): Order
    {
        $newStatus = strtolower($newStatus);

        if (! in_array($newStatus, config('orders.statuses'), true)) {
            throw ValidationException::withMessages([
                'status' => 'Invalid order status.',
            ]);
        }

        if ($order->status === $newStatus) {
            return $order;
        }

        if ($order->status === 'cancelled') {
            throw ValidationException::withMessages([
                'status' => 'Cancelled orders cannot be updated.',
            ]);
        }

        if ($order->payment_status === 'pending_review' && $newStatus !== 'cancelled') {
            throw ValidationException::withMessages([
                'status' => 'Confirm or reject payment before changing fulfillment status.',
            ]);
        }

        if ($order->payment_status === 'rejected') {
            throw ValidationException::withMessages([
                'status' => 'This order payment was rejected.',
            ]);
        }

        $allowed = self::STATUS_TRANSITIONS[$order->status] ?? [];

        if (! in_array($newStatus, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => "Cannot change status from {$order->status} to {$newStatus}.",
            ]);
        }

        if (in_array($newStatus, ['processing', 'shipped', 'delivered'], true) && $order->payment_status !== 'paid') {
            throw ValidationException::withMessages([
                'status' => 'Payment must be confirmed before fulfillment updates.',
            ]);
        }

        return DB::transaction(function () use ($order, $newStatus) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();

            if ($newStatus === 'cancelled') {
                return $this->cancelOrder($order, null, restoreStock: $order->payment_status === 'paid');
            }

            $order->forceFill([
                'status' => $newStatus,
                'status_updated_at' => now(),
            ])->save();

            $this->auditLogService->record('order.status_updated', $order, [
                'status' => $newStatus,
                'order_number' => $order->order_number,
            ]);

            return $order->fresh(['items.product', 'items.sku', 'user', 'paymentReviewer']);
        });
    }

    public function cancelOrder(Order $order, ?User $actor = null, ?string $reason = null, bool $restoreStock = true): Order
    {
        if ($order->status === 'cancelled') {
            throw ValidationException::withMessages([
                'order' => 'Order is already cancelled.',
            ]);
        }

        return DB::transaction(function () use ($order, $actor, $reason, $restoreStock) {
            $order = Order::query()->whereKey($order->id)->lockForUpdate()->firstOrFail();
            $order->load('items');

            if ($order->status === 'cancelled') {
                throw ValidationException::withMessages([
                    'order' => 'Order is already cancelled.',
                ]);
            }

            if ($restoreStock && $order->payment_status === 'paid') {
                foreach ($order->items as $item) {
                    if ($item->sku_id) {
                        Sku::query()->whereKey($item->sku_id)->increment('stock_qty', $item->quantity);
                    }
                }
            }

            foreach ($order->items as $item) {
                $flashSaleItemId = $item->variants['__flash_sale_item_id'] ?? null;
                if ($flashSaleItemId) {
                    FlashSaleItem::query()
                        ->whereKey($flashSaleItemId)
                        ->where('sold_count', '>=', $item->quantity)
                        ->decrement('sold_count', $item->quantity);
                }
            }

            $updates = [
                'status' => 'cancelled',
                'status_updated_at' => now(),
            ];

            if ($order->payment_status === 'pending_review') {
                $updates['payment_status'] = 'rejected';
                $updates['payment_rejection_reason'] = $reason ?: 'Order cancelled by admin.';
                $updates['payment_reviewed_at'] = now();
                if ($actor) {
                    $updates['payment_reviewed_by'] = $actor->id;
                }
            } elseif ($reason) {
                $updates['payment_rejection_reason'] = $reason;
            }

            $order->forceFill($updates)->save();

            $this->loyaltyService->restoreRedeemedPoints($order->fresh('user'), 'Order cancelled');
            $this->auditLogService->record('order.cancelled', $order, [
                'reason' => $reason,
                'restored_stock' => $restoreStock,
                'order_number' => $order->order_number,
            ]);

            return $order->fresh(['items.product', 'items.sku', 'user', 'paymentReviewer']);
        });
    }

    public function updateAdminNotes(Order $order, ?string $notes): Order
    {
        $order->forceFill(['admin_notes' => $notes ?: null])->save();

        $this->auditLogService->record('order.notes_updated', $order, [
            'order_number' => $order->order_number,
        ]);

        return $order->fresh(['items.product', 'items.sku', 'user', 'paymentReviewer']);
    }

    /**
     * @return array{total: int, pending_payment: int, processing: int, shipped: int, delivered: int, cancelled: int, revenue_paid: float}
     */
    public function stats(): array
    {
        return [
            'total' => Order::count(),
            'pending_payment' => Order::where('payment_status', 'pending_review')->count(),
            'processing' => Order::where('status', 'processing')->where('payment_status', 'paid')->count(),
            'shipped' => Order::where('status', 'shipped')->count(),
            'delivered' => Order::where('status', 'delivered')->count(),
            'cancelled' => Order::where('status', 'cancelled')->count(),
            'revenue_paid' => (float) Order::where('payment_status', 'paid')->sum('final_amount'),
        ];
    }
}
