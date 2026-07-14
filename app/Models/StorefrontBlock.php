<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

class StorefrontBlock extends Model
{
    use HasFactory;

    public const TYPE_HERO = 'hero';
    public const TYPE_PROMO = 'promo';
    public const TYPE_SECTION = 'section';

    protected $fillable = [
        'type',
        'key',
        'title',
        'subtitle',
        'button_label',
        'link_url',
        'image_path',
        'accent_color',
        'sort_order',
        'is_active',
        'starts_at',
        'ends_at',
        'metadata',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected $appends = [
        'image_url',
    ];

    public function getImageUrlAttribute(): ?string
    {
        if (! $this->image_path) {
            return null;
        }

        if (str_starts_with($this->image_path, 'http://') || str_starts_with($this->image_path, 'https://')) {
            return $this->image_path;
        }

        return Storage::disk('public')->url($this->image_path);
    }
}
