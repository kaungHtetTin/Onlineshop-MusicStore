<?php

namespace App\Services\Inventory;

use App\Events\StockTransferStatusChanged;
use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Sku;
use App\Models\StockTransfer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StockTransferService
{
    public function __construct(private InventoryService $inventoryService)
    {
    }

    public function createDraft(
        Location $source,
        Location $destination,
        array $lines,
        User $actor
    ): StockTransfer {
        return $this->transferNow($source, $destination, $lines, $actor);
    }

    public function transferNow(
        Location $source,
        Location $destination,
        array $lines,
        User $actor
    ): StockTransfer {
        if ($source->id === $destination->id) {
            throw ValidationException::withMessages(['destination_location_id' => 'Source and destination must be different.']);
        }

        $transfer = DB::transaction(function () use ($source, $destination, $lines, $actor) {
            $now = now();
            $transfer = StockTransfer::create([
                'transfer_number' => $this->number(),
                'source_location_id' => $source->id,
                'destination_location_id' => $destination->id,
                'status' => 'received',
                'created_by' => $actor->id,
                'shipped_by' => $actor->id,
                'received_by' => $actor->id,
                'shipped_at' => $now,
                'received_at' => $now,
            ]);

            foreach ($this->normalizeLines($source, $lines) as $line) {
                $item = $transfer->items()->create([
                    'sku_id' => $line['sku_id'],
                    'requested_quantity' => $line['requested_quantity'],
                    'shipped_quantity' => $line['requested_quantity'],
                    'received_quantity' => $line['requested_quantity'],
                ]);
                $sku = Sku::query()->findOrFail($line['sku_id']);

                $outMovement = $this->inventoryService->shipTransfer(
                    $source,
                    $sku,
                    $line['requested_quantity'],
                    $actor,
                    "transfer:{$transfer->id}:out:item:{$item->id}",
                    $transfer
                );

                $inMovement = $this->inventoryService->receiveTransfer(
                    $destination,
                    $sku,
                    $line['requested_quantity'],
                    $actor,
                    "transfer:{$transfer->id}:in:item:{$item->id}",
                    $transfer
                );

                $item->update([
                    'transfer_out_movement_id' => $outMovement->id,
                    'transfer_in_movement_id' => $inMovement->id,
                ]);
            }

            return $transfer->load('items.sku.product');
        }, 3);

        StockTransferStatusChanged::dispatch($transfer);

        return $transfer;
    }

    private function normalizeLines(Location $source, array $lines): array
    {
        $seen = [];
        $normalized = [];

        foreach ($lines as $line) {
            $sku = Sku::query()->find((int) $line['sku_id']);
            if (! $sku || isset($seen[$sku->id])) {
                throw ValidationException::withMessages(['items' => 'Transfer SKUs must be valid and unique.']);
            }
            $seen[$sku->id] = true;

            $quantity = (int) $line['requested_quantity'];
            if ($quantity <= 0) {
                throw ValidationException::withMessages(['items' => 'Every transfer line needs a positive quantity.']);
            }

            $available = $this->availableAtSource($source->id, $sku->id);
            if ($quantity > $available) {
                throw ValidationException::withMessages([
                    'items' => "Requested quantity for {$sku->sku_code} exceeds available stock ({$available}).",
                ]);
            }

            $normalized[] = [
                'sku_id' => $sku->id,
                'requested_quantity' => $quantity,
            ];
        }

        if (! $normalized) {
            throw ValidationException::withMessages(['items' => 'Add at least one transfer item.']);
        }

        return $normalized;
    }

    private function availableAtSource(int $locationId, int $skuId): int
    {
        $balance = InventoryBalance::query()
            ->where('location_id', $locationId)
            ->where('sku_id', $skuId)
            ->first();

        return $balance ? $balance->available_qty : 0;
    }

    private function number(): string
    {
        do {
            $number = 'TRF-'.now()->format('Ymd').'-'.strtoupper(Str::random(6));
        } while (StockTransfer::query()->where('transfer_number', $number)->exists());

        return $number;
    }
}
