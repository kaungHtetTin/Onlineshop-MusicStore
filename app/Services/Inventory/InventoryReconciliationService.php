<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
use App\Models\InventoryMovement;

class InventoryReconciliationService
{
    /**
     * @return array{mismatch_count:int, checked_balances:int, mismatches:array<int,array<string,mixed>>}
     */
    public function run(): array
    {
        $ledger = InventoryMovement::query()
            ->selectRaw('location_id, sku_id, SUM(quantity_delta) as on_hand_qty, SUM(reserved_delta) as reserved_qty')
            ->groupBy('location_id', 'sku_id')
            ->get()
            ->keyBy(fn ($row) => $row->location_id.':'.$row->sku_id);

        $balances = InventoryBalance::query()
            ->with(['location:id,code', 'sku:id,sku_code'])
            ->get();
        $mismatches = [];

        foreach ($balances as $balance) {
            $key = $balance->location_id.':'.$balance->sku_id;
            $ledgerRow = $ledger->pull($key);
            $ledgerOnHand = (int) ($ledgerRow->on_hand_qty ?? 0);
            $ledgerReserved = (int) ($ledgerRow->reserved_qty ?? 0);

            if ($ledgerOnHand !== $balance->on_hand_qty || $ledgerReserved !== $balance->reserved_qty) {
                $mismatches[] = [
                    'location_id' => $balance->location_id,
                    'location_code' => $balance->location?->code,
                    'sku_id' => $balance->sku_id,
                    'sku_code' => $balance->sku?->sku_code,
                    'balance_on_hand' => $balance->on_hand_qty,
                    'ledger_on_hand' => $ledgerOnHand,
                    'balance_reserved' => $balance->reserved_qty,
                    'ledger_reserved' => $ledgerReserved,
                ];
            }
        }

        foreach ($ledger as $row) {
            if ((int) $row->on_hand_qty === 0 && (int) $row->reserved_qty === 0) {
                continue;
            }
            $mismatches[] = [
                'location_id' => (int) $row->location_id,
                'sku_id' => (int) $row->sku_id,
                'balance_on_hand' => null,
                'ledger_on_hand' => (int) $row->on_hand_qty,
                'balance_reserved' => null,
                'ledger_reserved' => (int) $row->reserved_qty,
            ];
        }

        return [
            'mismatch_count' => count($mismatches),
            'checked_balances' => $balances->count(),
            'mismatches' => array_slice($mismatches, 0, 100),
        ];
    }
}
