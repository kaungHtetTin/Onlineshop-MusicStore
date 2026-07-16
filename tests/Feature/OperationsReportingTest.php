<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\InventoryBalance;
use App\Models\InventoryStockAlert;
use App\Models\Location;
use App\Models\Order;
use App\Models\PosRegister;
use App\Models\Product;
use App\Models\Role;
use App\Models\Sku;
use App\Models\User;
use App\Notifications\LowStockDigest;
use App\Services\Inventory\InventoryService;
use App\Services\OperationsReportService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class OperationsReportingTest extends TestCase
{
    use RefreshDatabase;

    public function test_manager_can_view_inventory_valuation_and_export_csv(): void
    {
        [$warehouse, $sku] = $this->stockContext(5, 60, 100);
        InventoryBalance::query()->where('location_id', $warehouse->id)->where('sku_id', $sku->id)->update(['reorder_point' => 5]);
        $manager = $this->staffWithRole('manager');

        $this->actingAs($manager)
            ->get('/admin/reports?view=inventory')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Admin/Reports/Index')
                ->where('view', 'inventory')
                ->where('inventoryReport.summary.on_hand', fn ($value) => (int) $value === 5)
                ->where('inventoryReport.summary.cost_value', fn ($value) => (float) $value === 300.0)
                ->where('inventoryReport.summary.low_stock', fn ($value) => (int) $value === 1)
                ->has('inventoryReport.stock_rows', 1));

        $this->actingAs($manager)
            ->get('/admin/reports/export?view=inventory')
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->assertHeader('content-disposition');
    }

    public function test_report_views_respect_sales_and_inventory_permissions(): void
    {
        $warehouse = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $sales = $this->staffWithRole('sales');
        $sales->locations()->sync([$warehouse->id => ['is_default' => true]]);
        $inventory = $this->staffWithRole('inventory_staff');
        $inventory->locations()->sync([$warehouse->id => ['is_default' => true]]);

        $this->actingAs($sales)->get('/admin/reports?view=pos')->assertOk();
        $this->actingAs($sales)->get('/admin/reports?view=inventory')->assertForbidden();
        $this->actingAs($inventory)->get('/admin/reports?view=inventory')->assertOk();
        $this->actingAs($inventory)->get('/admin/reports?view=health')->assertOk();
        $this->actingAs($inventory)->get('/admin/reports?view=sales')->assertForbidden();
    }

    public function test_sales_report_is_scoped_to_the_cashiers_own_pos_orders(): void
    {
        $warehouse = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $register = PosRegister::query()->where('location_id', $warehouse->id)->firstOrFail();
        $cashier = $this->staffWithRole('sales');
        $cashier->locations()->sync([$warehouse->id => ['is_default' => true]]);
        $otherCashier = $this->staffWithRole('sales');
        $otherCashier->locations()->sync([$warehouse->id => ['is_default' => true]]);
        $this->posOrder($warehouse, $register, $cashier, 125);
        $this->posOrder($warehouse, $register, $otherCashier, 300);

        $report = app(OperationsReportService::class)->pos($cashier->fresh());

        $this->assertTrue($report['own_only']);
        $this->assertSame(1, (int) $report['summary']->orders);
        $this->assertSame(125.0, (float) $report['summary']->revenue);
        $this->assertSame(1, $report['by_cashier']->count());
        $this->assertSame($cashier->id, (int) $report['by_cashier']->first()->id);
    }

    public function test_low_stock_scan_notifies_assigned_inventory_staff_and_resolves_alert(): void
    {
        Notification::fake();
        [$warehouse, $sku] = $this->stockContext(2, 50, 90);
        InventoryBalance::query()->where('location_id', $warehouse->id)->where('sku_id', $sku->id)->update(['reorder_point' => 3]);
        $staff = $this->staffWithRole('inventory_staff');
        $staff->locations()->sync([$warehouse->id => ['is_default' => true]]);

        $this->artisan('inventory:scan-low-stock')->assertSuccessful();

        $this->assertDatabaseHas('inventory_stock_alerts', [
            'location_id' => $warehouse->id,
            'sku_id' => $sku->id,
            'type' => 'low_stock',
            'status' => 'open',
        ]);
        Notification::assertSentTo($staff, LowStockDigest::class);

        app(InventoryService::class)->receive($warehouse, $sku, 3, $staff, 'resolve-low-stock');
        $this->artisan('inventory:scan-low-stock')->assertSuccessful();

        $this->assertSame('resolved', InventoryStockAlert::query()->where('sku_id', $sku->id)->value('status'));
    }

    public function test_health_and_reconciliation_commands_record_visible_snapshots(): void
    {
        $this->artisan('operations:health-check')->assertSuccessful();
        $this->artisan('inventory:reconcile')->assertSuccessful();

        $this->assertDatabaseHas('operations_health_checks', ['check_name' => 'queue']);
        $this->assertDatabaseHas('operations_health_checks', ['check_name' => 'broadcasting']);
        $this->assertDatabaseHas('operations_health_checks', ['check_name' => 'backup', 'status' => 'warning']);
        $this->assertDatabaseHas('operations_health_checks', ['check_name' => 'inventory_reconciliation', 'status' => 'healthy']);
    }

    private function stockContext(int $quantity, float $cost, float $price): array
    {
        $warehouse = Location::query()->where('code', 'MAIN-WH')->firstOrFail();
        $category = Category::create(['name' => 'Reporting', 'slug' => 'reporting-'.uniqid(), 'is_active' => true]);
        $product = Product::create([
            'category_id' => $category->id,
            'name' => 'Report Guitar',
            'slug' => 'report-guitar-'.uniqid(),
            'status' => 'active',
            'is_active' => true,
        ]);
        $sku = Sku::create([
            'product_id' => $product->id,
            'sku_code' => 'RPT-'.uniqid(),
            'price' => $price,
            'cost' => $cost,
            'is_active' => true,
        ]);
        app(InventoryService::class)->receive($warehouse, $sku, $quantity, null, 'report-stock-'.$sku->id);

        return [$warehouse, $sku];
    }

    private function staffWithRole(string $roleName): User
    {
        $role = Role::query()->where('name', $roleName)->firstOrFail();
        $user = User::factory()->create(['role' => $roleName, 'status' => 'active', 'permissions' => []]);
        $user->roles()->sync([$role->id]);

        return $user->fresh();
    }

    private function posOrder(Location $location, PosRegister $register, User $cashier, float $amount): Order
    {
        return Order::create([
            'user_id' => null,
            'order_number' => 'POS-RPT-'.uniqid(),
            'sales_channel' => 'pos',
            'location_id' => $location->id,
            'register_id' => $register->id,
            'served_by' => $cashier->id,
            'total_amount' => $amount,
            'discount_amount' => 0,
            'tax_amount' => 0,
            'shipping_fee' => 0,
            'final_amount' => $amount,
            'status' => 'delivered',
            'payment_status' => 'paid',
            'payment_method' => 'cash',
        ]);
    }
}
