<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Sku;
use App\Models\StockAdjustment;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockAdjustmentService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function createPosted(
        Location $location,
        array $lines,
        string $reasonCode,
        User $actor,
        ?string $notes = null
    ): StockAdjustment {
        return DB::transaction(function () use ($location, $lines, $reasonCode, $actor, $notes) {
            $normalized = $this->normalizeLines($location, $lines);

            $adjustment = StockAdjustment::create([
                'adjustment_number' => $this->number(),
                'location_id' => $location->id,
                'reason_code' => $reasonCode,
                'status' => 'posted',
                'notes' => $notes,
                'requires_approval' => false,
                'created_by' => $actor->id,
                'posted_by' => $actor->id,
                'posted_at' => now(),
            ]);

            foreach ($normalized as $line) {
                $item = $adjustment->items()->create($line);
                if ((int) $line['quantity_delta'] !== 0) {
                    $sku = Sku::query()->findOrFail((int) $line['sku_id']);
                    $movement = $this->inventoryService->adjust(
                        $location,
                        $sku,
                        (int) $line['quantity_delta'],
                        $reasonCode,
                        $actor,
                        "adjustment:{$adjustment->id}:item:{$item->id}",
                        $adjustment,
                        $line['notes'] ?? null
                    );
                    $item->update(['movement_id' => $movement->id]);
                }
            }

            return $adjustment->fresh(['items.sku.product', 'location']);
        }, 3);
    }

    private function normalizeLines(Location $location, array $lines): array
    {
        $seen = [];
        $normalized = [];
        foreach ($lines as $line) {
            $sku = Sku::query()->find((int) $line['sku_id']);
            if (! $sku || isset($seen[$sku->id])) {
                throw ValidationException::withMessages(['items' => 'Adjustment SKUs must be valid and unique.']);
            }
            $seen[$sku->id] = true;

            $counted = (int) $line['counted_quantity'];
            if ($counted < 0) {
                throw ValidationException::withMessages(['items' => 'Counted quantity cannot be negative.']);
            }
            $this->inventoryService->ensureBalance($location, $sku);
            $balance = InventoryBalance::query()
                ->where('location_id', $location->id)
                ->where('sku_id', $sku->id)
                ->lockForUpdate()
                ->firstOrFail();
            $system = (int) $balance->on_hand_qty;

            $delta = $counted - $system;
            if ($delta < 0 && blank($line['notes'] ?? null)) {
                throw ValidationException::withMessages(['items' => 'A note is required for stock losses.']);
            }

            $normalized[] = [
                'sku_id' => $sku->id,
                'system_quantity' => $system,
                'counted_quantity' => $counted,
                'quantity_delta' => $delta,
                'notes' => $line['notes'] ?? null,
            ];
        }

        if (! $normalized) {
            throw ValidationException::withMessages(['items' => 'Add at least one adjustment item.']);
        }

        return $normalized;
    }

    private function number(): string
    {
        do {
            $number = 'ADJ-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockAdjustment::query()->where('adjustment_number', $number)->exists());

        return $number;
    }
}
