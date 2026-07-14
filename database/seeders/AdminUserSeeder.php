<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        User::updateOrCreate(
            ['email' => 'admin@onlineshop.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'role' => 'super_admin',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );

        User::updateOrCreate(
            ['email' => 'manager@onlineshop.com'],
            [
                'name' => 'Shop Manager',
                'password' => Hash::make('password'),
                'role' => 'manager',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );
    }
}
