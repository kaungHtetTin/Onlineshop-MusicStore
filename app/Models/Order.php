<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'coupon_id',
        'coupon_code',
        'order_number',
        'voucher_public_token',
        'total_amount',
        'discount_amount',
        'admin_discount_type',
        'admin_discount_value',
        'admin_discount_amount',
        'redeemed_points',
        'earned_points',
        'loyalty_awarded_at',
        'points_restored_at',
        'tax_amount',
        'shipping_fee',
        'final_amount',
        'status',
        'payment_status',
        'payment_method',
        'payment_method_id',
        'payment_method_snapshot',
        'payment_proof_path',
        'payment_rejection_reason',
        'payment_reviewed_at',
        'payment_reviewed_by',
        'shipping_address',
        'receiver_name',
        'receiver_phone',
        'order_notes',
        'admin_notes',
        'status_updated_at',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'admin_discount_value' => 'decimal:2',
        'admin_discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'shipping_fee' => 'decimal:2',
        'final_amount' => 'decimal:2',
        'loyalty_awarded_at' => 'datetime',
        'points_restored_at' => 'datetime',
        'payment_reviewed_at' => 'datetime',
        'status_updated_at' => 'datetime',
        'payment_method_snapshot' => 'array',
    ];

    protected $appends = [
        'payment_proof_url',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function coupon(): BelongsTo
    {
        return $this->belongsTo(Coupon::class);
    }

    public function selectedPaymentMethod(): BelongsTo
    {
        return $this->belongsTo(PaymentMethod::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function returns(): HasMany
    {
        return $this->hasMany(OrderReturn::class);
    }

    public function paymentReviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'payment_reviewed_by');
    }

    public function getPaymentProofUrlAttribute(): ?string
    {
        if (! $this->payment_proof_path) {
            return null;
        }

        return \Illuminate\Support\Facades\Storage::disk('public')->url($this->payment_proof_path);
    }

    public function canReviewPayment(): bool
    {
        return $this->payment_status === 'pending_review' && $this->status !== 'cancelled';
    }
}
