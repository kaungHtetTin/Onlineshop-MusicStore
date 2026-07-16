<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_transfers', function (Blueprint $table) {
            $table->id();
            $table->string('transfer_number', 50)->unique();
            $table->foreignId('source_location_id')->constrained('locations')->restrictOnDelete();
            $table->foreignId('destination_location_id')->constrained('locations')->restrictOnDelete();
            $table->string('status', 30)->default('draft');
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('shipped_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('shipped_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->index(['source_location_id', 'status']);
            $table->index(['destination_location_id', 'status']);
        });

        Schema::create('stock_transfer_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_transfer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sku_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('requested_quantity');
            $table->unsignedBigInteger('shipped_quantity')->nullable();
            $table->unsignedBigInteger('received_quantity')->nullable();
            $table->string('discrepancy_reason')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('transfer_out_movement_id')->nullable()->constrained('inventory_movements')->nullOnDelete();
            $table->foreignId('transfer_in_movement_id')->nullable()->constrained('inventory_movements')->nullOnDelete();
            $table->timestamps();
            $table->unique(['stock_transfer_id', 'sku_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_transfer_items');
        Schema::dropIfExists('stock_transfers');
    }
};
