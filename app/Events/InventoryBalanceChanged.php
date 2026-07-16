<?php

namespace App\Events;

use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InventoryBalanceChanged implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public bool $afterCommit = true;

    public InventoryMovement $movement;

    public function __construct(InventoryMovement $movement)
    {
        $this->movement = clone $movement;
        $this->movement->loadMissing('sku');
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("inventory.location.{$this->movement->location_id}"),
            new PrivateChannel('inventory.all'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'inventory.balance.changed';
    }

    public function broadcastWith(): array
    {
        $balance = InventoryBalance::query()
            ->where('location_id', $this->movement->location_id)
            ->where('sku_id', $this->movement->sku_id)
            ->first();

        return [
            'location_id' => $this->movement->location_id,
            'sku_id' => $this->movement->sku_id,
            'balance_id' => $balance?->id,
            'version' => (int) ($balance?->version ?? 0),
            'on_hand_qty' => (int) ($balance?->on_hand_qty ?? $this->movement->on_hand_after),
            'reserved_qty' => (int) ($balance?->reserved_qty ?? $this->movement->reserved_after),
            'available_qty' => (int) ($balance?->available_qty ?? ($this->movement->on_hand_after - $this->movement->reserved_after)),
            'movement_id' => $this->movement->id,
            'movement_type' => $this->movement->type,
            'event_time' => now()->toIso8601String(),
        ];
    }
}
