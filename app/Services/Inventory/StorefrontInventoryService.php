<?php

namespace App\Services\Inventory;

use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Product;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class StorefrontInventoryService
{
    public function fulfillmentLocation(): Location
    {
        $configuredCode = strtoupper((string) config('inventory.default_fulfillment_location_code'));

        $location = Location::query()
            ->where('is_active', true)
            ->where(function ($query) use ($configuredCode) {
                $query->where('is_default_fulfillment', true)
                    ->orWhere('code', $configuredCode);
            })
            ->orderByDesc('is_default_fulfillment')
            ->first();

        if (! $location) {
            throw ValidationException::withMessages([
                'inventory' => 'No active online fulfillment location is configured.',
            ]);
        }

        return $location;
    }

    /**
     * Add location-aware availability to product SKUs before they are serialized.
     *
     * @param  iterable<Product>  $products
     */
    public function attachAvailableQuantities(iterable $products, ?Location $location = null): void
    {
        $location ??= $this->fulfillmentLocation();
        $products = $products instanceof Collection ? $products : collect($products);
        $skus = $products->flatMap(fn (Product $product) => $product->skus)->values();

        if ($skus->isEmpty()) {
            return;
        }

        $balances = InventoryBalance::query()
            ->where('location_id', $location->id)
            ->whereIn('sku_id', $skus->pluck('id'))
            ->get()
            ->keyBy('sku_id');

        foreach ($skus as $sku) {
            $balance = $balances->get($sku->id);
            $sku->setAttribute('available_qty', $balance ? $balance->available_qty : 0);
            $sku->makeHidden(['stock_qty', 'reserved_qty']);
        }
    }

    /**
     * Add total availability from every active stock location to product SKUs.
     *
     * @param  iterable<Product>  $products
     */
    public function attachAvailableQuantitiesAcrossLocations(iterable $products): void
    {
        $products = $products instanceof Collection ? $products : collect($products);
        $skus = $products->flatMap(fn (Product $product) => $product->skus)->values();

        if ($skus->isEmpty()) {
            return;
        }

        $availableBySku = InventoryBalance::query()
            ->whereIn('sku_id', $skus->pluck('id'))
            ->whereHas('location', fn ($location) => $location->where('is_active', true))
            ->get()
            ->groupBy('sku_id')
            ->map(fn (Collection $balances) => $balances->sum(fn (InventoryBalance $balance) => max(0, $balance->available_qty)));

        foreach ($skus as $sku) {
            $sku->setAttribute('available_qty', (int) ($availableBySku->get($sku->id) ?? 0));
            $sku->makeHidden(['stock_qty', 'reserved_qty']);
        }
    }
}
