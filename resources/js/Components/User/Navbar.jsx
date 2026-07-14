import React, { useEffect, useState } from 'react';
import { AppBar, Toolbar, Typography, IconButton, Badge, InputBase, Box, Container } from '@mui/material';
import { Search, ShoppingCart, ChatBubbleOutlined, Favorite } from '@mui/icons-material';
import { styled, alpha } from '@mui/material/styles';
import { Link, router, usePage } from '@inertiajs/react';
import { routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import ProfileMenu from '@/Components/User/ProfileMenu';

const SearchContainer = styled('form')(({ theme }) => ({
    position: 'relative',
    borderRadius: 4, // Sharp edges
    backgroundColor: alpha(theme.palette.common.white, 0.8),
    '&:hover': {
        backgroundColor: alpha(theme.palette.common.white, 1),
    },
    marginRight: theme.spacing(1),
    marginLeft: 0,
    width: '100%',
    [theme.breakpoints.up('sm')]: {
        marginLeft: theme.spacing(2),
        width: 'auto',
    },
    border: '1px solid rgba(0, 0, 0, 0.1)',
    minWidth: 0,
}));

const SearchIconWrapper = styled('button')(({ theme }) => ({
    padding: theme.spacing(0, 1.25),
    height: '100%',
    position: 'absolute',
    left: 0,
    top: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.palette.primary.main,
    border: 0,
    background: 'transparent',
    cursor: 'pointer',
    '&:hover': {
        color: theme.palette.secondary.main,
    },
}));

const StyledInputBase = styled(InputBase)((({ theme }) => ({
    color: theme.palette.text.primary,
    width: '100%',
    '& .MuiInputBase-input': {
        padding: theme.spacing(0.75, 1, 0.75, 0),
        paddingLeft: `calc(1em + ${theme.spacing(3)})`,
        transition: theme.transitions.create('width'),
        fontSize: '0.85rem',
        fontWeight: 600,
        color: theme.palette.text.primary,
        '&::placeholder': {
            color: alpha(theme.palette.text.secondary, 0.9),
            opacity: 1,
            fontWeight: 500,
        },
        width: '100%',
        [theme.breakpoints.up('md')]: {
            width: '25ch',
        },
    },
})));

const Navbar = () => {
    const { app_base, auth, chat_unread_count, app_settings } = usePage().props;
    const { url } = usePage();
    const [search, setSearch] = useState('');
    const cartCount = useCartStore((s) => s.itemCount());
    const wishCount = useWishlistStore((s) => s.count());
    const appName = app_settings?.app_name || 'LaLaPick';

    useEffect(() => {
        const queryString = typeof url === 'string' ? url.split('?')[1] : '';
        const params = new URLSearchParams(queryString || '');
        setSearch(params.get('search') || '');
    }, [url]);

    const submitSearch = (event) => {
        event.preventDefault();

        const term = search.trim();
        router.get(
            routeWithBase('/products', app_base),
            term ? { search: term } : {},
            {
                preserveScroll: false,
                preserveState: false,
            },
        );
    };

    const renderSearch = (placeholder) => (
        <SearchContainer onSubmit={submitSearch}>
            <SearchIconWrapper type="submit" aria-label="Search products">
                <Search sx={{ fontSize: '1.1rem' }} />
            </SearchIconWrapper>
            <StyledInputBase
                placeholder={placeholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                inputProps={{ 'aria-label': 'Search products' }}
            />
        </SearchContainer>
    );

    return (
        <AppBar position="sticky" elevation={0} sx={{ 
            bgcolor: 'rgba(255, 255, 255, 0.9)', 
            backdropFilter: 'blur(8px)',
            borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
            zIndex: 1100
        }}>
            <Container maxWidth="lg">
                <Toolbar variant="dense" sx={{ px: { xs: 0, sm: 1 }, minHeight: { xs: 50, sm: 56 } }}>
                    <Box
                        component={Link}
                        href={routeWithBase('/', app_base)}
                        sx={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 1,
                            minWidth: 0,
                            mr: { xs: 0.75, sm: 2 },
                            color: 'primary.main',
                            textDecoration: 'none',
                        }}
                    >
                        {app_settings?.logo_url ? (
                            <Box
                                component="img"
                                src={app_settings.logo_url}
                                alt=""
                                sx={{
                                    width: { xs: 28, sm: 30 },
                                    height: { xs: 28, sm: 30 },
                                    objectFit: 'contain',
                                    borderRadius: 1,
                                }}
                            />
                        ) : (
                            <Box
                                sx={{
                                    width: { xs: 28, sm: 30 },
                                    height: { xs: 28, sm: 30 },
                                    display: 'grid',
                                    placeItems: 'center',
                                    borderRadius: 1,
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    fontSize: '0.72rem',
                                    fontWeight: 900,
                                }}
                            >
                                {appName.slice(0, 2).toUpperCase()}
                            </Box>
                        )}
                        <Typography
                            variant="subtitle1"
                            noWrap
                            sx={{
                                maxWidth: { xs: 120, sm: 180 },
                                display: { xs: 'none', sm: 'block' },
                                fontWeight: 800,
                                color: 'primary.main',
                                fontFamily: '"Poppins", sans-serif',
                            }}
                        >
                            {appName}
                        </Typography>
                    </Box>

                    <Box sx={{ flexGrow: 1 }} />
                    
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        {renderSearch('Search products...')}
                    </Box>

                    <Box sx={{ display: 'flex', gap: { xs: 0.25, sm: 0.5 }, alignItems: 'center' }}>
                        <IconButton
                            size="small"
                            color="primary"
                            aria-label="Open support chat"
                            component={Link}
                            href={routeWithBase(auth?.user ? '/chat' : '/login', app_base)}
                        >
                            <Badge
                                badgeContent={chat_unread_count || 0}
                                color="secondary"
                                invisible={!chat_unread_count}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                            >
                                <ChatBubbleOutlined sx={{ fontSize: '1.25rem' }} />
                            </Badge>
                        </IconButton>
                        <IconButton
                            size="small"
                            color="primary"
                            sx={{ display: { xs: 'none', sm: 'flex' } }}
                            component={Link}
                            href={routeWithBase('/wishlist', app_base)}
                            aria-label="Wishlist"
                        >
                            <Badge
                                badgeContent={wishCount}
                                color="secondary"
                                invisible={wishCount === 0}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                            >
                                <Favorite sx={{ fontSize: '1.25rem' }} />
                            </Badge>
                        </IconButton>
                        <IconButton 
                            size="small" 
                            color="primary"
                            component={Link}
                            href={routeWithBase('/cart', app_base)}
                        >
                            <Badge
                                badgeContent={cartCount}
                                color="secondary"
                                invisible={cartCount === 0}
                                sx={{ '& .MuiBadge-badge': { fontSize: '0.65rem', height: 16, minWidth: 16 } }}
                            >
                                <ShoppingCart sx={{ fontSize: '1.25rem' }} />
                            </Badge>
                        </IconButton>
                        <ProfileMenu />
                    </Box>
                </Toolbar>
                <Box sx={{ pb: 1, px: 1, display: { xs: 'block', md: 'none' } }}>
                    {renderSearch('Search lovely items...')}
                </Box>
            </Container>
        </AppBar>
    );
};

export default Navbar;
