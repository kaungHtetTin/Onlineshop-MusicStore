import React from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Box,
    Container,
    Typography,
    Paper,
    Stack,
    Avatar,
    Chip,
    Button,
    Pagination,
} from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';

function categoryVisual(cat) {
    return {
        emoji: cat.metadata?.icon || cat.icon || '🛍️',
        imageUrl: cat.icon_image_url || null,
        accent: cat.metadata?.color || '#FCE4EC',
    };
}

export default function CategoriesIndex({ categories = [] }) {
    const { app_base } = usePage().props;
    const categoryRows = categories.data || categories;

    const handlePageChange = (_event, page) => {
        router.get(routeWithBase('/categories', app_base), { page }, { preserveScroll: false, preserveState: true });
    };

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', pb: { xs: 12, md: 4 } }}>
            <UserBrandHead title="Categories" />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
                <BackLink href={routeWithBase('/', app_base)}>
                    Back to home
                </BackLink>

                <Box sx={{ mb: 3 }}>
                    <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: '-0.02em', mb: 0.5 }}>
                        Shop by category
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, maxWidth: 520 }}>
                        Browse romantic picks by category — tap a tile to explore, or jump straight to products.
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: {
                            xs: 'repeat(2, minmax(0, 1fr))',
                            sm: 'repeat(3, minmax(0, 1fr))',
                            md: 'repeat(4, minmax(0, 1fr))',
                        },
                        gap: { xs: 1.5, sm: 2 },
                    }}
                >
                    {categoryRows.map((cat) => {
                        const v = categoryVisual(cat);
                        const count = cat.products_count ?? 0;
                        const subs = cat.children || [];

                        return (
                            <Paper
                                key={cat.id}
                                component={Link}
                                href={routeWithBase(`/categories/${cat.slug}`, app_base)}
                                elevation={0}
                                sx={{
                                    p: 2,
                                    borderRadius: 3,
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    border: '1px solid rgba(233, 30, 99, 0.12)',
                                    background:
                                        'linear-gradient(145deg, rgba(255,255,255,0.95) 0%, rgba(255,245,248,0.98) 100%)',
                                    boxShadow: '0 12px 40px rgba(233, 30, 99, 0.06)',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'stretch',
                                    minHeight: { xs: 148, sm: 160 },
                                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                                    '&:hover': {
                                        transform: 'translateY(-3px)',
                                        boxShadow: '0 18px 48px rgba(233, 30, 99, 0.12)',
                                    },
                                }}
                            >
                                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                                    <Avatar
                                        src={v.imageUrl || undefined}
                                        sx={{
                                            width: { xs: 44, sm: 52 },
                                            height: { xs: 44, sm: 52 },
                                            bgcolor: v.accent,
                                            borderRadius: 2,
                                            fontSize: '1.35rem',
                                            flexShrink: 0,
                                            '& img': { objectFit: 'cover' },
                                        }}
                                    >
                                        {v.emoji}
                                    </Avatar>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{ fontWeight: 900, lineHeight: 1.25, mb: 0.25 }}
                                            noWrap
                                        >
                                            {cat.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }}>
                                            {count} {count === 1 ? 'item' : 'items'}
                                        </Typography>
                                    </Box>
                                    <ChevronRight sx={{ fontSize: 20, color: 'primary.main', opacity: 0.7, flexShrink: 0 }} />
                                </Stack>

                                {cat.description ? (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                        sx={{
                                            mt: 1.25,
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical',
                                            overflow: 'hidden',
                                            fontWeight: 600,
                                            lineHeight: 1.45,
                                        }}
                                    >
                                        {cat.description}
                                    </Typography>
                                ) : null}

                                {subs.length > 0 ? (
                                    <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 'auto', pt: 1.5 }}>
                                        {subs.slice(0, 3).map((sub) => (
                                            <Chip
                                                key={sub.id}
                                                component={Link}
                                                href={routeWithBase(`/categories/${sub.slug}`, app_base)}
                                                label={sub.name}
                                                size="small"
                                                onClick={(e) => e.stopPropagation()}
                                                sx={{
                                                    height: 22,
                                                    fontSize: '0.65rem',
                                                    fontWeight: 700,
                                                    '& .MuiChip-label': { px: 0.75 },
                                                }}
                                            />
                                        ))}
                                        {subs.length > 3 ? (
                                            <Chip label={`+${subs.length - 3}`} size="small" sx={{ height: 22, fontSize: '0.65rem' }} />
                                        ) : null}
                                    </Stack>
                                ) : null}
                            </Paper>
                        );
                    })}
                </Box>

                {categoryRows.length === 0 ? (
                    <Paper sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}>
                        <Typography color="text.secondary" sx={{ fontWeight: 700, mb: 2 }}>
                            No categories available yet.
                        </Typography>
                        <Button component={Link} href={routeWithBase('/products', app_base)} variant="contained">
                            Browse all products
                        </Button>
                    </Paper>
                ) : (
                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Button
                            component={Link}
                            href={routeWithBase('/products', app_base)}
                            variant="outlined"
                            color="primary"
                            sx={{ fontWeight: 800, borderRadius: 999, px: 3 }}
                        >
                            View all products
                        </Button>
                    </Box>
                )}

                {categories.last_page > 1 && (
                    <Stack alignItems="center" sx={{ mt: 3, mb: 2 }}>
                        <Pagination
                            count={categories.last_page}
                            page={categories.current_page}
                            onChange={handlePageChange}
                            color="primary"
                        />
                    </Stack>
                )}
            </Container>

            <Footer />
            <MobileBottomNav />
        </Box>
    );
}
