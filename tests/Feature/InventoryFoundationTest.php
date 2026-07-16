<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\InventoryMovement;
use App\Models\Location;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sku;
use App\Models\User;
use App\Services\Inventory\InventoryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class InventoryFoundationTest extends TestCase
{
    use RefreshDatabase;

    public function test_initial_warehouses_are_seeded(): void
    {
        $this->assertDatabaseHas('locations', [
            'code' => 'MAIN-WH',
            'type' => 'warehouse',
            'is_default_fulfillment' => true,
            'is_system' => true,
        ]);
        $this->assertDatabaseHas('locations', [
            'code' => 'MAIN-STORE',
            'type' => 'warehouse',
            'is_default_fulfillment' => false,
        ]);
    }

    public function test_receipt_creates_a_balance_and_append_only_movement(): void
    {
        [$location, $sku, $actor] = $this->inventoryContext();

        $movement = app(InventoryService::class)->receive(
            $location,
            $sku,
            12,
            $actor,
            'test-receipt-1',
            null,
            'Initial receipt'
        );

        $this->assertSame('receipt', $movement->type);
        $this->assertSame(0, $movement->on_hand_before);
        $this->assertSame(12, $movement->on_hand_after);
        $this->assertDatabaseHas('inventory_balances', [
            'location_id' => $location->id,
            'sku_id' => $sku->id,
            'on_hand_qty' => 12,
            'reserved_qty' => 0,
            'version' => 1,
        ]);
        $this->assertSame(0, $sku->fresh()->stock_qty);
    }

    public function test_idempotency_key_does_not_apply_stock_twice(): void
    {
        [$location, $sku, $actor] = $this->inventoryContext();
        $service = app(InventoryService::class);

        $first = $service->receive($location, $sku, 5, $actor, 'same-request');
        $second = $service->receive($location, $sku, 5, $actor, 'same-request');

        $this->assertSame($first->id, $second->id);
        $this->assertSame(5, InventoryBalance::query()->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertSame(1, InventoryMovement::query()->where('idempotency_key', 'same-request')->count());
    }

    public function test_idempotency_key_cannot_be_reused_for_a_different_operation(): void
    {
        [$location, $sku, $actor] = $this->inventoryContext();
        $service = app(InventoryService::class);
        $service->receive($location, $sku, 5, $actor, 'operation-key');

        $this->expectException(ValidationException::class);
        $service->receive($location, $sku, 6, $actor, 'operation-key');
    }

    public function test_stock_cannot_be_adjusted_below_zero(): void
    {
        [$location, $sku, $actor] = $this->inventoryContext();

        $this->expectException(ValidationException::class);
        app(InventoryService::class)->adjust($location, $sku, -1, 'damage', $actor, 'negative-adjustment');
    }

    public function test_reservations_cannot_exceed_available_stock(): void
    {
        [$location, $sku, $actor] = $this->inventoryContext();
        $service = app(InventoryService::class);
        $service->receive($location, $sku, 3, $actor, 'reserve-receipt');

        try {
            $service->reserve($location, $sku, 4, $actor, 'reserve-too-much');
            $this->fail('Expected reservation validation to fail.');
        } catch (ValidationException $exception) {
            $this->assertSame(0, InventoryBalance::query()->where('sku_id', $sku->id)->value('reserved_qty'));
        }
    }

    public function test_opening_stock_command_is_dry_run_capable_and_idempotent(): void
    {
        [, $sku] = $this->inventoryContext(9);

        $this->artisan('inventory:migrate-opening-stock', ['--location' => 'MAIN-WH', '--dry-run' => true])
            ->expectsOutputToContain('Dry run:')
            ->assertSuccessful();
        $this->assertDatabaseMissing('inventory_balances', ['sku_id' => $sku->id]);

        $this->artisan('inventory:migrate-opening-stock', ['--location' => 'MAIN-WH'])->assertSuccessful();
        $this->artisan('inventory:migrate-opening-stock', ['--location' => 'MAIN-WH'])->assertSuccessful();

        $this->assertSame(9, InventoryBalance::query()->where('sku_id', $sku->id)->value('on_hand_qty'));
        $this->assertSame(1, InventoryMovement::query()->where('sku_id', $sku->id)->count());
    }

    public function test_location_management_is_permission_protected(): void
    {
        $admin = $this->staffWithRole('super_admin');
        $inventoryStaff = $this->staffWithRole('inventory_staff');

        $this->actingAs($admin)->get('/admin/locations')->assertOk();
        $this->actingAs($inventoryStaff)->get('/admin/locations')->assertOk();

        $this->actingAs($inventoryStaff)->post('/admin/locations', [
            'code' => 'SECOND-STORE',
            'name' => 'Second Store',
            'type' => 'warehouse',
            'timezone' => 'Asia/Yangon',
            'is_active' => true,
            'is_default_fulfillment' => false,
            'staff_ids' => [],
        ])->assertForbidden();

        $this->actingAs($admin)->post('/admin/locations', [
            'code' => 'SECOND-STORE',
            'name' => 'Second Store',
            'type' => 'warehouse',
            'timezone' => 'Asia/Yangon',
            'is_active' => true,
            'is_default_fulfillment' => false,
            'staff_ids' => [$inventoryStaff->id],
        ])->assertRedirect();

        $this->assertDatabaseHas('locations', ['code' => 'SECOND-STORE']);
        $this->assertDatabaseHas('location_user', ['user_id' => $inventoryStaff->id]);
    }

    private function inventoryContext(int $legacyStock = 0): array
    {
        $category = Category::create([
            'name' => 'Guitars',
            'slug' => 'guitars-'.uniqid(),
            'is_active' => true,
        ]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Test Guitar',
            'slug' => 'test-guitar-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);
        $sku = Sku::create([
            'product_id' => $product->id,
            'sku_code' => 'SKU-'.uniqid(),
            'price' => 100,
            'stock_qty' => $legacyStock,
            'is_active' => true,
        ]);

        return [
            Location::query()->where('code', 'MAIN-WH')->firstOrFail(),
            $sku,
            $this->staffWithRole('super_admin'),
        ];
    }

    private function staffWithRole(string $roleName): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();
        $user = User::factory()->create([
            'role' => $roleName,
            'status' => 'active',
            'permissions' => [],
        ]);
        $user->roles()->sync([$role->id]);

        return $user->fresh();
    }
}
