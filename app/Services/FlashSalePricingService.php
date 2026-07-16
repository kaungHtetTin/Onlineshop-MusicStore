<?php

namespace App\Services;

use App\Models\FlashSale;
use App\Models\FlashSaleItem;
use App\Models\Sku;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class FlashSalePricingService
{
    public function activeSales()
    {
        return FlashSale::query()
            ->activeNow()
            ->with(['items.sku.product'])
            ->orderByDesc('starts_at')
            ->get();
    }

    public function activeSale()
    {
        return $this->activeSales()->first();
    }

    /**
     * @param  iterable<\App\Models\Product>  $products
     */
    public function attachToProducts(iterable $products): void
    {
        $skuIds = collect($products)
            ->flatMap(fn ($product) => $product->skus?->pluck('id') ?? [])
            ->filter()
            ->unique()
            ->values();

        if ($skuIds->isEmpty()) {
            return;
        }

        $items = $this->activeItemsForSkuIds($skuIds->all());

        if ($items->isEmpty()) {
            return;
        }

        foreach ($products as $product) {
            foreach ($product->skus ?? [] as $sku) {
                $item = $items->get($sku->id);

                if ($item) {
                    $this->attachToSku($sku, $item);
                }
            }
        }
    }

    /**
     * @param  array<int>  $skuIds
     * @return \Illuminate\Support\Collection<int, \App\Models\FlashSaleItem>
     */
    public function activeItemsForSkuIds(array $skuIds, bool $lock = false): Collection
    {
        if (empty($skuIds)) {
            return collect();
        }

        $query = FlashSaleItem::query()
            ->select('flash_sale_items.*')
            ->join('flash_sales', 'flash_sales.id', '=', 'flash_sale_items.flash_sale_id')
            ->where('flash_sales.is_active', true)
            ->where('flash_sales.starts_at', '<=', now())
            ->where('flash_sales.ends_at', '>=', now())
            ->whereIn('flash_sale_items.sku_id', $skuIds)
            ->with('flashSale')
            ->orderByDesc('flash_sales.starts_at');

        if ($lock) {
            $query->lockForUpdate();
        }

        return $query->get()->keyBy('sku_id');
    }

    public function effectivePrice(Sku $sku, ?FlashSaleItem $item = null): float
    {
        $price = (float) $sku->price;

        if (! $item) {
            return round($price, 2);
        }

        return $item->salePrice($price);
    }

    public function attachToSku(Sku $sku, FlashSaleItem $item): void
    {
        $originalPrice = (float) $sku->price;
        $salePrice = $item->salePrice($originalPrice);

        $sku->setAttribute('flash_sale', [
            'id' => $item->flash_sale_id,
            'item_id' => $item->id,
            'name' => $item->flashSale?->name,
            'discount_type' => $item->discount_type,
            'discount_value' => (float) $item->discount_value,
            'original_price' => $originalPrice,
            'sale_price' => $salePrice,
            'starts_at' => optional($item->flashSale?->starts_at)->toIso8601String(),
            'ends_at' => optional($item->flashSale?->ends_at)->toIso8601String(),
            'quantity_limit' => $item->quantity_limit,
            'sold_count' => $item->sold_count,
            'remaining_qty' => $item->remainingQuantity(),
        ]);
        $sku->setAttribute('effective_price', $salePrice);
    }

    public function attachToSkuCollection(EloquentCollection $skus): void
    {
        $items = $this->activeItemsForSkuIds($skus->pluck('id')->all());

        foreach ($skus as $sku) {
            $item = $items->get($sku->id);

            if ($item) {
                $this->attachToSku($sku, $item);
            }
        }
    }
}
