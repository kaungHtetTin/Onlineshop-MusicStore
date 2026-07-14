<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('flash_sales', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['is_active', 'starts_at', 'ends_at']);
        });

        Schema::create('flash_sale_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('flash_sale_id')->constrained()->onDelete('cascade');
            $table->foreignId('sku_id')->constrained('skus')->onDelete('cascade');
            $table->string('discount_type', 20);
            $table->decimal('discount_value', 12, 2);
            $table->unsignedInteger('quantity_limit')->nullable();
            $table->unsignedInteger('sold_count')->default(0);
            $table->timestamps();

            $table->unique(['flash_sale_id', 'sku_id']);
            $table->index(['sku_id', 'discount_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('flash_sale_items');
        Schema::dropIfExists('flash_sales');
    }
};
