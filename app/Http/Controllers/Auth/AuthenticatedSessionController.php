<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('Auth/Login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => session('status'),
            'error' => session('error'),
            'isAdminLogin' => $request->routeIs('admin.login'),
            'googleAuthAvailable' => filled(config('services.google.client_id')) && filled(config('services.google.client_secret')),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $adminRoles = ['super_admin', 'manager', 'cashier', 'support'];
        $user = $request->user();
        $isAdminLogin = $request->routeIs('admin.*') || $request->is('admin/*');

        if ($isAdminLogin) {
            if (! in_array($user->role, $adminRoles, true)) {
                Auth::guard('web')->logout();
                $request->session()->regenerateToken();

                throw ValidationException::withMessages([
                    'email' => 'These credentials do not have access to the admin area.',
                ]);
            }

            if ($user->status !== 'active') {
                Auth::guard('web')->logout();
                $request->session()->regenerateToken();

                throw ValidationException::withMessages([
                    'email' => 'Your account has been suspended.',
                ]);
            }

            return redirect()->intended('/admin/dashboard');
        }

        if (in_array($user->role, $adminRoles, true)) {
            Auth::guard('web')->logout();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => 'Staff accounts must use the admin login.',
            ]);
        }

        return redirect()->intended('/');
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $isAdminLogout = $request->routeIs('admin.*') || $request->is('admin/*');

        Auth::guard('web')->logout();

        $request->session()->invalidate();

        $request->session()->regenerateToken();

        return redirect($isAdminLogout ? '/admin/login' : '/');
    }
}
