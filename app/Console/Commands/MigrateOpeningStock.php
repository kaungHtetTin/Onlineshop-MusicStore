<?php

namespace App\Console\Commands;

use App\Models\InventoryBalance;
use App\Models\Location;
use App\Models\Sku;
use App\Services\Inventory\InventoryService;
use Illuminate\Console\Command;

class MigrateOpeningStock extends Command
{
    protected $signature = 'inventory:migrate-opening-stock
        {--location= : Destination location code}
        {--dry-run : Show the migration without writing data}';

    protected $description = 'Create location balances and opening movements from legacy SKU stock';

    public function handle(InventoryService $inventoryService): int
    {
        $code = strtoupper((string) ($this->option('location') ?: config('inventory.default_opening_location')));
        $location = Location::query()->where('code', $code)->first();

        if (! $location) {
            $this->error("Location {$code} was not found.");
            return self::FAILURE;
        }

        $dryRun = (bool) $this->option('dry-run');
        $migrated = 0;
        $zeroBalances = 0;
        $skipped = 0;
        $quantity = 0;

        Sku::query()->orderBy('id')->chunkById(200, function ($skus) use (
            $inventoryService,
            $location,
            $dryRun,
            &$migrated,
            &$zeroBalances,
            &$skipped,
            &$quantity
        ) {
            foreach ($skus as $sku) {
                $exists = InventoryBalance::query()
                    ->where('location_id', $location->id)
                    ->where('sku_id', $sku->id)
                    ->exists();

                if ($exists) {
                    $skipped++;
                    continue;
                }

                $legacyQuantity = (int) $sku->stock_qty;
                $quantity += $legacyQuantity;

                if ($dryRun) {
                    $legacyQuantity > 0 ? $migrated++ : $zeroBalances++;
                    continue;
                }

                if ($legacyQuantity > 0) {
                    $inventoryService->openingBalance(
                        $location,
                        $sku,
                        $legacyQuantity,
                        null,
                        "opening-balance:{$location->id}:{$sku->id}",
                        'Migrated from legacy skus.stock_qty.'
                    );
                    $migrated++;
                } else {
                    $inventoryService->ensureBalance($location, $sku);
                    $zeroBalances++;
                }
            }
        });

        $prefix = $dryRun ? 'Dry run: ' : '';
        $this->info("{$prefix}{$migrated} opening movements, {$zeroBalances} zero balances, {$skipped} skipped; {$quantity} units targeted to {$location->code}.");

        return self::SUCCESS;
    }
}
