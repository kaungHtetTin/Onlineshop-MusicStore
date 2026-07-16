<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use App\Services\OrderManagementService;
use App\Support\Spa;

class DashboardController extends Controller
{
    public function index(OrderManagementService $orderManagementService)
    {
        $stats = $orderManagementService->stats();

        $recentOrders = Order::query()
            ->with(['user:id,name,email', 'items'])
            ->withCount('items')
            ->latest()
            ->limit(6)
            ->get();

        return Spa::render('Admin/Dashboard', [
            'stats' => $stats,
            'recentOrders' => $recentOrders,
            'productCount' => Product::count(),
            'customerCount' => User::where('role', 'customer')->count(),
        ]);
    }

    public function uiShowcase()
    {
        return Spa::render('Admin/UiShowcase');
    }
}
