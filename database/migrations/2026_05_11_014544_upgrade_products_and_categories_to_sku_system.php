<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('categories', function (Blueprint $table) {
            $table->foreignId('parent_id')->nullable()->after('id')->constrained('categories')->onDelete('set null');
            $table->integer('sort_order')->default(0)->after('is_active');
            $table->json('metadata')->nullable()->after('sort_order');
        });

        Schema::table('products', function (Blueprint $table) {
            $table->string('status', 32)->default('active')->after('slug');
            $table->json('metadata')->nullable()->after('status');
            
            // These will be moved to skus table
            $table->dropColumn(['price', 'discount_price', 'stock', 'sku']);
        });

        Schema::create('skus', function (Blueprint $table) {
            $table->id();
            $table->foreignId('product_id')->constrained()->onDelete('cascade');
            $table->string('sku_code')->unique();
            $table->string('title')->nullable();
            $table->decimal('price', 12, 2);
            $table->decimal('market_price', 12, 2)->nullable();
            $table->decimal('cost', 12, 2)->nullable();
            $table->unsignedInteger('stock_qty')->default(0);
            $table->unsignedInteger('reserved_qty')->default(0);
            $table->boolean('is_active')->default(true);
            $table->foreignId('image_attachment_id')->nullable()->constrained('product_images')->onDelete('set null');
            $table->json('attributes')->nullable(); // e.g. {"color": "Red", "size": "Large"}
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('skus');

        Schema::table('products', function (Blueprint $table) {
            $table->decimal('price', 10, 2)->after('description');
            $table->decimal('discount_price', 10, 2)->nullable()->after('price');
            $table->integer('stock')->default(0)->after('discount_price');
            $table->string('sku')->unique()->nullable()->after('stock');
            $table->dropColumn(['status', 'metadata']);
        });

        Schema::table('categories', function (Blueprint $table) {
            $table->dropForeign(['parent_id']);
            $table->dropColumn(['parent_id', 'sort_order', 'metadata']);
        });
    }
};
