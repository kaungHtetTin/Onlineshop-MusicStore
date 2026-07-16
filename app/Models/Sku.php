<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use App\Models\Location;

class Sku extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'sku_code',
        'barcode',
        'title',
        'price',
        'wholesale_price',
        'market_price',
        'cost',
        'stock_qty',
        'reserved_qty',
        'is_active',
        'image_attachment_id',
        'attributes',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'market_price' => 'decimal:2',
        'cost' => 'decimal:2',
        'stock_qty' => 'integer',
        'reserved_qty' => 'integer',
        'is_active' => 'boolean',
        'attributes' => 'json',
    ];

    public function product()
    {
        return $this->belongsTo(Product::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeAvailableAt(Builder $query, Location|int $location): Builder
    {
        $locationId = $location instanceof Location ? $location->id : $location;

        return $query
            ->active()
            ->whereHas('inventoryBalances', fn (Builder $balance) => $balance
                ->where('location_id', $locationId)
                ->whereColumn('inventory_balances.on_hand_qty', '>', 'inventory_balances.reserved_qty'));
    }

    public function scopeAvailableAnywhere(Builder $query): Builder
    {
        return $query
            ->active()
            ->whereHas('inventoryBalances', fn (Builder $balance) => $balance
                ->whereColumn('inventory_balances.on_hand_qty', '>', 'inventory_balances.reserved_qty')
                ->whereHas('location', fn (Builder $location) => $location->where('is_active', true)));
    }

    public function image()
    {
        return $this->belongsTo(ProductImage::class, 'image_attachment_id');
    }

    public function orderItems()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function flashSaleItems()
    {
        return $this->hasMany(FlashSaleItem::class);
    }

    public function inventoryBalances()
    {
        return $this->hasMany(InventoryBalance::class);
    }

    public function inventoryMovements()
    {
        return $this->hasMany(InventoryMovement::class);
    }

    public function inventoryReservations()
    {
        return $this->hasMany(InventoryReservation::class);
    }
}
