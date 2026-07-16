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
        $user = $request->user();
        $isAdminUser = $user?->isAdminStaff() ?? false;
        $authUser = $user?->toArray();

        if ($authUser && $isAdminUser) {
            unset($authUser['roles']);
            $authUser['role'] = $user->adminRoleName();
            $authUser['role_label'] = $user->adminRoleLabel();
            $authUser['permissions'] = $user->effectiveAdminPermissions();
        }

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
                'user' => $authUser,
            ],
            'is_super_admin' => $user?->isSuperAdmin() ?? false,
            'orders_pending_payment_count' => (function () use ($user, $isAdminUser) {
                if (! $isAdminUser || ! $user->hasAdminPermission('orders.view')) {
                    return 0;
                }

                return Order::where('payment_status', 'pending_review')->count();
            })(),
            'chat_unread_count' => (function () use ($user, $isAdminUser) {
                if (! $user) {
                    return 0;
                }

                $service = app(SupportChatService::class);

                if ($isAdminUser && $user->hasAdminPermission('chat.manage')) {
                    return $service->unreadCountAllCustomerMessages();
                }

                return $service->unreadCountForCustomer($user->id);
            })(),
        ]);
    }
}
