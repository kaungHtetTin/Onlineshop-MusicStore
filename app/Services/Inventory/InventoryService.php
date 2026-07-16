<?php

namespace App\Services\Inventory;

use App\Events\InventoryBalanceChanged;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Sku;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class InventoryService
{
    public function ensureBalance(Location $location, Sku $sku): InventoryBalance
    {
        $now = now();

        DB::table('inventory_balances')->insertOrIgnore([
            'location_id' => $location->id,
            'sku_id' => $sku->id,
            'on_hand_qty' => 0,
            'reserved_qty' => 0,
            'reorder_point' => 0,
            'version' => 0,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return InventoryBalance::query()
            ->where('location_id', $location->id)
            ->where('sku_id', $sku->id)
            ->firstOrFail();
    }

    public function openingBalance(
        Location $location,
        Sku $sku,
        int $quantity,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?string $notes = null
    ): InventoryMovement {
        if ($quantity < 0) {
            throw ValidationException::withMessages(['quantity' => 'Opening quantity cannot be negative.']);
        }

        return $this->mutate($location, $sku, 'opening_balance', $quantity, 0, $actor, $idempotencyKey, null, 'opening_balance', $notes);
    }

    public function receive(
        Location $location,
        Sku $sku,
        int $quantity,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null,
        ?string $notes = null
    ): InventoryMovement {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Received quantity must be greater than zero.']);
        }

        return $this->mutate($location, $sku, 'receipt', $quantity, 0, $actor, $idempotencyKey, $reference, 'receipt', $notes);
    }

    public function adjust(
        Location $location,
        Sku $sku,
        int $quantityDelta,
        string $reasonCode,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null,
        ?string $notes = null
    ): InventoryMovement {
        if ($quantityDelta === 0) {
            throw ValidationException::withMessages(['quantity' => 'Adjustment quantity cannot be zero.']);
        }

        $type = $quantityDelta > 0 ? 'adjustment_gain' : 'adjustment_loss';

        return $this->mutate($location, $sku, $type, $quantityDelta, 0, $actor, $idempotencyKey, $reference, $reasonCode, $notes);
    }

    public function reserve(
        Location $location,
        Sku $sku,
        int $quantity,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null
    ): InventoryMovement {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Reservation quantity must be greater than zero.']);
        }

        return $this->mutate($location, $sku, 'reservation', 0, $quantity, $actor, $idempotencyKey, $reference, 'reservation');
    }

    public function releaseReservation(
        Location $location,
        Sku $sku,
        int $quantity,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null
    ): InventoryMovement {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Released quantity must be greater than zero.']);
        }

        return $this->mutate($location, $sku, 'reservation_release', 0, -$quantity, $actor, $idempotencyKey, $reference, 'reservation_release');
    }

    public function completeSale(
        Location $location,
        Sku $sku,
        int $quantity,
        int $reservedQuantity = 0,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null
    ): InventoryMovement {
        if ($quantity <= 0 || $reservedQuantity < 0 || $reservedQuantity > $quantity) {
            throw ValidationException::withMessages(['quantity' => 'Sale and reservation quantities are invalid.']);
        }

        return $this->mutate(
            $location,
            $sku,
            'sale',
            -$quantity,
            -$reservedQuantity,
            $actor,
            $idempotencyKey,
            $reference,
            'sale'
        );
    }

    public function returnSale(
        Location $location,
        Sku $sku,
        int $quantity,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null
    ): InventoryMovement {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Returned quantity must be greater than zero.']);
        }

        return $this->mutate(
            $location,
            $sku,
            'sale_return',
            $quantity,
            0,
            $actor,
            $idempotencyKey,
            $reference,
            'sale_return'
        );
    }

    public function shipTransfer(
        Location $source,
        Sku $sku,
        int $quantity,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null,
        ?string $notes = null
    ): InventoryMovement {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Shipped quantity must be greater than zero.']);
        }

        return $this->mutate(
            $source,
            $sku,
            'transfer_out',
            -$quantity,
            0,
            $actor,
            $idempotencyKey,
            $reference,
            'transfer_out',
            $notes
        );
    }

    public function receiveTransfer(
        Location $destination,
        Sku $sku,
        int $quantity,
        ?User $actor = null,
        ?string $idempotencyKey = null,
        ?Model $reference = null,
        ?string $notes = null
    ): InventoryMovement {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Received quantity must be greater than zero.']);
        }

        return $this->mutate(
            $destination,
            $sku,
            'transfer_in',
            $quantity,
            0,
            $actor,
            $idempotencyKey,
            $reference,
            'transfer_in',
            $notes
        );
    }

    private function mutate(
        Location $location,
        Sku $sku,
        string $type,
        int $quantityDelta,
        int $reservedDelta,
        ?User $actor,
        ?string $idempotencyKey,
        ?Model $reference,
        ?string $reasonCode,
        ?string $notes = null
    ): InventoryMovement {
        $result = DB::transaction(function () use (
            $location,
            $sku,
            $type,
            $quantityDelta,
            $reservedDelta,
            $actor,
            $idempotencyKey,
            $reference,
            $reasonCode,
            $notes
        ) {
            $this->ensureBalance($location, $sku);

            $balance = InventoryBalance::query()
                ->where('location_id', $location->id)
                ->where('sku_id', $sku->id)
                ->lockForUpdate()
                ->firstOrFail();

            if ($idempotencyKey) {
                $existing = InventoryMovement::query()
                    ->where('idempotency_key', $idempotencyKey)
                    ->first();

                if ($existing) {
                    if (
                        $existing->location_id !== $location->id
                        || $existing->sku_id !== $sku->id
                        || $existing->type !== $type
                        || $existing->quantity_delta !== $quantityDelta
                        || $existing->reserved_delta !== $reservedDelta
                    ) {
                        throw ValidationException::withMessages([
                            'idempotency_key' => 'This idempotency key was already used for a different inventory operation.',
                        ]);
                    }

                    return ['movement' => $existing, 'created' => false];
                }
            }

            $onHandAfter = $balance->on_hand_qty + $quantityDelta;
            $reservedAfter = $balance->reserved_qty + $reservedDelta;

            if ($reservedAfter < 0) {
                throw ValidationException::withMessages(['quantity' => 'Cannot release more stock than is reserved.']);
            }

            if (! config('inventory.allow_negative_stock', false) && $onHandAfter < 0) {
                throw ValidationException::withMessages(['quantity' => 'Insufficient on-hand stock for this operation.']);
            }

            if (! config('inventory.allow_negative_stock', false) && $reservedAfter > $onHandAfter) {
                throw ValidationException::withMessages(['quantity' => 'Insufficient available stock for this operation.']);
            }

            $onHandBefore = $balance->on_hand_qty;
            $reservedBefore = $balance->reserved_qty;

            $balance->update([
                'on_hand_qty' => $onHandAfter,
                'reserved_qty' => $reservedAfter,
                'version' => $balance->version + 1,
            ]);

            $movement = InventoryMovement::create([
                'location_id' => $location->id,
                'sku_id' => $sku->id,
                'type' => $type,
                'quantity_delta' => $quantityDelta,
                'reserved_delta' => $reservedDelta,
                'on_hand_before' => $onHandBefore,
                'on_hand_after' => $onHandAfter,
                'reserved_before' => $reservedBefore,
                'reserved_after' => $reservedAfter,
                'reference_type' => $reference?->getMorphClass(),
                'reference_id' => $reference?->getKey(),
                'reason_code' => $reasonCode,
                'notes' => $notes,
                'created_by' => $actor?->id,
                'occurred_at' => now(),
                'idempotency_key' => $idempotencyKey,
            ]);

            return ['movement' => $movement, 'created' => true];
        }, 3);

        if ($result['created']) {
            InventoryBalanceChanged::dispatch($result['movement']);
        }

        return $result['movement'];
    }
}
