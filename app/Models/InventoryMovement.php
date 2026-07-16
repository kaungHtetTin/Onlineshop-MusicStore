<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class InventoryMovement extends Model
{
    use HasFactory;

    protected $fillable = [
        'location_id',
        'sku_id',
        'type',
        'quantity_delta',
        'reserved_delta',
        'on_hand_before',
        'on_hand_after',
        'reserved_before',
        'reserved_after',
        'reference_type',
        'reference_id',
        'reason_code',
        'notes',
        'created_by',
        'occurred_at',
        'idempotency_key',
    ];

    protected $casts = [
        'quantity_delta' => 'integer',
        'reserved_delta' => 'integer',
        'on_hand_before' => 'integer',
        'on_hand_after' => 'integer',
        'reserved_before' => 'integer',
        'reserved_after' => 'integer',
        'occurred_at' => 'datetime',
    ];

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function sku(): BelongsTo
    {
        return $this->belongsTo(Sku::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function reference(): MorphTo
    {
        return $this->morphTo();
    }
}
