<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class WishlistController extends Controller
{
    public function index()
    {
        return Inertia::render('User/Wishlist/Index');
    }
}
