import React, { useMemo } from 'react';
import { Paper, BottomNavigation, BottomNavigationAction, Box, Badge } from '@mui/material';
import { Home, ShoppingBag, ShoppingCart, ReceiptLong, Person } from '@mui/icons-material';
import { Link, usePage } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { useTheme } from '@mui/material/styles';
import { getMusicStoreColors } from '@/Components/User/musicStoreDesign';
import { useTranslation } from '@/Utils/i18n';

/** BottomNavigation height — use for chat layout padding above fixed nav */
export const MOBILE_BOTTOM_NAV_HEIGHT = 56;

export function MobileBottomNavSpacer() {
    return (
        <Box
            sx={{
                display: { xs: 'block', md: 'none' },
                height: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
                flexShrink: 0,
            }}
        />
    );
}

/**
 * Strip app subdirectory from the SPA `url` so matching works (e.g. `/larlarpick/public/products` -> `/products`).
 */
function normalizedPath(url, appBase) {
    let path = (url || '/').split('?')[0];
    const base = (appBase || '').replace(/\/+$/, '');
    if (base && base !== '/' && path.startsWith(base)) {
        path = path.slice(base.length) || '/';
    }
    path = path.replace(/\/+$/, '') || '/';
    return path;
}

/**
 * Bottom nav order: Home(0), Shop(1), Cart(2), Orders(3), Profile(4)
 */
function bottomNavIndex(path) {
    if (path.startsWith('/categories')) return 1;
    if (path.startsWith('/products')) return 1;
    if (path.startsWith('/wishlist')) return 1;
    if (path.startsWith('/cart') || path.startsWith('/checkout')) return 2;
    if (path.startsWith('/orders')) return 3;
    if (
        path.startsWith('/profile') ||
        path.startsWith('/login') ||
        path.startsWith('/register') ||
        path.startsWith('/chat')
    ) {
        return 4;
    }
    return 0;
}

const MobileBottomNav = () => {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const page = usePage();
    const { app_base, auth } = page.props;
    const cartCount = useCartStore((s) => s.itemCount());
    const t = useTranslation();

    const value = useMemo(() => bottomNavIndex(normalizedPath(page.url, app_base)), [page.url, app_base]);

    return (
        <Box sx={{ display: { xs: 'block', md: 'none' }, position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1200 }}>
            <Paper
                elevation={3}
                sx={{
                    borderRadius: '14px 14px 0 0',
                    overflow: 'hidden',
                    borderTop: `1px solid ${musicColors.amber}`,
                    bgcolor: musicColors.sheet,
                    boxShadow: '0 -12px 34px rgba(36,27,24,0.14)',
                }}
            >
                <BottomNavigation
                    showLabels
                    value={value}
                    onChange={() => {
                        /* Selection is driven by URL; each action uses SPA <Link> */
                    }}
                    sx={{
                        height: MOBILE_BOTTOM_NAV_HEIGHT,
                        bgcolor: musicColors.sheet,
                        '& .Mui-selected': { color: `${musicColors.rosin} !important` },
                    }}
                >
                    <BottomNavigationAction
                        label={t('storefront.home', 'Home')}
                        component={Link}
                        href={routeWithBase('/', app_base)}
                        icon={<Home sx={{ fontSize: '1.2rem' }} />}
                        sx={{ minWidth: 'auto', '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' } }}
                    />
                    <BottomNavigationAction
                        label={t('storefront.shop', 'Shop')}
                        component={Link}
                        href={routeWithBase('/products', app_base)}
                        icon={<ShoppingBag sx={{ fontSize: '1.2rem' }} />}
                        sx={{ minWidth: 'auto', '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' } }}
                    />
                    <BottomNavigationAction
                        label={t('storefront.cart', 'Cart')}
                        component={Link}
                        href={routeWithBase('/cart', app_base)}
                        icon={
                            <Badge
                                color="primary"
                                badgeContent={cartCount}
                                invisible={cartCount === 0}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.6rem', minWidth: 16, height: 16 } }}
                            >
                                <ShoppingCart sx={{ fontSize: '1.2rem' }} />
                            </Badge>
                        }
                        sx={{ minWidth: 'auto', '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' } }}
                    />
                    <BottomNavigationAction
                        label={t('storefront.orders', 'Orders')}
                        component={Link}
                        href={routeWithBase(auth?.user ? '/orders' : '/login', app_base)}
                        icon={<ReceiptLong sx={{ fontSize: '1.2rem' }} />}
                        sx={{ minWidth: 'auto', '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' } }}
                    />
                    <BottomNavigationAction
                        label={t('storefront.profile', 'Profile')}
                        component={Link}
                        href={routeWithBase(auth?.user ? '/profile' : '/login', app_base)}
                        icon={<Person sx={{ fontSize: '1.2rem' }} />}
                        sx={{ minWidth: 'auto', '& .MuiBottomNavigationAction-label': { fontSize: '0.65rem' } }}
                    />
                </BottomNavigation>
            </Paper>
        </Box>
    );
};

export default MobileBottomNav;
