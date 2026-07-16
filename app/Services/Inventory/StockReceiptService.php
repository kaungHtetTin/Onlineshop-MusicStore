<?php

namespace App\Services\Inventory;

use App\Models\FinancialEntry;
use App\Models\Location;
use App\Models\Sku;
use App\Models\StockReceipt;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockReceiptService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function createDraft(
        Location $location,
        array $lines,
        User $actor,
        ?string $supplierReference = null,
        ?string $notes = null
    ): StockReceipt {
        return DB::transaction(function () use ($location, $lines, $actor, $supplierReference, $notes) {
            $receipt = StockReceipt::create([
                'receipt_number' => $this->number(),
                'location_id' => $location->id,
                'supplier_reference' => $supplierReference,
                'status' => 'draft',
                'notes' => $notes,
                'created_by' => $actor->id,
            ]);

            foreach ($this->normalizeLines($lines) as $line) {
                $receipt->items()->create($line);
            }

            return $receipt->load('items');
        });
    }

    public function updateDraft(
        StockReceipt $receipt,
        Location $location,
        array $lines,
        ?string $supplierReference = null,
        ?string $notes = null
    ): StockReceipt {
        return DB::transaction(function () use ($receipt, $location, $lines, $supplierReference, $notes) {
            $locked = StockReceipt::query()->lockForUpdate()->findOrFail($receipt->id);
            if ($locked->status !== 'draft') {
                throw ValidationException::withMessages(['receipt' => 'Only a draft receipt can be edited.']);
            }

            $locked->update([
                'location_id' => $location->id,
                'supplier_reference' => $supplierReference,
                'notes' => $notes,
            ]);

            $locked->items()->delete();
            foreach ($this->normalizeLines($lines) as $line) {
                $locked->items()->create($line);
            }

            return $locked->fresh(['items']);
        });
    }

    public function post(StockReceipt $receipt, User $actor): StockReceipt
    {
        return DB::transaction(function () use ($receipt, $actor) {
            $locked = StockReceipt::query()->lockForUpdate()->findOrFail($receipt->id);
            if ($locked->status === 'posted') {
                return $locked->load('items');
            }
            if ($locked->status !== 'draft') {
                throw ValidationException::withMessages(['receipt' => 'Only a draft receipt can be posted.']);
            }

            $locked->load(['items.sku', 'location']);
            foreach ($locked->items as $item) {
                $movement = $this->inventoryService->receive(
                    $locked->location,
                    $item->sku,
                    $item->received_quantity,
                    $actor,
                    "receipt:{$locked->id}:item:{$item->id}",
                    $locked,
                    $item->notes
                );
                $item->update(['movement_id' => $movement->id]);

                if ($item->unit_cost !== null) {
                    $item->sku->update(['cost' => $item->unit_cost, 'market_price' => $item->unit_cost]);
                }
            }

            $locked->update([
                'status' => 'posted',
                'received_by' => $actor->id,
                'received_at' => now(),
            ]);

            $this->recordFinanceExpense($locked, $actor);

            return $locked->fresh(['items.sku.product', 'location']);
        }, 3);
    }

    public function delete(StockReceipt $receipt, User $actor): void
    {
        DB::transaction(function () use ($receipt, $actor) {
            $locked = StockReceipt::query()->lockForUpdate()->with(['items.sku', 'location'])->findOrFail($receipt->id);
            if (! in_array($locked->status, ['draft', 'posted'], true)) {
                throw ValidationException::withMessages(['receipt' => 'Only draft or posted receipts can be deleted.']);
            }

            if ($locked->status === 'posted') {
                foreach ($locked->items as $item) {
                    $this->inventoryService->adjust(
                        $locked->location,
                        $item->sku,
                        -1 * (int) $item->received_quantity,
                        'receipt_delete',
                        $actor,
                        "receipt-delete:{$locked->id}:item:{$item->id}",
                        $locked,
                        "Deleted receipt {$locked->receipt_number}."
                    );
                }
            }

            FinancialEntry::query()
                ->where('type', 'expense')
                ->where('category', FinancialEntry::CATEGORY_STOCK_RECEIPT)
                ->where('reference', $locked->receipt_number)
                ->delete();

            $locked->delete();
        }, 3);
    }

    private function recordFinanceExpense(StockReceipt $receipt, User $actor): void
    {
        $amount = $receipt->items->sum(function ($item) {
            if ($item->unit_cost === null) {
                return 0;
            }

            return (float) $item->unit_cost * (int) $item->received_quantity;
        });

        if ($amount <= 0) {
            return;
        }

        FinancialEntry::updateOrCreate(
            [
                'type' => 'expense',
                'category' => FinancialEntry::CATEGORY_STOCK_RECEIPT,
                'reference' => $receipt->receipt_number,
            ],
            [
                'recorded_by' => $actor->id,
                'title' => "Stock receipt {$receipt->receipt_number}",
                'amount' => round($amount, 2),
                'entry_date' => $receipt->received_at?->toDateString() ?? now()->toDateString(),
                'payment_method' => null,
                'status' => 'approved',
                'notes' => trim(implode("\n", array_filter([
                    $receipt->supplier_reference ? "Supplier/reference: {$receipt->supplier_reference}" : null,
                    $receipt->notes,
                ]))) ?: null,
            ]
        );
    }

    private function normalizeLines(array $lines): array
    {
        $seen = [];
        $normalized = [];
        foreach ($lines as $line) {
            $skuId = (int) $line['sku_id'];
            if (isset($seen[$skuId])) {
                throw ValidationException::withMessages(['items' => 'A SKU can appear only once per receipt.']);
            }
            $seen[$skuId] = true;

            $quantity = (int) $line['received_quantity'];
            if ($quantity <= 0 || ! Sku::query()->whereKey($skuId)->exists()) {
                throw ValidationException::withMessages(['items' => 'Every receipt line needs a valid SKU and positive quantity.']);
            }

            if (($line['unit_cost'] ?? '') !== '' && (float) $line['unit_cost'] < 0) {
                throw ValidationException::withMessages(['items' => 'Original price cannot be negative.']);
            }

            $normalized[] = [
                'sku_id' => $skuId,
                'expected_quantity' => isset($line['expected_quantity']) ? (int) $line['expected_quantity'] : null,
                'received_quantity' => $quantity,
                'unit_cost' => ($line['unit_cost'] ?? '') === '' ? null : $line['unit_cost'],
                'notes' => $line['notes'] ?? null,
            ];
        }

        if (! $normalized) {
            throw ValidationException::withMessages(['items' => 'Add at least one receipt item.']);
        }

        return $normalized;
    }

    private function number(): string
    {
        do {
            $number = 'REC-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockReceipt::query()->where('receipt_number', $number)->exists());

        return $number;
    }
}
