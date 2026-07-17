<?php

namespace App\Services\POS;

use App\Models\FinancialEntry;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Order;
use App\Models\Payment;
use App\Models\Sku;
use App\Models\User;
use App\Services\AuditLogService;
use App\Services\Inventory\InventoryService;
use App\Services\LoyaltyService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PosCheckoutService
{
    public function __construct(
        private InventoryService $inventoryService,
        private AuditLogService $auditLogService,
        private LoyaltyService $loyaltyService
    ) {
    }

    public function checkout(array $payload, User $cashier): Order
    {
        return DB::transaction(function () use ($payload, $cashier) {
            $location = Location::query()->where('is_active', true)->findOrFail((int) $payload['location_id']);
            if (! $cashier->canAccessLocation($location)) {
                throw ValidationException::withMessages(['location_id' => 'You cannot sell from this warehouse.']);
            }

            $lines = collect($payload['items'])->keyBy('sku_id');
            $skus = Sku::query()
                ->whereIn('id', $lines->keys()->all())
                ->where('is_active', true)
                ->with(['product' => fn ($query) => $query->where('status', 'active')])
                ->get()
                ->keyBy('id');

            $subtotal = 0.0;
            $items = [];

            foreach ($lines as $skuId => $line) {
                $sku = $skus->get((int) $skuId);
                if (! $sku || ! $sku->product) {
                    throw ValidationException::withMessages(['items' => 'One or more POS items are unavailable.']);
                }

                $quantity = (int) $line['quantity'];
                $balance = InventoryBalance::query()
                    ->where('location_id', $location->id)
                    ->where('sku_id', $sku->id)
                    ->lockForUpdate()
                    ->first();

                if (! $balance || $balance->available_qty < $quantity) {
                    throw ValidationException::withMessages([
                        'items' => "Not enough warehouse stock for {$sku->product->name} ({$sku->sku_code}).",
                    ]);
                }

                $unitPrice = round((float) ($line['unit_price'] ?? $sku->price), 2);
                if ($unitPrice < 0) {
                    throw ValidationException::withMessages(['items' => 'Unit price cannot be negative.']);
                }

                $lineTotal = round($unitPrice * $quantity, 2);
                $subtotal += $lineTotal;

                $items[] = [
                    'sku' => $sku,
                    'quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'total_price' => $lineTotal,
                ];
            }

            $discount = $this->discountAmount($payload, $subtotal, $cashier);
            $final = round(max(0, $subtotal - $discount), 2);
            $tenderType = $payload['tender_type'] ?? 'cash';

            $order = Order::create([
                'user_id' => $payload['customer_id'] ?? null,
                'order_number' => $this->number('POS'),
                'receipt_number' => $this->number('RCT'),
                'sales_channel' => 'pos',
                'location_id' => $location->id,
                'register_id' => null,
                'shift_id' => null,
                'served_by' => $cashier->id,
                'total_amount' => round($subtotal, 2),
                'discount_amount' => $discount,
                'admin_discount_type' => $payload['discount_type'] ?? null,
                'admin_discount_value' => round((float) ($payload['discount_value'] ?? 0), 2),
                'admin_discount_amount' => $discount,
                'tax_amount' => 0,
                'shipping_fee' => 0,
                'final_amount' => $final,
                'status' => 'delivered',
                'payment_status' => 'paid',
                'payment_method' => $tenderType,
                'pos_tender_summary' => [
                    'tender_type' => $tenderType,
                    'amount_tendered' => $final,
                    'change_due' => 0,
                ],
                'receiver_name' => $payload['customer_name'] ?? 'Walk-in customer',
                'receiver_phone' => $payload['customer_phone'] ?? null,
                'order_notes' => $payload['notes'] ?? null,
                'status_updated_at' => now(),
            ]);

            foreach ($items as $item) {
                $sku = $item['sku'];
                $orderItem = $order->items()->create([
                    'sku_id' => $sku->id,
                    'product_id' => $sku->product_id,
                    'quantity' => $item['quantity'],
                    'unit_price' => $item['unit_price'],
                    'total_price' => $item['total_price'],
                    'variants' => $sku->attributes ?? [],
                ]);

                $this->inventoryService->completeSale(
                    $location,
                    $sku,
                    $item['quantity'],
                    0,
                    $cashier,
                    "pos:order:{$order->id}:item:{$orderItem->id}",
                    $order
                );
            }

            Payment::create([
                'order_id' => $order->id,
                'register_id' => null,
                'shift_id' => null,
                'received_by' => $cashier->id,
                'transaction_id' => $this->paymentTransactionId(),
                'amount' => $final,
                'amount_tendered' => $final,
                'change_due' => 0,
                'method' => $tenderType,
                'tender_type' => $tenderType,
                'status' => 'paid',
                'payment_details' => $payload['payment_details'] ?? [],
            ]);

            FinancialEntry::create([
                'recorded_by' => $cashier->id,
                'type' => 'income',
                'category' => FinancialEntry::CATEGORY_POS_SALE,
                'title' => "POS sale {$order->receipt_number}",
                'amount' => $final,
                'entry_date' => now()->toDateString(),
                'payment_method' => $tenderType,
                'reference' => $order->receipt_number,
                'status' => 'approved',
                'notes' => "Auto-created from POS sale in {$location->name}.",
            ]);

            $this->auditLogService->record('pos.sale.completed', $order, [
                'receipt_number' => $order->receipt_number,
                'location_id' => $location->id,
                'total' => $final,
            ]);

            $this->loyaltyService->awardForPaidOrder($order->fresh('user'));

            return $order->fresh(['items.product', 'items.sku', 'payments', 'location', 'server', 'user']);
        }, 3);
    }

    private function discountAmount(array $payload, float $subtotal, User $cashier): float
    {
        $type = $payload['discount_type'] ?? null;
        $value = round((float) ($payload['discount_value'] ?? 0), 2);

        if (! $type || $value <= 0) {
            return 0.0;
        }

        if (! $cashier->hasAdminPermission('pos.discount')) {
            throw ValidationException::withMessages(['discount_value' => 'You cannot apply POS discounts.']);
        }

        if (! in_array($type, ['percent', 'amount'], true)) {
            throw ValidationException::withMessages(['discount_type' => 'Choose a valid discount mode.']);
        }

        $amount = $type === 'percent' ? round($subtotal * ($value / 100), 2) : $value;
        if ($amount > $subtotal) {
            throw ValidationException::withMessages(['discount_value' => 'Discount cannot exceed subtotal.']);
        }

        return $amount;
    }

    private function number(string $prefix): string
    {
        do {
            $number = $prefix.'-'.now()->format('ymd').'-'.strtoupper(Str::random(6));
        } while (Order::query()->where('order_number', $number)->orWhere('receipt_number', $number)->exists());

        return $number;
    }

    private function paymentTransactionId(): string
    {
        do {
            $id = 'PAY-'.now()->format('ymd').'-'.strtoupper(Str::random(8));
        } while (Payment::query()->where('transaction_id', $id)->exists());

        return $id;
    }
}
