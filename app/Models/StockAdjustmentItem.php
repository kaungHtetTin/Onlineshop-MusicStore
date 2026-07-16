<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockAdjustmentItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_adjustment_id', 'sku_id', 'system_quantity', 'counted_quantity', 'quantity_delta', 'notes', 'movement_id',
    ];

    protected $casts = [
        'system_quantity' => 'integer',
        'counted_quantity' => 'integer',
        'quantity_delta' => 'integer',
    ];

    public function adjustment(): BelongsTo
    {
        return $this->belongsTo(StockAdjustment::class, 'stock_adjustment_id');
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }
}
