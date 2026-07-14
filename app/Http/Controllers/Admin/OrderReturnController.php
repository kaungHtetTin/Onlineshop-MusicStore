<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\OrderReturn;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrderReturnController extends Controller
{
    public function store(Request $request, Order $order, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
            'type' => ['required', 'string', Rule::in(OrderReturn::TYPES)],
            'status' => ['required', 'string', Rule::in(OrderReturn::STATUSES)],
            'order_item_id' => ['nullable', 'integer', 'exists:order_items,id'],
            'quantity' => ['required', 'integer', 'min:1', 'max:999'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string', 'max:2000'],
            'admin_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $this->ensureItemBelongsToOrder($order, $validated['order_item_id'] ?? null);

        $record = $order->returns()->create([
            'user_id' => $order->user_id,
            'type' => $validated['type'],
            'status' => $validated['status'],
            'order_item_id' => $validated['order_item_id'] ?? null,
            'quantity' => (int) $validated['quantity'],
            'amount' => round((float) ($validated['amount'] ?? 0), 2),
            'reason' => $validated['reason'] ?? null,
            'admin_notes' => $validated['admin_notes'] ?? null,
            'processed_by' => in_array($validated['status'], ['approved', 'rejected', 'refunded', 'completed'], true) ? $request->user()->id : null,
            'processed_at' => in_array($validated['status'], ['approved', 'rejected', 'refunded', 'completed'], true) ? now() : null,
        ]);

        $auditLogService->record('order.return_created', $order, [
            'order_number' => $order->order_number,
            'return_id' => $record->id,
            'type' => $record->type,
            'status' => $record->status,
            'amount' => $record->amount,
        ], $request);

        return back()->with('success', 'Return/refund record added.');
    }

    public function update(Request $request, OrderReturn $orderReturn, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
            'status' => ['required', 'string', Rule::in(OrderReturn::STATUSES)],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'admin_notes' => ['nullable', 'string', 'max:5000'],
        ]);

        $orderReturn->forceFill([
            'status' => $validated['status'],
            'amount' => round((float) ($validated['amount'] ?? $orderReturn->amount), 2),
            'admin_notes' => $validated['admin_notes'] ?? $orderReturn->admin_notes,
            'processed_by' => in_array($validated['status'], ['approved', 'rejected', 'refunded', 'completed'], true) ? $request->user()->id : $orderReturn->processed_by,
            'processed_at' => in_array($validated['status'], ['approved', 'rejected', 'refunded', 'completed'], true) ? now() : $orderReturn->processed_at,
        ])->save();

        $order = $orderReturn->order()->firstOrFail();
        $auditLogService->record('order.return_updated', $order, [
            'order_number' => $order->order_number,
            'return_id' => $orderReturn->id,
            'status' => $orderReturn->status,
            'amount' => $orderReturn->amount,
        ], $request);

        return back()->with('success', 'Return/refund record updated.');
    }

    private function ensureItemBelongsToOrder(Order $order, ?int $itemId): void
    {
        if (! $itemId) {
            return;
        }

        $exists = OrderItem::query()
            ->whereKey($itemId)
            ->where('order_id', $order->id)
            ->exists();

        if (! $exists) {
            throw ValidationException::withMessages([
                'order_item_id' => 'Choose an item from this order.',
            ]);
        }
    }
}
