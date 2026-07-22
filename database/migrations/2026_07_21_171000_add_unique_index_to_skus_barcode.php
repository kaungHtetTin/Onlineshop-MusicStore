<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        DB::table('skus')->where('barcode', '')->update(['barcode' => null]);

        $seen = [];
        DB::table('skus')
            ->whereNotNull('barcode')
            ->orderBy('id')
            ->select(['id', 'barcode'])
            ->chunkById(200, function ($skus) use (&$seen) {
                foreach ($skus as $sku) {
                    $barcode = trim((string) $sku->barcode);

                    if ($barcode === '' || isset($seen[strtoupper($barcode)])) {
                        $barcode = $this->migrationBarcode($seen);
                        DB::table('skus')->where('id', $sku->id)->update(['barcode' => $barcode]);
                    }

                    $seen[strtoupper($barcode)] = true;
                }
            });

        Schema::table('skus', function (Blueprint $table) {
            $table->unique('barcode', 'skus_barcode_unique');
        });
    }

    public function down()
    {
        Schema::table('skus', function (Blueprint $table) {
            $table->dropUnique('skus_barcode_unique');
        });
    }

    private function migrationBarcode(array $reserved): string
    {
        do {
            $barcode = '20' . str_pad((string) random_int(0, 9999999999), 10, '0', STR_PAD_LEFT);
        } while (isset($reserved[strtoupper($barcode)]) || DB::table('skus')->where('barcode', $barcode)->exists());

        return $barcode;
    }
};
