<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class EnsureOrderPaymentReviewer
{
    /**
     * @param  \Closure(\Illuminate\Http\Request): (\Illuminate\Http\Response|\Illuminate\Http\RedirectResponse)  $next
     */
    public function handle(Request $request, Closure $next)
    {
        $role = auth()->user()?->role;

        if (! in_array($role, ['super_admin', 'manager'], true)) {
            if ($request->expectsJson() || $request->wantsJson()) {
                return response()->json(['message' => 'Only managers can review order payments.'], 403);
            }

            abort(403, 'Only managers can review order payments.');
        }

        return $next($request);
    }
}
