<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

use App\Models\User;
use App\Models\Role;
use App\Models\Location;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     *
     * @return void
     */
    public function run()
    {
        $admin = User::updateOrCreate(
            ['email' => 'admin@onlineshop.com'],
            [
                'name' => 'Super Admin',
                'password' => Hash::make('password'),
                'role' => 'super_admin',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );
        $admin->roles()->sync([Role::query()->where('name', 'super_admin')->value('id')]);

        $manager = User::updateOrCreate(
            ['email' => 'manager@onlineshop.com'],
            [
                'name' => 'Shop Manager',
                'password' => Hash::make('password'),
                'role' => 'manager',
                'status' => 'active',
                'email_verified_at' => now(),
            ]
        );
        $manager->roles()->sync([Role::query()->where('name', 'manager')->value('id')]);

        if (Schema::hasTable('locations')) {
            $locationAssignments = Location::query()
                ->get()
                ->mapWithKeys(fn (Location $location) => [$location->id => [
                    'is_default' => $location->code === 'MAIN-WH',
                ]])
                ->all();

            $admin->locations()->sync($locationAssignments);
            $manager->locations()->sync($locationAssignments);
        }
    }
}
