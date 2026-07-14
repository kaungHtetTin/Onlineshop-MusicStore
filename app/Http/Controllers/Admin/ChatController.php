<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ChatController extends Controller
{
    public function index(Request $request)
    {
        return Inertia::render('Admin/Chats/Index');
    }

    public function show(Request $request, User $user)
    {
        return Inertia::render('Admin/Chats/Show', [
            'customer' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }
}
