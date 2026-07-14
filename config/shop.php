<?php

return [
    'tax_rate' => (float) env('SHOP_TAX_RATE', 0.05),
    'shipping_flat' => (float) env('SHOP_SHIPPING_FLAT', 4.99),
    'free_shipping_minimum' => (float) env('SHOP_FREE_SHIPPING_MIN', 50),
];
