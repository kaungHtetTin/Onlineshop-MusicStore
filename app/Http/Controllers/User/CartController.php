<?php

namespace App\Http\Controllers\User;

use App\Http\Controllers\Controller;
use Inertia\Inertia;

class CartController extends Controller
{
    public function index()
    {
        return Inertia::render('User/Cart/Index');
    }
}
