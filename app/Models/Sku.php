<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sku extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'sku_code',
        'barcode',
        'title',
        'price',
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
}
