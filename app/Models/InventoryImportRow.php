<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryImportRow extends Model
{
    use HasFactory;

    protected $fillable = [
        'inventory_import_id', 'row_number', 'sku_id', 'raw_data', 'quantity', 'original_price',
        'retail_price', 'wholesale_price', 'cost', 'reorder_point', 'validation_errors', 'validation_warnings',
        'status', 'movement_id', 'reference_type', 'reference_id', 'idempotency_key',
    ];

    protected $casts = [
        'raw_data' => 'array',
        'quantity' => 'integer',
        'original_price' => 'decimal:2',
        'retail_price' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'cost' => 'decimal:2',
        'reorder_point' => 'integer',
        'validation_errors' => 'array',
        'validation_warnings' => 'array',
    ];

    public function inventoryImport(): BelongsTo
    {
        return $this->belongsTo(InventoryImport::class);
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }

    public function movement(): BelongsTo
    {
        return $this->belongsTo(InventoryMovement::class, 'movement_id');
    }
}
