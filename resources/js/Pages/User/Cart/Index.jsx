import React from 'react';
import { Link, router, usePage } from '@inertiajs/react';
import {
    Box,
    Button,
    Container,
    Divider,
    IconButton,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { Add, DeleteOutlined, Remove } from '@mui/icons-material';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MOBILE_BOTTOM_NAV_HEIGHT } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';

export default function CartIndex() {
    const ORDER_QTY_MAX = 999;
    const { app_base, app_url, auth } = usePage().props;
    const items = useCartStore((s) => s.items);
    const setQty = useCartStore((s) => s.setQty);
    const removeItem = useCartStore((s) => s.removeItem);

    const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    return (
        <Box
            sx={{
                bgcolor: 'background.default',
                minHeight: '100dvh',
                pb: {
                    xs: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 12px)`,
                    md: 4,
                },
            }}
        >
            <UserBrandHead title="Your Cart" />
            <Navbar />

            <Container maxWidth="md" sx={{ mt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
                <BackLink href={routeWithBase('/products', app_base)}>
                    Continue shopping
                </BackLink>

                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                    Shopping cart
                </Typography>

                {items.length === 0 ? (
                    <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                            Your cart is empty.
                        </Typography>
                        <Button variant="contained" component={Link} href={routeWithBase('/products', app_base)}>
                            Browse products
                        </Button>
                    </Paper>
                ) : (
                    <Stack spacing={1.25}>
                        {items.map((line) => (
                            <Paper
                                key={line.skuId}
                                elevation={0}
                                sx={{
                                    p: { xs: 1.25, sm: 1.5 },
                                    borderRadius: 1.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    display: 'flex',
                                    flexDirection: 'row',
                                    alignItems: 'stretch',
                                    gap: { xs: 1, sm: 1.25 },
                                }}
                            >
                                <Box
                                    component="img"
                                    src={line.imagePath ? storageUrl(line.imagePath, app_url) : 'https://via.placeholder.com/300x400?text=No+Image'}
                                    alt=""
                                    sx={{
                                        width: { xs: 88, sm: 90 },
                                        aspectRatio: '3 / 4',
                                        height: 'auto',
                                        objectFit: 'cover',
                                        borderRadius: 1,
                                        alignSelf: 'flex-start',
                                    }}
                                />
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                        {line.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                                        {line.skuLabel}
                                    </Typography>
                                    {line.skuCode && (
                                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.25 }}>
                                            SKU: {line.skuCode}
                                        </Typography>
                                    )}
                                    {line.isPreorder && (
                                        <Typography variant="caption" color="warning.main" display="block" sx={{ fontWeight: 700 }}>
                                            Pre-order
                                        </Typography>
                                    )}
                                    {line.flashSale && (
                                        <Typography variant="caption" color="error.main" display="block" sx={{ fontWeight: 800 }}>
                                            Flash Sale
                                        </Typography>
                                    )}
                                    <Typography variant="body2" color="primary" sx={{ fontWeight: 800 }}>
                                        ${Number(line.price).toFixed(2)} each
                                    </Typography>
                                    {line.flashSale && line.originalPrice && (
                                        <Typography variant="caption" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                            ${Number(line.originalPrice).toFixed(2)}
                                        </Typography>
                                    )}
                                </Box>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'flex-end',
                                        justifyContent: 'flex-end',
                                        gap: 0.75,
                                        ml: 'auto',
                                        width: 'auto',
                                    }}
                                >
                                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                        ${(line.price * line.qty).toFixed(2)}
                                    </Typography>
                                    <Stack
                                        direction="row"
                                        alignItems="center"
                                        spacing={0.5}
                                        justifyContent="flex-end"
                                        sx={{ width: 'auto' }}
                                    >
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                border: '1px solid',
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                bgcolor: 'background.paper',
                                            }}
                                        >
                                            <IconButton size="small" sx={{ p: 0.5 }} onClick={() => setQty(line.skuId, line.qty - 1)} disabled={line.qty <= 1}>
                                                <Remove fontSize="small" />
                                            </IconButton>
                                            <Typography sx={{ px: 1, minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: '0.9rem' }}>{line.qty}</Typography>
                                            <IconButton
                                                size="small"
                                                sx={{ p: 0.5 }}
                                                onClick={() => setQty(line.skuId, line.qty + 1)}
                                                disabled={line.qty >= ORDER_QTY_MAX}
                                            >
                                                <Add fontSize="small" />
                                            </IconButton>
                                        </Box>
                                        <IconButton size="small" color="error" sx={{ p: 0.5 }} onClick={() => removeItem(line.skuId)} aria-label="Remove">
                                            <DeleteOutlined />
                                        </IconButton>
                                    </Stack>
                                </Box>
                            </Paper>
                        ))}

                        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                    Subtotal
                                </Typography>
                                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                    ${subtotal.toFixed(2)}
                                </Typography>
                            </Stack>
                            <Divider sx={{ my: 2 }} />
                            <Button
                                fullWidth
                                variant="contained"
                                size="large"
                                sx={{ py: 1.5, fontWeight: 800, borderRadius: 2 }}
                                onClick={() => {
                                    if (!auth?.user) {
                                        router.visit(routeWithBase('/login', app_base));
                                        return;
                                    }
                                    router.visit(routeWithBase('/checkout', app_base));
                                }}
                            >
                                {auth?.user ? 'Proceed to checkout' : 'Log in to checkout'}
                            </Button>
                        </Paper>
                    </Stack>
                )}
            </Container>

            <Footer />
            <MobileBottomNav />
        </Box>
    );
}
