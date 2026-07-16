<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\User;
use App\Models\Coupon;
use App\Models\Location;
use App\Services\OperationsReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

class ReportController extends Controller
{
    public function index(Request $request, OperationsReportService $operations)
    {
        $user = $request->user();
        $view = $request->string('view')->toString();
        if (! $view) {
            $view = $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.sales') ? 'sales' : 'inventory';
        }
        $this->authorizeView($user, $view);
        $filters = $request->validate([
            'view' => ['nullable', 'string', 'in:sales,inventory,pos,health'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:120'],
            'stock_status' => ['nullable', 'string', 'in:low,out'],
        ]);
        $paidOrders = Order::query()->where('payment_status', 'paid');
        $paidOrderCount = (clone $paidOrders)->count();
        $paidRevenue = (float) (clone $paidOrders)->sum('final_amount');
        $grossSales = (float) (clone $paidOrders)->sum('total_amount');
        $discounts = (float) (clone $paidOrders)->sum('discount_amount');
        $paidCustomerCount = (clone $paidOrders)->distinct('user_id')->count('user_id');
        $unitsSold = (int) OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.payment_status', 'paid')
            ->sum('order_items.quantity');
        $repeatCustomerCount = DB::query()
            ->fromSub(
                Order::query()
                    ->where('payment_status', 'paid')
                    ->select('user_id')
                    ->groupBy('user_id')
                    ->havingRaw('COUNT(*) > 1'),
                'repeat_customers'
            )
            ->count();

        $topProducts = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->where('orders.payment_status', 'paid')
            ->groupBy('products.id', 'products.name')
            ->orderByDesc(DB::raw('SUM(order_items.quantity)'))
            ->limit(10)
            ->get([
                'products.id',
                'products.name',
                DB::raw('SUM(order_items.quantity) as units'),
                DB::raw('SUM(order_items.total_price) as revenue'),
            ]);

        $salesByDay = Order::query()
            ->where('payment_status', 'paid')
            ->where('created_at', '>=', now()->subDays(30))
            ->selectRaw('DATE(created_at) as day, COUNT(*) as orders, SUM(final_amount) as revenue')
            ->groupBy('day')
            ->orderBy('day')
            ->get();

        $categoryPerformance = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->join('products', 'products.id', '=', 'order_items.product_id')
            ->join('categories', 'categories.id', '=', 'products.category_id')
            ->where('orders.payment_status', 'paid')
            ->groupBy('categories.id', 'categories.name')
            ->orderByDesc(DB::raw('SUM(order_items.total_price)'))
            ->limit(8)
            ->get([
                'categories.id',
                'categories.name',
                DB::raw('COUNT(DISTINCT orders.id) as orders'),
                DB::raw('COUNT(DISTINCT products.id) as products'),
                DB::raw('SUM(order_items.quantity) as units'),
                DB::raw('SUM(order_items.total_price) as revenue'),
            ]);

        $purchaseSegments = DB::query()
            ->fromSub(
                OrderItem::query()
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('orders.payment_status', 'paid')
                    ->groupBy('order_items.order_id')
                    ->selectRaw('order_items.order_id, SUM(order_items.quantity) as units, SUM(order_items.total_price) as revenue'),
                'baskets'
            )
            ->selectRaw("
                CASE
                    WHEN units = 1 THEN 'Single item'
                    WHEN units BETWEEN 2 AND 3 THEN 'Small bundle'
                    ELSE 'Large basket'
                END as segment,
                COUNT(*) as orders,
                SUM(units) as units,
                SUM(revenue) as revenue
            ")
            ->groupBy('segment')
            ->orderByDesc('orders')
            ->get();

        $productPairs = DB::table('order_items as first_items')
            ->join('order_items as second_items', function ($join) {
                $join->on('first_items.order_id', '=', 'second_items.order_id')
                    ->whereColumn('first_items.product_id', '<', 'second_items.product_id');
            })
            ->join('orders', 'orders.id', '=', 'first_items.order_id')
            ->join('products as first_products', 'first_products.id', '=', 'first_items.product_id')
            ->join('products as second_products', 'second_products.id', '=', 'second_items.product_id')
            ->where('orders.payment_status', 'paid')
            ->groupBy('first_products.id', 'first_products.name', 'second_products.id', 'second_products.name')
            ->orderByDesc(DB::raw('COUNT(DISTINCT orders.id)'))
            ->limit(6)
            ->get([
                DB::raw("CONCAT(first_products.name, ' + ', second_products.name) as pair"),
                DB::raw('COUNT(DISTINCT orders.id) as orders'),
                DB::raw('SUM(first_items.quantity + second_items.quantity) as units'),
            ]);

        $couponPerformance = Coupon::query()
            ->leftJoin('orders', function ($join) {
                $join->on('orders.coupon_id', '=', 'coupons.id')
                    ->where('orders.payment_status', '=', 'paid');
            })
            ->groupBy('coupons.id', 'coupons.code', 'coupons.type', 'coupons.value')
            ->orderByDesc(DB::raw('COUNT(orders.id)'))
            ->limit(8)
            ->get([
                'coupons.id',
                'coupons.code',
                'coupons.type',
                'coupons.value',
                DB::raw('COUNT(orders.id) as paid_orders'),
                DB::raw('COALESCE(SUM(orders.discount_amount), 0) as discount_given'),
                DB::raw('COALESCE(SUM(orders.final_amount), 0) as revenue'),
            ]);

        $flashSalePerformance = DB::table('flash_sales')
            ->leftJoin('flash_sale_items', 'flash_sale_items.flash_sale_id', '=', 'flash_sales.id')
            ->leftJoin('skus', 'skus.id', '=', 'flash_sale_items.sku_id')
            ->groupBy('flash_sales.id', 'flash_sales.name', 'flash_sales.starts_at', 'flash_sales.ends_at', 'flash_sales.is_active')
            ->orderByDesc(DB::raw('COALESCE(SUM(flash_sale_items.sold_count), 0)'))
            ->limit(8)
            ->get([
                'flash_sales.id',
                'flash_sales.name',
                'flash_sales.starts_at',
                'flash_sales.ends_at',
                'flash_sales.is_active',
                DB::raw('COUNT(flash_sale_items.id) as items'),
                DB::raw('COALESCE(SUM(flash_sale_items.sold_count), 0) as units_sold'),
                DB::raw("
                    COALESCE(SUM(
                        flash_sale_items.sold_count *
                        CASE
                            WHEN flash_sale_items.discount_type = 'percentage'
                                THEN skus.price * (1 - (flash_sale_items.discount_value / 100))
                            ELSE flash_sale_items.discount_value
                        END
                    ), 0) as estimated_revenue
                "),
            ]);

        return Inertia::render('Admin/Reports/Index', [
            'view' => $view,
            'filters' => $filters,
            'locations' => Location::query()
                ->whereIn('id', $user->accessibleLocationIds())
                ->where('is_active', true)
                ->orderBy('name')
                ->get(['id', 'code', 'name', 'type']),
            'canViewSales' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.sales'),
            'canViewInventory' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.inventory'),
            'inventoryReport' => $view === 'inventory' ? $operations->inventory($user, $filters) : null,
            'posReport' => $view === 'pos' ? $operations->pos($user, $filters) : null,
            'healthReport' => $view === 'health' ? $operations->health($user) : null,
            'summary' => [
                'paid_orders' => $paidOrderCount,
                'revenue' => $paidRevenue,
                'customers' => User::where('role', User::CUSTOMER_ROLE)->count(),
                'products' => Product::count(),
                'average_order_value' => $paidOrderCount > 0 ? round($paidRevenue / $paidOrderCount, 2) : 0,
                'units_sold' => $unitsSold,
                'units_per_order' => $paidOrderCount > 0 ? round($unitsSold / $paidOrderCount, 2) : 0,
                'repeat_customer_rate' => $paidCustomerCount > 0 ? round(($repeatCustomerCount / $paidCustomerCount) * 100, 1) : 0,
                'discount_rate' => $grossSales > 0 ? round(($discounts / $grossSales) * 100, 1) : 0,
            ],
            'topProducts' => $topProducts,
            'salesByDay' => $salesByDay,
            'categoryPerformance' => $categoryPerformance,
            'purchaseSegments' => $purchaseSegments,
            'productPairs' => $productPairs,
            'couponPerformance' => $couponPerformance,
            'flashSalePerformance' => $flashSalePerformance,
        ]);
    }

    public function export(Request $request, OperationsReportService $operations)
    {
        $view = $request->string('view')->toString();
        if (! in_array($view, ['inventory', 'pos'], true)) {
            throw ValidationException::withMessages(['view' => 'Choose inventory or POS for CSV export.']);
        }

        $this->authorizeView($request->user(), $view);
        $filters = $request->validate([
            'view' => ['required', 'string', 'in:inventory,pos'],
            'location_id' => ['nullable', 'integer', 'exists:locations,id'],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'q' => ['nullable', 'string', 'max:120'],
            'stock_status' => ['nullable', 'string', 'in:low,out'],
        ]);

        $filename = $view.'-report-'.now()->format('Ymd-His').'.csv';
        $report = $view === 'inventory'
            ? $operations->inventory($request->user(), $filters)
            : $operations->pos($request->user(), $filters);

        return response()->streamDownload(function () use ($view, $report) {
            $output = fopen('php://output', 'w');
            if ($view === 'inventory') {
                fputcsv($output, ['Warehouse', 'Product', 'SKU', 'On hand', 'Reserved', 'Available', 'Reorder point', 'Original value', 'Retail price']);
                foreach ($report['stock_rows'] as $row) {
                    fputcsv($output, [
                        $row->location_name, $row->product_name, $row->sku_code, $row->on_hand_qty,
                        $row->reserved_qty, $row->available_qty, $row->reorder_point, $row->cost_value, $row->price,
                    ]);
                }
            } else {
                fputcsv($output, ['Warehouse', 'Register', 'Cashier', 'Status', 'Opened', 'Closed', 'Cash sales', 'Expected cash', 'Counted cash', 'Variance']);
                foreach ($report['shifts'] as $row) {
                    fputcsv($output, [
                        $row->location_name, $row->register_name, $row->cashier_name, $row->status,
                        $row->opened_at, $row->closed_at, $row->cash_sales, $row->expected_cash, $row->counted_cash, $row->variance,
                    ]);
                }
            }
            fclose($output);
        }, $filename, ['Content-Type' => 'text/csv']);
    }

    private function authorizeView(User $user, string $view): void
    {
        $allowed = match ($view) {
            'sales', 'pos' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.sales'),
            'inventory', 'health' => $user->hasAdminPermission('view_reports') || $user->hasAdminPermission('reports.inventory'),
            default => false,
        };

        abort_unless($allowed, 403, 'You do not have permission to view this report.');
    }
}
