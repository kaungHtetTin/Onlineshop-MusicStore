<?php

use App\Http\Controllers\Admin\AdminUserController;
use App\Http\Controllers\Admin\AuditLogController;
use App\Http\Controllers\Admin\BlogController;
use App\Http\Controllers\Admin\CouponController;
use App\Http\Controllers\Admin\CustomerController;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\CategoryController;
use App\Http\Controllers\Admin\FinanceController;
use App\Http\Controllers\Admin\FlashSaleController;
use App\Http\Controllers\Admin\ProductController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\ReviewController;
use App\Http\Controllers\Admin\ChatController;
use App\Http\Controllers\Admin\OrderController;
use App\Http\Controllers\Admin\OrderReturnController;
use App\Http\Controllers\Admin\OrderVoucherController;
use App\Http\Controllers\Admin\PaymentMethodController;
use App\Http\Controllers\Admin\SettingController;
use App\Http\Controllers\Admin\StorefrontController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\ProfileController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->name('login.store');
});

Route::middleware(['auth', 'admin'])->group(function () {
    Route::get('/', [DashboardController::class, 'index'])->name('home');
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/ui-showcase', [DashboardController::class, 'uiShowcase'])->name('ui-showcase');

    // Categories
    Route::get('/categories', [CategoryController::class, 'index'])->name('categories.index');
    Route::post('/categories', [CategoryController::class, 'store'])->name('categories.store');
    Route::post('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update.post');
    Route::patch('/categories/{category}', [CategoryController::class, 'update'])->name('categories.update');
    Route::delete('/categories/{category}', [CategoryController::class, 'destroy'])->name('categories.destroy');

    // Products
    Route::get('/products', [ProductController::class, 'index'])->name('products.index');
    Route::get('/products/create', [ProductController::class, 'create'])->name('products.create');
    Route::post('/products', [ProductController::class, 'store'])->name('products.store');
    Route::get('/products/{product}/edit', [ProductController::class, 'edit'])->name('products.edit');
    Route::patch('/products/{product}', [ProductController::class, 'update'])->name('products.update');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
    Route::get('/orders', [OrderController::class, 'index'])->name('orders.index');
    Route::get('/orders/{order}', [OrderController::class, 'show'])->name('orders.show');
    Route::get('/orders/{order}/voucher', [OrderVoucherController::class, 'show'])->name('orders.voucher.show');
    Route::get('/orders/{order}/voucher/pdf', [OrderVoucherController::class, 'pdf'])->name('orders.voucher.pdf');
    Route::post('/orders/{order}/voucher/link', [OrderVoucherController::class, 'link'])->name('orders.voucher.link');
    Route::post('/orders/{order}/returns', [OrderReturnController::class, 'store'])
        ->middleware('order.payment.reviewer')
        ->name('orders.returns.store');
    Route::patch('/order-returns/{orderReturn}', [OrderReturnController::class, 'update'])
        ->middleware('order.payment.reviewer')
        ->name('order-returns.update');
    Route::post('/orders/{order}/confirm-payment', [OrderController::class, 'confirmPayment'])
        ->middleware('order.payment.reviewer')
        ->name('orders.confirm-payment');
    Route::post('/orders/{order}/reject-payment', [OrderController::class, 'rejectPayment'])
        ->middleware('order.payment.reviewer')
        ->name('orders.reject-payment');
    Route::patch('/orders/{order}/status', [OrderController::class, 'updateStatus'])
        ->middleware('order.staff')
        ->name('orders.update-status');
    Route::patch('/orders/{order}/notes', [OrderController::class, 'updateNotes'])
        ->middleware('order.staff')
        ->name('orders.update-notes');
    Route::post('/orders/{order}/cancel', [OrderController::class, 'cancel'])
        ->middleware('order.payment.reviewer')
        ->name('orders.cancel');

    Route::get('/chats', [ChatController::class, 'index'])->name('chats.index');
    Route::get('/chats/{user}', [ChatController::class, 'show'])->name('chats.show');

    Route::middleware('admin.permission:manage_coupons')->group(function () {
        Route::get('/coupons', [CouponController::class, 'index'])->name('coupons.index');
        Route::post('/coupons', [CouponController::class, 'store'])->name('coupons.store');
        Route::patch('/coupons/{coupon}', [CouponController::class, 'update'])->name('coupons.update');
        Route::delete('/coupons/{coupon}', [CouponController::class, 'destroy'])->name('coupons.destroy');
    });

    Route::middleware('admin.permission:manage_flash_sales')->group(function () {
        Route::get('/flash-sales', [FlashSaleController::class, 'index'])->name('flash-sales.index');
        Route::get('/flash-sales/create', [FlashSaleController::class, 'create'])->name('flash-sales.create');
        Route::post('/flash-sales', [FlashSaleController::class, 'store'])->name('flash-sales.store');
        Route::get('/flash-sales/{flashSale}/edit', [FlashSaleController::class, 'edit'])->name('flash-sales.edit');
        Route::patch('/flash-sales/{flashSale}', [FlashSaleController::class, 'update'])->name('flash-sales.update');
        Route::delete('/flash-sales/{flashSale}', [FlashSaleController::class, 'destroy'])->name('flash-sales.destroy');
    });

    Route::middleware('admin.permission:manage_blogs')->group(function () {
        Route::get('/blogs', [BlogController::class, 'index'])->name('blogs.index');
        Route::get('/blogs/create', [BlogController::class, 'create'])->name('blogs.create');
        Route::post('/blogs', [BlogController::class, 'store'])->name('blogs.store');
        Route::get('/blogs/{blog}/edit', [BlogController::class, 'edit'])->name('blogs.edit');
        Route::post('/blogs/{blog}', [BlogController::class, 'update'])->name('blogs.update.post');
        Route::patch('/blogs/{blog}', [BlogController::class, 'update'])->name('blogs.update');
        Route::delete('/blogs/{blog}', [BlogController::class, 'destroy'])->name('blogs.destroy');
    });

    Route::get('/storefront', [StorefrontController::class, 'edit'])->name('storefront.edit');
    Route::post('/storefront', [StorefrontController::class, 'update'])->name('storefront.update');

    Route::middleware('admin.permission:moderate_reviews')->group(function () {
        Route::get('/reviews', [ReviewController::class, 'index'])->name('reviews.index');
        Route::patch('/reviews/{review}', [ReviewController::class, 'update'])->name('reviews.update');
        Route::delete('/reviews/{review}', [ReviewController::class, 'destroy'])->name('reviews.destroy');
    });

    Route::middleware('admin.permission:view_customers')->group(function () {
        Route::get('/customers', [CustomerController::class, 'index'])->name('customers.index');
        Route::get('/customers/{customer}', [CustomerController::class, 'show'])->name('customers.show');
    });

    Route::middleware('admin.permission:view_reports')->group(function () {
        Route::get('/reports', [ReportController::class, 'index'])->name('reports.index');
    });

    Route::middleware('admin.permission:manage_finance')->group(function () {
        Route::get('/finance', [FinanceController::class, 'index'])->name('finance.index');
        Route::post('/finance/entries', [FinanceController::class, 'store'])->name('finance.entries.store');
        Route::patch('/finance/entries/{entry}', [FinanceController::class, 'update'])->name('finance.entries.update');
        Route::delete('/finance/entries/{entry}', [FinanceController::class, 'destroy'])->name('finance.entries.destroy');
    });

    Route::middleware('admin.permission:manage_payment_methods')->group(function () {
        Route::get('/payment-methods', [PaymentMethodController::class, 'index'])->name('payment-methods.index');
        Route::post('/payment-methods', [PaymentMethodController::class, 'store'])->name('payment-methods.store');
        Route::post('/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update'])->name('payment-methods.update.post');
        Route::patch('/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'update'])->name('payment-methods.update');
        Route::delete('/payment-methods/{paymentMethod}', [PaymentMethodController::class, 'destroy'])->name('payment-methods.destroy');
    });

    Route::get('/audit-logs', [AuditLogController::class, 'index'])
        ->middleware('admin.permission:view_audit_logs')
        ->name('audit-logs.index');

    Route::middleware('super_admin')->group(function () {
        Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
        Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
        Route::patch('/users/{user}', [AdminUserController::class, 'update'])->name('users.update');
        Route::patch('/users/{user}/toggle-status', [AdminUserController::class, 'toggleStatus'])->name('users.toggle-status');
        Route::delete('/users/{user}', [AdminUserController::class, 'destroy'])->name('users.destroy');

        Route::get('/settings', [SettingController::class, 'edit'])->name('settings.edit');
        Route::post('/settings', [SettingController::class, 'update'])->name('settings.update');
    });

    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::post('/profile', [ProfileController::class, 'update'])->name('profile.update.post');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});
