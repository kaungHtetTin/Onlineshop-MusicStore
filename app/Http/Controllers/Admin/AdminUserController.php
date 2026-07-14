<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\StaffWelcomeNotification;
use App\Services\AuditLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::adminStaff()->latest();

        if ($request->filled('q')) {
            $term = '%'.$request->string('q')->trim().'%';
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', $term)->orWhere('email', 'like', $term);
            });
        }

        if ($request->filled('role') && in_array($request->role, User::ADMIN_ROLES, true)) {
            $query->where('role', $request->role);
        }

        if ($request->filled('status') && in_array($request->status, ['active', 'suspended'], true)) {
            $query->where('status', $request->status);
        }

        return Inertia::render('Admin/Users/Index', [
            'users' => $query->get(['id', 'name', 'email', 'phone', 'role', 'status', 'permissions', 'created_at', 'updated_at']),
            'filters' => [
                'q' => $request->string('q')->toString(),
                'role' => $request->string('role')->toString(),
                'status' => $request->string('status')->toString(),
            ],
            'roles' => User::adminRoleOptions(),
            'permissions' => User::adminPermissionOptions(),
        ]);
    }

    public function store(Request $request, AuditLogService $auditLogService)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'role' => ['required', Rule::in(User::ADMIN_ROLES)],
            'status' => ['required', Rule::in(['active', 'suspended'])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(array_keys(User::ADMIN_PERMISSIONS))],
        ]);

        $plainPassword = $validated['password'];

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'password' => Hash::make($plainPassword),
            'role' => $validated['role'],
            'status' => $validated['status'],
            'permissions' => $validated['permissions'] ?? [],
            'email_verified_at' => now(),
        ]);

        try {
            $user->notify(new StaffWelcomeNotification($plainPassword));
        } catch (\Throwable $e) {
            report($e);
        }
        $auditLogService->record('staff.created', $user, [
            'role' => $user->role,
            'permissions' => $user->permissions,
        ], $request);

        return redirect()->back()->with('success', 'Staff account created successfully.');
    }

    public function update(Request $request, User $user, AuditLogService $auditLogService)
    {
        $this->ensureStaffUser($user);
        $actor = $request->user();

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['nullable', 'string', 'max:30'],
            'password' => ['nullable', 'confirmed', Password::min(8)],
            'role' => ['required', Rule::in(User::ADMIN_ROLES)],
            'status' => ['required', Rule::in(['active', 'suspended'])],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in(array_keys(User::ADMIN_PERMISSIONS))],
        ]);

        if ($user->id === $actor->id) {
            if ($validated['role'] !== 'super_admin') {
                return redirect()->back()->withErrors(['role' => 'You cannot change your own role.']);
            }
            if ($validated['status'] !== 'active') {
                return redirect()->back()->withErrors(['status' => 'You cannot suspend your own account.']);
            }
        }

        if ($user->role === 'super_admin' && $validated['role'] !== 'super_admin') {
            $otherSuperAdmins = User::adminStaff()
                ->where('role', 'super_admin')
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherSuperAdmins === 0) {
                return redirect()->back()->withErrors(['role' => 'At least one Super Admin must remain.']);
            }
        }

        $payload = [
            'name' => $validated['name'],
            'email' => $validated['email'],
            'phone' => $validated['phone'] ?? null,
            'role' => $validated['role'],
            'status' => $validated['status'],
            'permissions' => $validated['permissions'] ?? [],
        ];

        if (! empty($validated['password'])) {
            $payload['password'] = Hash::make($validated['password']);
        }

        $user->update($payload);
        $auditLogService->record('staff.updated', $user, [
            'role' => $user->role,
            'status' => $user->status,
            'permissions' => $user->permissions,
        ], $request);

        return redirect()->back()->with('success', 'Staff account updated successfully.');
    }

    public function toggleStatus(Request $request, User $user, AuditLogService $auditLogService)
    {
        $this->ensureStaffUser($user);
        $actor = $request->user();

        if ($user->id === $actor->id) {
            return redirect()->back()->with('error', 'You cannot change your own account status.');
        }

        if ($user->role === 'super_admin' && $user->status === 'active') {
            $otherActiveSuperAdmins = User::adminStaff()
                ->where('role', 'super_admin')
                ->where('status', 'active')
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherActiveSuperAdmins === 0) {
                return redirect()->back()->with('error', 'At least one active Super Admin must remain.');
            }
        }

        $user->update([
            'status' => $user->status === 'active' ? 'suspended' : 'active',
        ]);

        $auditLogService->record('staff.status_toggled', $user, [
            'status' => $user->status,
        ], $request);

        return redirect()->back()->with('success', 'Account status updated.');
    }

    public function destroy(Request $request, User $user, AuditLogService $auditLogService)
    {
        $this->ensureStaffUser($user);
        $actor = $request->user();

        if ($user->id === $actor->id) {
            return redirect()->back()->with('error', 'You cannot delete your own account.');
        }

        if ($user->role === 'super_admin') {
            $otherSuperAdmins = User::adminStaff()
                ->where('role', 'super_admin')
                ->where('id', '!=', $user->id)
                ->count();

            if ($otherSuperAdmins === 0) {
                return redirect()->back()->with('error', 'At least one Super Admin must remain.');
            }
        }

        $auditLogService->record('staff.deleted', $user, [
            'role' => $user->role,
            'email' => $user->email,
        ], $request);
        $user->delete();

        return redirect()->back()->with('success', 'Staff account removed.');
    }

    private function ensureStaffUser(User $user): void
    {
        abort_unless(in_array($user->role, User::ADMIN_ROLES, true), 404);
    }
}
