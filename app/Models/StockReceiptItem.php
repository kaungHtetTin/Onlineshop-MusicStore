<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReceiptItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'stock_receipt_id', 'sku_id', 'expected_quantity', 'received_quantity', 'unit_cost', 'notes', 'movement_id',
    ];

    protected $casts = [
        'expected_quantity' => 'integer',
        'received_quantity' => 'integer',
        'unit_cost' => 'decimal:2',
    ];

    public function receipt(): BelongsTo
    {
        return $this->belongsTo(StockReceipt::class, 'stock_receipt_id');
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }
}
