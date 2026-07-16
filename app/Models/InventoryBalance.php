<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryBalance extends Model
{
    use HasFactory;

    protected $fillable = [
        'location_id',
        'sku_id',
        'on_hand_qty',
        'reserved_qty',
        'reorder_point',
        'par_level',
        'version',
    ];

    protected $casts = [
        'on_hand_qty' => 'integer',
        'reserved_qty' => 'integer',
        'reorder_point' => 'integer',
        'par_level' => 'integer',
        'version' => 'integer',
    ];

    protected $appends = ['available_qty'];

    public function getAvailableQtyAttribute(): int
    {
        return $this->on_hand_qty - $this->reserved_qty;
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }
}
