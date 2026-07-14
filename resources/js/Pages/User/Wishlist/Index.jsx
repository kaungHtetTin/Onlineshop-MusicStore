import React, { useEffect, useMemo, useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import { Box, Button, Container, Pagination, Paper, Stack, Typography } from '@mui/material';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import ProductCard from '@/Components/User/ProductCard';
import { routeWithBase } from '@/Utils/url';
import { productListGridSx } from '@/Utils/productListGrid';
import { useWishlistStore } from '@/stores/wishlistStore';

function wishlistItemToProduct(w) {
    return {
        id: w.productId,
        slug: w.slug,
        name: w.name,
        skus: w.skus || [],
        category: w.categoryName ? { name: w.categoryName } : null,
        primary_image: w.imagePath ? { image_path: w.imagePath } : null,
        rating: w.rating ?? 0,
        review_count: w.review_count ?? 0,
    };
}

export default function WishlistIndex() {
    const { app_base } = usePage().props;
    const items = useWishlistStore((s) => s.items);
    const perPage = 12;
    const [page, setPage] = useState(1);
    const pageCount = Math.max(1, Math.ceil(items.length / perPage));
    const paginatedItems = useMemo(() => {
        const start = (page - 1) * perPage;
        return items.slice(start, start + perPage);
    }, [items, page]);

    useEffect(() => {
        if (page > pageCount) {
            setPage(pageCount);
        }
    }, [page, pageCount]);

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', pb: { xs: 12, md: 4 } }}>
            <UserBrandHead title="Wishlist" />
            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, px: { xs: 2, sm: 3 } }}>
                <BackLink href={routeWithBase('/products', app_base)}>
                    Continue shopping
                </BackLink>

                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                    Wishlist
                </Typography>

                {items.length === 0 ? (
                    <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                            Save items you love — tap the heart on any product card.
                        </Typography>
                        <Button variant="contained" component={Link} href={routeWithBase('/products', app_base)}>
                            Browse products
                        </Button>
                    </Paper>
                ) : (
                    <>
                        <Box sx={{ ...productListGridSx, mb: 4 }}>
                            {paginatedItems.map((w) => (
                                <ProductCard key={w.productId} product={wishlistItemToProduct(w)} />
                            ))}
                        </Box>
                        {pageCount > 1 && (
                            <Stack alignItems="center" sx={{ mb: 4 }}>
                                <Pagination
                                    count={pageCount}
                                    page={page}
                                    onChange={(_event, value) => setPage(value)}
                                    color="primary"
                                />
                            </Stack>
                        )}
                    </>
                )}
            </Container>

            <Footer />
            <MobileBottomNav />
        </Box>
    );
}
