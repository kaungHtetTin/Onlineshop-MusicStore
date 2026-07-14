<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderReturn extends Model
{
    use HasFactory;

    public const TYPES = ['return', 'refund', 'exchange'];

    public const STATUSES = ['requested', 'approved', 'rejected', 'received', 'refunded', 'completed'];

    protected $fillable = [
        'order_id',
        'order_item_id',
        'user_id',
        'type',
        'status',
        'quantity',
        'amount',
        'reason',
        'admin_notes',
        'processed_by',
        'processed_at',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'amount' => 'decimal:2',
        'processed_at' => 'datetime',
    ];

    public function order(): BelongsTo
    {
        return $this->belongsTo(Order::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(OrderItem::class, 'order_item_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function processor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'processed_by');
    }

    public function isProcessedStatus(): bool
    {
        return in_array($this->status, ['approved', 'rejected', 'refunded', 'completed'], true);
    }
}
