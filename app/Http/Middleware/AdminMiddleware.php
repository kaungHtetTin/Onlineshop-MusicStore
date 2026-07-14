<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     * @return \Illuminate\Http\Response|\Illuminate\Http\RedirectResponse
     */
    public function handle(Request $request, Closure $next)
    {
        $adminRoles = ['super_admin', 'manager', 'cashier', 'support'];

        if (auth()->check() && in_array(auth()->user()->role, $adminRoles)) {
            if (auth()->user()->status !== 'active') {
                auth()->logout();
                if ($request->expectsJson() || $request->wantsJson()) {
                    return response()->json(['message' => 'Your account has been suspended.'], 403);
                }

                return redirect('/admin/login')->with('error', 'Your account has been suspended.');
            }

            return $next($request);
        }

        if ($request->expectsJson() || $request->wantsJson()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        return redirect('/admin/login')->with('error', 'You do not have admin access.');
    }
}
