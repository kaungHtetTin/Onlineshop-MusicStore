<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\InventoryReservation;
use App\Models\Location;
use App\Models\Order;
use App\Models\OrderReturn;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Sku;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\OrderReturnInventoryService;
use App\Services\Inventory\StockReservationService;
use App\Services\Inventory\StorefrontInventoryService;
use App\Services\OrderManagementService;
use App\Services\OrderPaymentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class OnlineInventoryReservationTest extends TestCase
{
    use RefreshDatabase;

    public function test_checkout_reserves_location_stock_and_payment_converts_it_to_a_sale(): void
    {
        [$location, $sku, $customer] = $this->context(5);
        $sku->forceFill(['stock_qty' => 999])->save();
        $paymentMethod = PaymentMethod::create([
            'banking_service' => 'Test Pay',
            'account_name' => 'LaLaPick',
            'account_no' => '001',
            'sort_order' => 1,
            'is_active' => true,
        ]);
        Storage::fake('public');

        $response = $this->actingAs($customer)->post('/checkout', [
            'lines' => [[
                'sku_id' => $sku->id,
                'quantity' => 2,
                'is_preorder' => false,
            ]],
            'receiver_name' => 'Online Customer',
            'receiver_phone' => '091111111',
            'shipping_address' => 'Test address',
            'payment_method_id' => $paymentMethod->id,
            'payment_proof' => UploadedFile::fake()->createWithContent(
                'proof.png',
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=')
            ),
            'redeem_points' => 0,
        ]);

        $order = Order::query()->latest('id')->firstOrFail();
        $response->assertRedirect(route('orders.show', $order));
        $this->assertSame('online', $order->sales_channel);
        $this->assertSame($location->id, $order->location_id);
        $this->assertBalance($location, $sku, 5, 2);
        $this->assertDatabaseHas('inventory_reservations', [
            'order_id' => $order->id,
            'quantity' => 2,
            'status' => InventoryReservation::STATUS_ACTIVE,
        ]);

        $reviewer = User::factory()->create(['status' => 'active']);
        app(OrderPaymentService::class)->confirmPayment($order, $reviewer);

        $this->assertBalance($location, $sku, 3, 0);
        $this->assertSame(999, $sku->fresh()->stock_qty);
        $this->assertDatabaseHas('inventory_reservations', [
            'order_id' => $order->id,
            'status' => InventoryReservation::STATUS_CONVERTED,
        ]);

        app(OrderManagementService::class)->cancelOrder($order->fresh(), $reviewer, 'Customer request', true);
        $this->assertBalance($location, $sku, 5, 0);
        $this->assertDatabaseHas('inventory_movements', [
            'location_id' => $location->id,
            'sku_id' => $sku->id,
            'type' => 'sale_return',
            'quantity_delta' => 2,
        ]);
    }

    public function test_payment_rejection_releases_reserved_stock(): void
    {
        [$location, $sku, $customer] = $this->context(4);
        $order = $this->pendingOrder($location, $sku, $customer, 3);
        $reviewer = User::factory()->create(['status' => 'active']);

        app(StockReservationService::class)->reserveOrderItem($order->items->first(), $location, $customer);
        app(OrderPaymentService::class)->rejectPayment($order, $reviewer, 'Invalid proof');

        $this->assertBalance($location, $sku, 4, 0);
        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertDatabaseHas('inventory_reservations', [
            'order_id' => $order->id,
            'status' => InventoryReservation::STATUS_RELEASED,
            'release_reason' => 'Invalid proof',
        ]);
    }

    public function test_expiry_command_cancels_order_and_releases_stock(): void
    {
        [$location, $sku, $customer] = $this->context(2);
        $order = $this->pendingOrder($location, $sku, $customer, 2);
        $reservation = app(StockReservationService::class)
            ->reserveOrderItem($order->items->first(), $location, $customer);
        $reservation->update(['expires_at' => now()->subMinute()]);

        $this->artisan('inventory:expire-reservations')->assertSuccessful();

        $this->assertBalance($location, $sku, 2, 0);
        $this->assertSame('cancelled', $order->fresh()->status);
        $this->assertDatabaseHas('inventory_reservations', [
            'id' => $reservation->id,
            'status' => InventoryReservation::STATUS_EXPIRED,
        ]);
    }

    public function test_storefront_quantity_comes_from_the_fulfillment_balance(): void
    {
        [$location, $sku] = $this->context(4);
        $sku->forceFill(['stock_qty' => 500])->save();
        app(InventoryService::class)->reserve($location, $sku, 1, null, 'storefront-reserved');

        $product = $sku->product()->with('skus')->firstOrFail();
        app(StorefrontInventoryService::class)->attachAvailableQuantities(collect([$product]), $location);
        $serializedSku = $product->skus->first()->toArray();

        $this->assertSame(3, $serializedSku['available_qty']);
        $this->assertArrayNotHasKey('stock_qty', $serializedSku);
    }

    public function test_received_item_return_restocks_once_and_cannot_exceed_quantity_sold(): void
    {
        [$location, $sku, $customer] = $this->context(3);
        $order = $this->pendingOrder($location, $sku, $customer, 2);
        $reviewer = User::factory()->create(['status' => 'active']);
        app(StockReservationService::class)->reserveOrderItem($order->items->first(), $location, $customer);
        app(OrderPaymentService::class)->confirmPayment($order, $reviewer);
        $this->assertBalance($location, $sku, 1, 0);

        $return = OrderReturn::create([
            'order_id' => $order->id,
            'order_item_id' => $order->items->first()->id,
            'user_id' => $customer->id,
            'type' => 'return',
            'status' => 'received',
            'quantity' => 1,
            'amount' => 100,
        ]);
        $service = app(OrderReturnInventoryService::class);
        $service->restockIfEligible($return, $reviewer);
        $service->restockIfEligible($return->fresh(), $reviewer);

        $this->assertBalance($location, $sku, 2, 0);
        $this->assertNotNull($return->fresh()->restocked_at);
        $this->assertSame(1, $return->fresh()->inventoryMovement->quantity_delta);

        $excessReturn = OrderReturn::create([
            'order_id' => $order->id,
            'order_item_id' => $order->items->first()->id,
            'user_id' => $customer->id,
            'type' => 'return',
            'status' => 'received',
            'quantity' => 2,
            'amount' => 200,
        ]);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $service->restockIfEligible($excessReturn, $reviewer);
    }

    private function context(int $quantity): array
    {
        $location = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $category = Category::create([
            'name' => 'Online Inventory',
            'slug' => 'online-inventory-'.uniqid(),
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Reservation Guitar',
            'slug' => 'reservation-guitar-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);
        $sku = Sku::create([
            'product_id' => $product->id,
            'sku_code' => 'RES-'.uniqid(),
            'price' => 100,
            'stock_qty' => 0,
            'is_active' => true,
        ]);
        $customer = User::factory()->create(['status' => 'active']);
        app(InventoryService::class)->receive($location, $sku, $quantity, null, 'online-stock-'.$sku->id);

        return [$location, $sku, $customer];
    }

    private function pendingOrder(Location $location, Sku $sku, User $customer, int $quantity): Order
    {
        $order = Order::create([
            'user_id' => $customer->id,
            'order_number' => 'WEB-'.uniqid(),
            'sales_channel' => 'online',
            'location_id' => $location->id,
            'total_amount' => 100 * $quantity,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_fee' => 0,
            'final_amount' => 100 * $quantity,
            'status' => 'pending',
            'payment_status' => 'pending_review',
        ]);
        $order->items()->create([
            'sku_id' => $sku->id,
            'product_id' => $sku->product_id,
            'quantity' => $quantity,
            'unit_price' => 100,
            'total_price' => 100 * $quantity,
            'variants' => [],
        ]);

        return $order->fresh(['items.sku', 'location']);
    }

    private function assertBalance(Location $location, Sku $sku, int $onHand, int $reserved): void
    {
        $balance = InventoryBalance::query()
            ->where('location_id', $location->id)
            ->where('sku_id', $sku->id)
            ->firstOrFail();

        $this->assertSame($onHand, $balance->on_hand_qty);
        $this->assertSame($reserved, $balance->reserved_qty);
    }
}
