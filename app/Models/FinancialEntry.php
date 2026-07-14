<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialEntry extends Model
{
    use HasFactory;

    public const TYPES = ['income', 'expense'];

    public const STATUSES = ['pending', 'approved', 'void'];

    public const INCOME_CATEGORIES = [
        'other_income' => 'Other income',
        'service_fee' => 'Service fee',
        'adjustment' => 'Adjustment',
    ];

    public const EXPENSE_CATEGORIES = [
        'inventory' => 'Inventory',
        'delivery' => 'Delivery',
        'marketing' => 'Marketing',
        'salary' => 'Salary',
        'rent' => 'Rent',
        'utilities' => 'Utilities',
        'software' => 'Software',
        'bank_fee' => 'Bank fee',
        'refund' => 'Refund',
        'other_expense' => 'Other expense',
    ];

    protected $fillable = [
        'recorded_by',
        'type',
        'category',
        'title',
        'amount',
        'entry_date',
        'payment_method',
        'reference',
        'status',
        'notes',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'entry_date' => 'date',
    ];

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    public static function categoryOptions(): array
    {
        return [
            'income' => collect(self::INCOME_CATEGORIES)
                ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
                ->values()
                ->all(),
            'expense' => collect(self::EXPENSE_CATEGORIES)
                ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
                ->values()
                ->all(),
        ];
    }
}
