<?php

namespace Tests\Feature;

use App\Events\InventoryBalanceChanged;
use App\Events\StockTransferStatusChanged;
use App\Models\Category;
use App\Models\Location;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sku;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use App\Services\Inventory\StockTransferService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class InventoryBroadcastingTest extends TestCase
{
    use RefreshDatabase;

    public function test_inventory_mutations_and_transfer_dispatch_broadcast_events(): void
    {
        Event::fake([
            InventoryBalanceChanged::class,
            StockTransferStatusChanged::class,
        ]);

        [$warehouse, $store, $sku, $actor] = $this->context();

        app(InventoryService::class)->receive($warehouse, $sku, 10, $actor, 'broadcast-receipt');

        app(StockTransferService::class)->transferNow($warehouse, $store, [[
            'sku_id' => $sku->id,
            'requested_quantity' => 2,
        ]], $actor);

        Event::assertDispatched(InventoryBalanceChanged::class, fn (InventoryBalanceChanged $event) => $event->movement->sku_id === $sku->id);
        Event::assertDispatched(StockTransferStatusChanged::class, fn (StockTransferStatusChanged $event) => $event->transfer->status === 'received');
    }

    public function test_inventory_private_channels_are_authorized_by_permission_and_location(): void
    {
        config([
            'broadcasting.default' => 'pusher',
            'broadcasting.connections.pusher.key' => 'test-key',
            'broadcasting.connections.pusher.secret' => 'test-secret',
            'broadcasting.connections.pusher.app_id' => 'test-app',
        ]);
        require base_path('routes/channels.php');

        $store = Location::query()->where('code', 'MAIN-STORE')->firstOrFail();
        $warehouse = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $staff = $this->staffWithRole('inventory_staff', [$store->id], ['inventory.view']);
        $admin = $this->staffWithRole('super_admin', [$store->id, $warehouse->id]);

        $this->assertTrue($staff->hasAdminPermission('inventory.view'));
        $this->assertTrue($staff->canAccessLocation($store));
        $this->assertFalse($staff->canAccessLocation($warehouse));

        $this->actingAs($staff)->post('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-inventory.location.{$store->id}",
        ])->assertOk();

        $this->actingAs($staff)->post('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => "private-inventory.location.{$warehouse->id}",
        ])->assertForbidden();

        $this->actingAs($admin)->post('/broadcasting/auth', [
            'socket_id' => '1234.5678',
            'channel_name' => 'private-inventory.all',
        ])->assertOk();
    }

    private function context(): array
    {
        $category = Category::create(['name' => 'Broadcast Category', 'slug' => 'broadcast-category-'.uniqid(), 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Broadcast Product',
            'slug' => 'broadcast-product-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);
        $sku = Sku::create([
            'product_id' => $product->id,
            'sku_code' => 'BRC-'.uniqid(),
            'price' => 100,
            'stock_qty' => 0,
            'is_active' => true,
        ]);

        return [
            Location::query()->where('code', 'MAIN-WH')->firstOrFail(),
            Location::query()->where('code', 'MAIN-STORE')->firstOrFail(),
            $sku,
            $this->staffWithRole('super_admin'),
        ];
    }

    private function staffWithRole(string $roleName, array $locationIds = [], array $permissions = []): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();
        $user = User::factory()->create(['role' => $roleName, 'status' => 'active', 'permissions' => $permissions]);
        $user->roles()->sync([$role->id]);

        if ($locationIds) {
            $user->locations()->sync(collect($locationIds)->mapWithKeys(fn ($id) => [$id => ['is_default' => false]])->all());
        }

        return $user->fresh();
    }
}
