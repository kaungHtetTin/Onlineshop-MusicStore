import React, { useMemo, useRef, useState } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import {
    Alert,
    Box,
    Button,
    Container,
    Divider,
    FormHelperText,
    Paper,
    Stack,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from '@mui/material';
import { AccountBalanceWallet, CloudUpload, Image as ImageIcon } from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';

const steps = ['Shipping', 'Payment proof', 'Review'];

export default function CheckoutIndex({ shop, loyalty, paymentMethods = [] }) {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const { app_base, auth } = usePage().props;
    const items = useCartStore((s) => s.items);
    const clearCart = useCartStore((s) => s.clear);
    const [activeStep, setActiveStep] = useState(0);
    const [proofPreview, setProofPreview] = useState(null);
    const [quote, setQuote] = useState(null);
    const [quoteError, setQuoteError] = useState(null);
    const fileInputRef = useRef(null);

    const { data, setData, post, processing, errors, reset, transform } = useForm({
        lines: [],
        receiver_name: auth?.user?.name ?? '',
        receiver_phone: auth?.user?.phone ?? '',
        shipping_address: auth?.user?.default_address ?? '',
        order_notes: '',
        payment_method_id: paymentMethods[0]?.id || '',
        payment_proof: null,
        coupon_code: '',
        redeem_points: 0,
    });

    const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.qty, 0), [items]);
    const tax = useMemo(() => Math.round(subtotal * (shop?.tax_rate ?? 0) * 100) / 100, [subtotal, shop]);
    const shipping = useMemo(() => {
        const min = shop?.free_shipping_minimum ?? 0;
        if (subtotal >= min) return 0;
        return shop?.shipping_flat ?? 0;
    }, [subtotal, shop]);
    const pointValue = useMemo(
        () => Math.round((Number(data.redeem_points || 0) * (loyalty?.redeemCurrencyPerPoint ?? 0.01)) * 100) / 100,
        [data.redeem_points, loyalty],
    );
    const total = quote?.final ?? Math.round((subtotal + tax + shipping - pointValue) * 100) / 100;
    const selectedPaymentMethod = useMemo(
        () => paymentMethods.find((method) => String(method.id) === String(data.payment_method_id)) || null,
        [paymentMethods, data.payment_method_id],
    );

    React.useEffect(() => {
        if (items.length === 0) {
            window.location.assign(routeWithBase('/cart', app_base));
        }
    }, [items.length, app_base]);

    React.useEffect(() => {
        if (!data.payment_method_id && paymentMethods.length > 0) {
            setData('payment_method_id', paymentMethods[0].id);
        }
    }, [paymentMethods, data.payment_method_id]);

    React.useEffect(() => {
        if (items.length === 0) return undefined;

        const timer = window.setTimeout(() => {
            axios
                .post(routeWithBase('/checkout/quote', app_base), {
                    lines: items.map((i) => ({ sku_id: i.skuId, quantity: i.qty })),
                    coupon_code: data.coupon_code || null,
                    redeem_points: Number(data.redeem_points || 0),
                })
                .then(({ data: quoted }) => {
                    setQuote(quoted);
                    setQuoteError(null);
                })
                .catch((error) => {
                    setQuote(null);
                    const responseErrors = error.response?.data?.errors;
                    setQuoteError(
                        responseErrors?.coupon_code?.[0] ||
                            responseErrors?.redeem_points?.[0] ||
                            responseErrors?.lines?.[0] ||
                            'Could not calculate this discount.',
                    );
                });
        }, 300);

        return () => window.clearTimeout(timer);
    }, [items, data.coupon_code, data.redeem_points, app_base]);

    const handleProofChange = (e) => {
        const file = e.target.files?.[0] ?? null;
        setData('payment_proof', file);
        if (proofPreview) URL.revokeObjectURL(proofPreview);
        setProofPreview(file ? URL.createObjectURL(file) : null);
    };

    const canNext = () => {
        if (activeStep === 0) {
            return data.receiver_name.trim() && data.receiver_phone.trim() && data.shipping_address.trim();
        }
        if (activeStep === 1) {
            return Boolean(data.payment_method_id) && Boolean(data.payment_proof);
        }
        return true;
    };

    const handlePlaceOrder = () => {
        transform((formData) => ({
            ...formData,
            lines: items.map((i) => ({ sku_id: i.skuId, quantity: i.qty, is_preorder: Boolean(i.isPreorder) })),
        }));
        post(routeWithBase('/checkout', app_base), {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: () => {
                clearCart();
                reset();
                if (proofPreview) URL.revokeObjectURL(proofPreview);
                setProofPreview(null);
            },
        });
    };

    return (
        <Box
            className="user-storefront"
            sx={{
                minHeight: '100dvh',
                display: 'flex',
                flexDirection: 'column',
                ...storefrontBackgroundSx(theme),
            }}
        >
            <UserBrandHead title="Checkout" />
            <Navbar />

            <Container maxWidth="md" sx={{ mt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
                <BackLink href={routeWithBase('/cart', app_base)}>
                    Back to cart
                </BackLink>

                <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>
                    Secure checkout
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 950, mb: 2, color: musicColors.ink }}>
                    Finish your order
                </Typography>

                <Stepper
                    activeStep={activeStep}
                    alternativeLabel
                    sx={{ mb: 3, '& .MuiStepLabel-label': { fontSize: { xs: '0.65rem', sm: '0.85rem' } } }}
                >
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                {Object.keys(errors).length > 0 && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {errors.lines ||
                            errors.receiver_name ||
                            errors.receiver_phone ||
                            errors.shipping_address ||
                            errors.payment_method_id ||
                            errors.payment_proof ||
                            errors.payment_method ||
                            'Please fix the errors and try again.'}
                    </Alert>
                )}

                <Paper elevation={0} sx={{ ...sectionShellSx, p: { xs: 2, sm: 3 } }}>
                    {activeStep === 0 && (
                        <Stack spacing={2}>
                            <TextField
                                label="Full name"
                                value={data.receiver_name}
                                onChange={(e) => setData('receiver_name', e.target.value)}
                                error={!!errors.receiver_name}
                                helperText={errors.receiver_name}
                                fullWidth
                                required
                            />
                            <TextField
                                label="Phone"
                                value={data.receiver_phone}
                                onChange={(e) => setData('receiver_phone', e.target.value)}
                                error={!!errors.receiver_phone}
                                helperText={errors.receiver_phone}
                                fullWidth
                                required
                            />
                            <TextField
                                label="Shipping address"
                                value={data.shipping_address}
                                onChange={(e) => setData('shipping_address', e.target.value)}
                                error={!!errors.shipping_address}
                                helperText={errors.shipping_address}
                                fullWidth
                                required
                                multiline
                                minRows={3}
                            />
                            <TextField
                                label="Order notes (optional)"
                                value={data.order_notes}
                                onChange={(e) => setData('order_notes', e.target.value)}
                                fullWidth
                                multiline
                                minRows={2}
                            />
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                                <TextField
                                    label="Coupon code"
                                    value={data.coupon_code}
                                    onChange={(e) => setData('coupon_code', e.target.value.toUpperCase())}
                                    error={!!errors.coupon_code}
                                    helperText={errors.coupon_code}
                                    fullWidth
                                />
                                <TextField
                                    label={`Redeem points (${loyalty?.points ?? 0} available)`}
                                    type="number"
                                    value={data.redeem_points}
                                    onChange={(e) => setData('redeem_points', Math.max(0, Number(e.target.value || 0)))}
                                    error={!!errors.redeem_points}
                                    helperText={errors.redeem_points || `${loyalty?.tier ?? 'Bronze'} tier`}
                                    inputProps={{
                                        min: 0,
                                        max: loyalty?.points ?? 0,
                                        step: 1,
                                    }}
                                    fullWidth
                                />
                            </Stack>
                            {quoteError && <Alert severity="warning">{quoteError}</Alert>}
                        </Stack>
                    )}

                    {activeStep === 1 && (
                        <Stack spacing={2}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                                Choose payment account
                            </Typography>
                            {paymentMethods.length === 0 ? (
                                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                                    No payment methods are available right now. Please contact support before placing an order.
                                </Alert>
                            ) : (
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25 }}>
                                    {paymentMethods.map((method) => {
                                        const selected = String(data.payment_method_id) === String(method.id);

                                        return (
                                            <Paper
                                                key={method.id}
                                                component="button"
                                                type="button"
                                                elevation={0}
                                                onClick={() => setData('payment_method_id', method.id)}
                                                sx={{
                                                    textAlign: 'left',
                                                    p: 1.5,
                                                    borderRadius: 2,
                                                    border: '1px solid',
                                                    borderColor: selected ? 'primary.main' : 'divider',
                                                    bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'background.paper',
                                                    cursor: 'pointer',
                                                    color: 'inherit',
                                                    '&:hover': { borderColor: 'primary.main' },
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.25} alignItems="center">
                                                    <Box
                                                        sx={{
                                                            width: 42,
                                                            height: 42,
                                                            borderRadius: 1.5,
                                                            border: '1px solid',
                                                            borderColor: 'divider',
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            overflow: 'hidden',
                                                            flexShrink: 0,
                                                            bgcolor: 'white',
                                                        }}
                                                    >
                                                        {method.icon_url ? (
                                                            <Box component="img" src={method.icon_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <AccountBalanceWallet color="primary" fontSize="small" />
                                                        )}
                                                    </Box>
                                                    <Box sx={{ minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 900 }} noWrap>
                                                            {method.banking_service}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary" display="block" noWrap>
                                                            {method.account_name}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ fontWeight: 800 }} display="block" noWrap>
                                                            {method.account_no}
                                                        </Typography>
                                                    </Box>
                                                </Stack>
                                            </Paper>
                                        );
                                    })}
                                </Box>
                            )}
                            {errors.payment_method_id && <FormHelperText error>{errors.payment_method_id}</FormHelperText>}
                            <Alert severity="info" sx={{ borderRadius: 2 }}>
                                Pay the order total using your bank or wallet, then upload a clear screenshot of the successful
                                transfer. The shop team will verify your payment before the order is prepared.
                            </Alert>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                Transaction screenshot (required)
                            </Typography>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                hidden
                                onChange={handleProofChange}
                            />
                            <Button
                                variant="outlined"
                                startIcon={<CloudUpload />}
                                onClick={() => fileInputRef.current?.click()}
                                fullWidth
                                sx={{ py: 1.5, fontWeight: 700 }}
                            >
                                {data.payment_proof ? 'Change screenshot' : 'Upload screenshot'}
                            </Button>
                            {errors.payment_proof && <FormHelperText error>{errors.payment_proof}</FormHelperText>}
                            {proofPreview && (
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 1,
                                        borderRadius: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1.5,
                                    }}
                                >
                                    <Box
                                        component="img"
                                        src={proofPreview}
                                        alt="Payment proof preview"
                                        sx={{
                                            width: 72,
                                            height: 72,
                                            objectFit: 'cover',
                                            borderRadius: 1,
                                            flexShrink: 0,
                                        }}
                                    />
                                    <Stack sx={{ minWidth: 0 }}>
                                        <Stack direction="row" spacing={0.5} alignItems="center">
                                            <ImageIcon fontSize="small" color="primary" />
                                            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                                                {data.payment_proof?.name}
                                            </Typography>
                                        </Stack>
                                        <Typography variant="caption" color="text.secondary">
                                            JPG, PNG or WebP · max 10 MB
                                        </Typography>
                                    </Stack>
                                </Paper>
                            )}
                        </Stack>
                    )}

                    {activeStep === 2 && (
                        <Stack spacing={2}>
                            {items.map((line) => (
                                <Stack key={line.skuId} direction="row" justifyContent="space-between" alignItems="flex-start">
                                    <Box sx={{ minWidth: 0, pr: 1 }}>
                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                            {line.name}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {line.skuLabel} × {line.qty}
                                        </Typography>
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
                                    </Box>
                                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                        ${(line.price * line.qty).toFixed(2)}
                                    </Typography>
                                </Stack>
                            ))}
                            <Divider />
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">Subtotal</Typography>
                                <Typography variant="body2">${Number(quote?.subtotal ?? subtotal).toFixed(2)}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">Tax ({((shop?.tax_rate ?? 0) * 100).toFixed(1)}%)</Typography>
                                <Typography variant="body2">${Number(quote?.tax ?? tax).toFixed(2)}</Typography>
                            </Stack>
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2">Shipping</Typography>
                                <Typography variant="body2">
                                    {Number(quote?.shipping ?? shipping) === 0 ? 'Free' : `$${Number(quote?.shipping ?? shipping).toFixed(2)}`}
                                </Typography>
                            </Stack>
                            {(quote?.coupon_discount > 0 || quote?.points_value > 0) && (
                                <>
                                    {quote?.coupon_discount > 0 && (
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="body2">Coupon {quote.coupon_code}</Typography>
                                            <Typography variant="body2" color="success.main">
                                                -${Number(quote.coupon_discount).toFixed(2)}
                                            </Typography>
                                        </Stack>
                                    )}
                                    {quote?.points_value > 0 && (
                                        <Stack direction="row" justifyContent="space-between">
                                            <Typography variant="body2">Points ({quote.redeemed_points})</Typography>
                                            <Typography variant="body2" color="success.main">
                                                -${Number(quote.points_value).toFixed(2)}
                                            </Typography>
                                        </Stack>
                                    )}
                                </>
                            )}
                            <Divider />
                            {selectedPaymentMethod && (
                                <Stack direction="row" justifyContent="space-between" spacing={2}>
                                    <Typography variant="body2">Payment account</Typography>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                            {selectedPaymentMethod.banking_service}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {selectedPaymentMethod.account_name} - {selectedPaymentMethod.account_no}
                                        </Typography>
                                    </Box>
                                </Stack>
                            )}
                            <Divider />
                            <Stack direction="row" justifyContent="space-between">
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    Total to pay
                                </Typography>
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    ${total.toFixed(2)}
                                </Typography>
                            </Stack>
                            {proofPreview && (
                                <Typography variant="caption" color="success.main" sx={{ fontWeight: 700 }}>
                                    Payment screenshot attached
                                </Typography>
                            )}
                        </Stack>
                    )}

                    <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mt: 3 }}>
                        <Button
                            disabled={activeStep === 0}
                            onClick={() => setActiveStep((s) => s - 1)}
                            variant="outlined"
                            fullWidth
                            sx={{ maxWidth: { sm: 160 } }}
                        >
                            Back
                        </Button>
                        {activeStep < steps.length - 1 ? (
                            <Button
                                variant="contained"
                                disabled={!canNext()}
                                onClick={() => setActiveStep((s) => s + 1)}
                                fullWidth
                                sx={{ maxWidth: { sm: 200 }, fontWeight: 800 }}
                            >
                                Continue
                            </Button>
                        ) : (
                            <Button
                                variant="contained"
                                onClick={handlePlaceOrder}
                                disabled={processing || items.length === 0 || !data.payment_method_id || !data.payment_proof}
                                fullWidth
                                sx={{ maxWidth: { sm: 240 }, fontWeight: 800 }}
                            >
                                {processing ? 'Submitting…' : 'Submit order'}
                            </Button>
                        )}
                    </Stack>
                </Paper>
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
}
