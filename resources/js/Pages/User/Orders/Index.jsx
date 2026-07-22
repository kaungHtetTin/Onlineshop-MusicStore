import React from 'react';
import { Link, router, usePage } from '@/spa/router';
import { Box, Button, Chip, Container, Pagination, Paper, Stack, Typography } from '@mui/material';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

const statusColor = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'default',
};

const paymentStatusColor = {
    pending_review: 'warning',
    paid: 'success',
    rejected: 'error',
};

const paymentLabels = {
    pending_review: 'Awaiting verification',
    paid: 'Confirmed',
    rejected: 'Rejected',
};

export default function OrdersIndex({ orders }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const handlePageChange = (_event, page) => {
        router.get(routeWithBase('/orders', app_base), { page }, { preserveScroll: false, preserveState: true });
    };

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="My orders" />
            <Navbar />

            <Container maxWidth="md" sx={{ mt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
                <BackLink href={routeWithBase('/products', app_base)}>
                    {t('Back to shop')}
                </BackLink>

                <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
                    {t('My orders')}
                </Typography>

                {orders.data.length === 0 ? (
                    <Paper elevation={0} sx={{ p: 4, borderRadius: 2, border: '1px solid', borderColor: 'divider', textAlign: 'center' }}>
                        <Typography color="text.secondary" sx={{ mb: 2 }}>
                            {t('You have not placed any orders yet.')}
                        </Typography>
                        <Button variant="contained" component={Link} href={routeWithBase('/products', app_base)}>
                            {t('Start shopping')}
                        </Button>
                    </Paper>
                ) : (
                    <Stack spacing={1.5}>
                        {orders.data.map((order) => (
                            <Paper
                                key={order.id}
                                component={Link}
                                href={routeWithBase(`/orders/${order.id}`, app_base)}
                                elevation={0}
                                sx={{
                                    p: 2,
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    display: 'block',
                                    '&:hover': { borderColor: 'primary.light', bgcolor: 'rgba(233,30,99,0.02)' },
                                }}
                            >
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
                                    <Box>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                            {order.order_number}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {order.created_at}
                                        </Typography>
                                    </Box>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Chip size="small" label={t(order.status)} color={statusColor[order.status] || 'default'} variant="outlined" />
                                        <Chip
                                            size="small"
                                            label={t(paymentLabels[order.payment_status] || order.payment_status)}
                                            color={paymentStatusColor[order.payment_status] || 'default'}
                                            variant="outlined"
                                        />
                                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                            {formatMoney(order.final_amount)}
                                        </Typography>
                                    </Stack>
                                </Stack>
                            </Paper>
                        ))}
                    </Stack>
                )}

                {orders.last_page > 1 && (
                    <Stack spacing={1} alignItems="center" sx={{ mt: 3 }}>
                        <Pagination
                            count={orders.last_page}
                            page={orders.current_page}
                            onChange={handlePageChange}
                            color="primary"
                        />
                        <Typography variant="caption" sx={{ alignSelf: 'center' }}>
                            {t('Page')} {orders.current_page} {t('of')} {orders.last_page}
                        </Typography>
                    </Stack>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
