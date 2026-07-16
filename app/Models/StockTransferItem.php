<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransferItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_transfer_id',
        'sku_id',
        'requested_quantity',
        'shipped_quantity',
        'received_quantity',
        'discrepancy_reason',
        'notes',
        'transfer_out_movement_id',
        'transfer_in_movement_id',
    ];

    protected $casts = [
        'requested_quantity' => 'integer',
        'shipped_quantity' => 'integer',
        'received_quantity' => 'integer',
    ];

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class, 'stock_transfer_id');
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }

    public function transferOutMovement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class, 'transfer_out_movement_id');
    }

    public function transferInMovement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class, 'transfer_in_movement_id');
    }

    public function inTransitQuantity(): int
    {
        if ($this->shipped_quantity === null) {
            return 0;
        }

        return max(0, $this->shipped_quantity - (int) ($this->received_quantity ?? 0));
    }
}
