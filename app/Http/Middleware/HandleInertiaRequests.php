<?php

namespace App\Http\Middleware;

use App\Models\Order;
use App\Services\AppSettingsService;
use App\Services\SupportChatService;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): string|null
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $configuredPath = parse_url(config('app.url'), PHP_URL_PATH) ?: '';
        $requestPath = parse_url(url('/'), PHP_URL_PATH) ?: '';
        $path = rtrim($configuredPath ?: $requestPath, '/');
        $appSettings = app(AppSettingsService::class)->publicSettings();

        return array_merge(parent::share($request), [
            'admin_app_url' => config('app.admin_app_url'),
            'app_url' => config('app.url'),
            'app_base' => $path,
            'app_settings' => $appSettings,
            'flash' => [
                'success' => $request->session()->get('success'),
                'error' => $request->session()->get('error'),
            ],
            'auth' => [
                'user' => $request->user(),
            ],
            'is_super_admin' => $request->user()?->role === 'super_admin',
            'orders_pending_payment_count' => (function () use ($request) {
                $user = $request->user();
                $adminRoles = ['super_admin', 'manager', 'cashier', 'support'];
                if (! $user || ! in_array($user->role ?? '', $adminRoles, true)) {
                    return 0;
                }

                return Order::where('payment_status', 'pending_review')->count();
            })(),
            'chat_unread_count' => (function () use ($request) {
                $user = $request->user();
                if (! $user) {
                    return 0;
                }

                $service = app(SupportChatService::class);
                $adminRoles = ['super_admin', 'manager', 'cashier', 'support'];

                if (in_array($user->role ?? '', $adminRoles, true)) {
                    return $service->unreadCountAllCustomerMessages();
                }

                return $service->unreadCountForCustomer($user->id);
            })(),
        ]);
    }
}
