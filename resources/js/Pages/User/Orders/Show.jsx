import React, { useState } from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    Alert,
    Box,
    Button,
    Chip,
    Container,
    Dialog,
    DialogContent,
    Divider,
    IconButton,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { Close } from '@mui/icons-material';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase, storageUrl } from '@/Utils/url';

const statusColor = {
    pending: 'warning',
    processing: 'info',
    shipped: 'primary',
    delivered: 'success',
    cancelled: 'default',
};

const orderStatusLabels = {
    pending: 'Pending',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
    cancelled: 'Cancelled',
};

const paymentStatusColor = {
    pending_review: 'warning',
    paid: 'success',
    rejected: 'error',
};

export default function OrdersShow({ order, paymentStatusLabels = {} }) {
    const { app_base, app_url, flash } = usePage().props;
    const [proofLightbox, setProofLightbox] = useState(false);

    const paymentLabel = paymentStatusLabels[order.payment_status] || order.payment_status;
    const proofUrl = order.payment_proof_url || storageUrl(order.payment_proof_path, app_url);

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title={`Order ${order.order_number}`} />
            <Navbar />

            <Container maxWidth="md" sx={{ mt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
                <BackLink href={routeWithBase('/orders', app_base)}>
                    All orders
                </BackLink>

                {flash?.success && (
                    <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                        {flash.success}
                    </Alert>
                )}

                {order.payment_status === 'rejected' && (
                    <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 0.5 }}>
                            Payment not accepted
                        </Typography>
                        <Typography variant="body2">
                            {order.payment_rejection_reason ||
                                'Your payment could not be verified. Please place a new order with a valid transfer screenshot.'}
                        </Typography>
                    </Alert>
                )}

                {order.payment_status === 'pending_review' && (
                    <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                        Your payment screenshot is being reviewed. We will update this order once an admin confirms your transfer.
                    </Alert>
                )}

                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ sm: 'flex-start' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 800 }}>
                                {order.order_number}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Placed {order.created_at}
                            </Typography>
                        </Box>
                        <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
                            <Chip
                                size="small"
                                label={`Order: ${orderStatusLabels[order.status] || order.status}`}
                                color={statusColor[order.status] || 'default'}
                                variant="outlined"
                            />
                            <Chip
                                size="small"
                                label={`Payment: ${paymentLabel}`}
                                color={paymentStatusColor[order.payment_status] || 'default'}
                                variant="outlined"
                            />
                        </Stack>
                    </Stack>

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                        Ship to
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 0.5 }}>
                        {order.receiver_name} · {order.receiver_phone}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                        {order.shipping_address}
                    </Typography>

                    {order.order_notes && (
                        <>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 2, mb: 0.5 }}>
                                Notes
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                                {order.order_notes}
                            </Typography>
                        </>
                    )}
                </Paper>

                <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 2 }}>
                        Items
                    </Typography>
                    <Stack spacing={2}>
                        {order.items.map((item) => (
                            <Stack key={item.id} direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                <Box sx={{ minWidth: 0 }}>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        {item.product?.name}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Qty {item.quantity} · ${Number(item.unit_price).toFixed(2)} each
                                    </Typography>
                                </Box>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    ${Number(item.total_price).toFixed(2)}
                                </Typography>
                            </Stack>
                        ))}
                    </Stack>
                    <Divider sx={{ my: 2 }} />
                    <Stack spacing={0.75}>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Subtotal</Typography>
                            <Typography variant="body2">${Number(order.total_amount).toFixed(2)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Tax</Typography>
                            <Typography variant="body2">${Number(order.tax_amount ?? 0).toFixed(2)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2">Shipping</Typography>
                            <Typography variant="body2">${Number(order.shipping_fee).toFixed(2)}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between" sx={{ pt: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                Total
                            </Typography>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                ${Number(order.final_amount).toFixed(2)}
                            </Typography>
                        </Stack>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                        Payment: Manual transfer{proofUrl ? ' (screenshot submitted)' : ''}
                    </Typography>

                    {proofUrl && (
                        <Box sx={{ mt: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                Payment screenshot
                            </Typography>
                            <Box
                                component="button"
                                type="button"
                                onClick={() => setProofLightbox(true)}
                                aria-label="View payment screenshot"
                                sx={{
                                    display: 'block',
                                    p: 0,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 1.5,
                                    overflow: 'hidden',
                                    cursor: 'pointer',
                                    bgcolor: 'transparent',
                                    width: { xs: 96, sm: 120 },
                                    '&:hover': { opacity: 0.85 },
                                }}
                            >
                                <Box
                                    component="img"
                                    src={proofUrl}
                                    alt="Payment screenshot"
                                    sx={{
                                        width: '100%',
                                        height: { xs: 72, sm: 80 },
                                        objectFit: 'cover',
                                        display: 'block',
                                    }}
                                />
                            </Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Tap to view full size
                            </Typography>
                        </Box>
                    )}
                </Paper>
            </Container>

            <Dialog open={proofLightbox} onClose={() => setProofLightbox(false)} maxWidth="lg" fullWidth>
                <DialogContent sx={{ p: 1, bgcolor: 'rgba(0,0,0,0.92)', position: 'relative' }}>
                    <IconButton
                        onClick={() => setProofLightbox(false)}
                        aria-label="Close"
                        sx={{ position: 'absolute', right: 8, top: 8, color: 'white', zIndex: 1 }}
                    >
                        <Close />
                    </IconButton>
                    {proofUrl ? (
                        <Box
                            component="img"
                            src={proofUrl}
                            alt="Payment screenshot"
                            sx={{ width: '100%', height: 'auto', display: 'block', borderRadius: 1 }}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
