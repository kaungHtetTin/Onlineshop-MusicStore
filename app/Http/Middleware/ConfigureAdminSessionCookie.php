<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Use a dedicated session cookie for /admin so staff login does not replace
 * the storefront customer session (and vice versa) in the same browser.
 */
class ConfigureAdminSessionCookie
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->requestUsesAdminSession($request)) {
            config([
                'session.cookie' => config('session.admin_cookie'),
            ]);
        }

        return $next($request);
    }

    private function requestUsesAdminSession(Request $request): bool
    {
        if ($request->routeIs('admin.*')) {
            return true;
        }

        $path = '/'.trim($request->path(), '/').'/';

        return str_contains($path, '/admin/') || str_ends_with(rtrim($path, '/'), '/admin');
    }
}
