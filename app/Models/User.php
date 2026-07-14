<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    public const ADMIN_ROLES = ['super_admin', 'manager', 'cashier', 'support'];

    public const CUSTOMER_ROLE = 'customer';

    public const ADMIN_PERMISSIONS = [
        'manage_coupons' => 'Manage coupons',
        'manage_flash_sales' => 'Manage flash sales',
        'manage_blogs' => 'Manage blogs',
        'manage_payment_methods' => 'Manage payment methods',
        'manage_finance' => 'Manage finance',
        'moderate_reviews' => 'Moderate reviews',
        'view_customers' => 'View customers',
        'view_reports' => 'View reports',
        'view_audit_logs' => 'View audit logs',
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'email',
        'google_id',
        'auth_provider',
        'password',
        'phone',
        'avatar',
        'default_address',
        'role',
        'status',
        'permissions',
        'loyalty_points',
        'tier',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'permissions' => 'array',
    ];

    public function scopeAdminStaff(Builder $query): Builder
    {
        return $query->whereIn('role', self::ADMIN_ROLES);
    }

    public function isAdminStaff(): bool
    {
        return in_array($this->role, self::ADMIN_ROLES, true);
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === 'super_admin';
    }

    public function hasAdminPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return in_array($permission, $this->permissions ?? [], true);
    }

    public static function adminRoleOptions(): array
    {
        return [
            ['value' => 'super_admin', 'label' => 'Super Admin'],
            ['value' => 'manager', 'label' => 'Manager'],
            ['value' => 'cashier', 'label' => 'Cashier'],
            ['value' => 'support', 'label' => 'Support'],
        ];
    }

    public static function adminPermissionOptions(): array
    {
        return collect(self::ADMIN_PERMISSIONS)
            ->map(fn ($label, $value) => ['value' => $value, 'label' => $label])
            ->values()
            ->all();
    }

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function rewardHistories()
    {
        return $this->hasMany(RewardHistory::class);
    }

    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class);
    }
}
