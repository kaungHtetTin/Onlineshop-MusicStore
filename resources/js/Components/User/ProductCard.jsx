import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardMedia, CardContent, Typography, Box, IconButton, Stack, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { FavoriteBorder, Favorite, AddShoppingCart, Add, Remove, StarRounded, CheckCircleRounded, RadioButtonUncheckedRounded } from '@mui/icons-material';
import { usePage, Link } from '@/spa/router';
import { storageUrl, routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { pickDefaultSkuForProduct } from '@/Utils/pickDefaultSku';
import { formatMoney, hasFlashSale, skuOriginalPrice, skuPrice } from '@/Utils/pricing';
import { useTheme } from '@mui/material/styles';
import { getMusicStoreColors } from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

const formatSkuLabel = (sku) => {
    const attrs = sku?.attributes || {};
    const entries = Object.entries(attrs);
    if (entries.length > 0) {
        return entries.map(([k, v]) => `${k}: ${v}`).join(' / ');
    }
    return sku?.sku_code || 'Default';
};

const ProductCard = ({ product, returnTo = null }) => {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const ORDER_QTY_MAX = 999;
    const { app_url, app_base } = usePage().props;
    const t = usePhraseTranslation();
    const addToCart = useCartStore((s) => s.addItem);
    const wishToggle = useWishlistStore((s) => s.toggle);
    const inWishlist = useWishlistStore((s) => s.items.some((i) => i.productId === product.id));

    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
    const [variantDialogOpen, setVariantDialogOpen] = useState(false);
    const [selectedSkuIds, setSelectedSkuIds] = useState([]);
    const [skuQuantities, setSkuQuantities] = useState({});
    const purchasableSkus = useMemo(
        () => (product.skus || []).filter((s) => s.is_active !== false && Number(s.available_qty ?? 0) > 0),
        [product.skus]
    );

    const displaySku = useMemo(() => {
        if (purchasableSkus.length === 0) return null;
        return purchasableSkus.reduce((best, sku) => (skuPrice(sku) < skuPrice(best) ? sku : best), purchasableSkus[0]);
    }, [purchasableSkus]);
    const minPrice = displaySku ? skuPrice(displaySku) : 0;
    const showFlashPrice = displaySku && hasFlashSale(displaySku) && skuOriginalPrice(displaySku) > minPrice;
    const ratingValue = Number(product.rating || 0);
    const reviewCount = Number(product.review_count || 0);
    const reviewText = reviewCount > 0
        ? `${reviewCount.toLocaleString()} ${t(reviewCount === 1 ? 'review' : 'reviews')}`
        : t('No reviews yet');

    const imageUrl = useMemo(() => {
        return product.primary_image
            ? storageUrl(product.primary_image.image_url || product.primary_image.image_path, app_url)
            : routeWithBase('/images/product-placeholder.svg', app_base);
    }, [product.primary_image, app_url, app_base]);

    const detailHref = useMemo(() => {
        const href = routeWithBase(`/products/${product.slug}`, app_base);
        return returnTo ? `${href}?return_to=${encodeURIComponent(returnTo)}` : href;
    }, [app_base, product.slug, returnTo]);

    const defaultSku = useMemo(() => pickDefaultSkuForProduct(product), [product]);
    const canAddCart = Boolean(defaultSku);
    const wishlistPayload = useMemo(
        () => ({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            imagePath: product.primary_image?.image_path ?? null,
            skus: product.skus || [],
            categoryName: product.category?.name ?? null,
            rating: product.rating ?? 0,
            review_count: product.review_count ?? 0,
        }),
        [product]
    );

    const showToast = useCallback((message, severity = 'success') => {
        setToast({ open: true, message, severity });
    }, []);

    const handleWishlist = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            const added = wishToggle(wishlistPayload);
            showToast(t(added ? 'Saved to wishlist' : 'Removed from wishlist'), 'success');
        },
        [wishToggle, wishlistPayload, showToast, t]
    );

    const handleAddToCart = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!defaultSku || !canAddCart) {
                showToast(t('No purchasable SKU found for this product.'), 'warning');
                return;
            }
            setSelectedSkuIds([defaultSku.id]);
            setSkuQuantities({ [defaultSku.id]: 1 });
            setVariantDialogOpen(true);
        },
        [defaultSku, canAddCart, showToast, t]
    );

    const skuQtyLimit = useCallback((sku) => Math.min(ORDER_QTY_MAX, Math.max(1, Number(sku?.available_qty ?? 1))), []);

    const clampSkuQuantity = useCallback((sku, value) => {
        const numericValue = Number(value);
        const nextValue = Number.isFinite(numericValue) ? numericValue : 1;
        return Math.max(1, Math.min(skuQtyLimit(sku), Math.floor(nextValue)));
    }, [skuQtyLimit]);

    const getSkuQuantity = useCallback((sku) => clampSkuQuantity(sku, skuQuantities[sku.id] ?? 1), [clampSkuQuantity, skuQuantities]);

    const toggleSkuSelection = useCallback((sku) => {
        setSelectedSkuIds((current) => (
            current.includes(sku.id)
                ? current.filter((id) => id !== sku.id)
                : [...current, sku.id]
        ));
        setSkuQuantities((current) => ({ ...current, [sku.id]: clampSkuQuantity(sku, current[sku.id] ?? 1) }));
    }, [clampSkuQuantity]);

    const changeSkuQuantity = useCallback((sku, value) => {
        setSkuQuantities((current) => ({ ...current, [sku.id]: clampSkuQuantity(sku, value) }));
        setSelectedSkuIds((current) => (current.includes(sku.id) ? current : [...current, sku.id]));
    }, [clampSkuQuantity]);

    const selectedCartSkus = useMemo(
        () => purchasableSkus.filter((sku) => selectedSkuIds.includes(sku.id)),
        [purchasableSkus, selectedSkuIds]
    );

    const handleConfirmAddToCart = useCallback(() => {
            if (selectedCartSkus.length === 0) {
                showToast(t('Please select at least one option.'), 'warning');
                return;
            }

            selectedCartSkus.forEach((sku) => {
                const skuLabel = formatSkuLabel(sku);
                const imagePath = sku?.image?.image_path || product.primary_image?.image_path || null;
                const addQty = getSkuQuantity(sku);

                addToCart({
                    skuId: sku.id,
                    productId: product.id,
                    name: product.name,
                    skuLabel,
                    skuCode: sku.sku_code || null,
                    variantAttributes: sku.attributes || {},
                    price: skuPrice(sku),
                    originalPrice: skuOriginalPrice(sku),
                    flashSale: sku.flash_sale || null,
                    imagePath,
                    maxQty: Number(sku.available_qty ?? 0),
                    isPreorder: false,
                    qty: addQty,
                });
            });

            setVariantDialogOpen(false);
            showToast(t('Added to cart'), 'success');
        },
        [selectedCartSkus, product, addToCart, showToast, getSkuQuantity, t]
    );

    return (
        <Card
            elevation={0}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                border: '1px solid',
                borderColor: 'rgba(36,27,24,0.09)',
                borderRadius: 2,
                bgcolor: musicColors.sheet,
                overflow: 'hidden',
                boxShadow: '0 14px 34px rgba(36,27,24,0.06)',
                transition: 'transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                    borderColor: musicColors.brass,
                    transform: 'translateY(-3px)',
                    boxShadow: '0 20px 44px rgba(36,27,24,0.12)',
                },
            }}
        >
            <Box
                component={Link}
                href={detailHref}
                sx={{ position: 'relative', pt: '125%', display: 'block' }}
            >
                <CardMedia
                    component="img"
                    image={imageUrl}
                    alt={product.name}
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        bgcolor: '#eee6d8',
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 'auto 0 0 0',
                        height: '38%',
                        background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(23,19,18,0.38) 100%)',
                        pointerEvents: 'none',
                    }}
                />
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        width: 44,
                        height: 44,
                        bgcolor: 'rgba(255,253,248,0.94)',
                        padding: 0,
                        zIndex: 1,
                        border: '1px solid rgba(36,27,24,0.08)',
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleWishlist}
                    aria-label={t(inWishlist ? 'Remove from wishlist' : 'Add to wishlist')}
                >
                    {inWishlist ? (
                        <Favorite sx={{ fontSize: '1.15rem' }} color="primary" />
                    ) : (
                        <FavoriteBorder sx={{ fontSize: '1.15rem' }} color="primary" />
                    )}
                </IconButton>
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 62,
                        right: 10,
                        width: 44,
                        height: 44,
                        bgcolor: 'rgba(255,253,248,0.94)',
                        padding: 0,
                        zIndex: 1,
                        border: '1px solid rgba(36,27,24,0.08)',
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleAddToCart}
                    disabled={!defaultSku || !canAddCart}
                    aria-label={t('Add to cart')}
                >
                    <AddShoppingCart sx={{ fontSize: '1.15rem' }} color="primary" />
                </IconButton>
            </Box>
            <CardContent sx={{ flexGrow: 1, p: { xs: '12px !important', sm: '14px !important' } }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 700, color: musicColors.rosin, textTransform: 'uppercase', letterSpacing: '0.035em' }}>
                    {product.category?.name || t('Uncategorized')}
                </Typography>
                <Typography
                    variant="body2"
                    component={Link}
                    href={detailHref}
                    sx={{
                        fontWeight: 600,
                        fontSize: '0.84rem',
                        mt: '4px',
                        mb: '8px',
                        lineHeight: 1.35,
                        height: '2.7em',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        textDecoration: 'none',
                        color: 'inherit',
                        '&:hover': { color: musicColors.rosin },
                    }}
                >
                    {product.name}
                </Typography>

                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1, minHeight: 18 }}>
                    <StarRounded sx={{ fontSize: '0.95rem', color: reviewCount > 0 ? '#f5a623' : 'text.disabled' }} />
                    {reviewCount > 0 && (
                        <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.primary', fontWeight: 600 }}>
                            {ratingValue.toFixed(1).replace(/\.0$/, '')}
                        </Typography>
                    )}
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: '0.7rem',
                            color: 'text.secondary',
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {reviewCount > 0 ? `- ${reviewText}` : reviewText}
                    </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                    <Box>
                        {showFlashPrice && (
                            <Typography
                                variant="caption"
                                sx={{ color: 'error.main', fontWeight: 700, display: 'block', lineHeight: 1.1 }}
                            >
                                {t('Flash Sale')}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={0.75} alignItems="baseline" useFlexGap flexWrap="wrap">
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.15, color: musicColors.rosin }}>
                        {formatMoney(minPrice)}
                    </Typography>
                            {showFlashPrice && (
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ textDecoration: 'line-through', fontWeight: 600, lineHeight: 1 }}
                                >
                                    {formatMoney(skuOriginalPrice(displaySku))}
                                </Typography>
                            )}
                        </Stack>
                    </Box>
                </Stack>
            </CardContent>

            <Snackbar
                open={toast.open}
                autoHideDuration={2200}
                onClose={() => setToast((t) => ({ ...t, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 72, sm: 24 } }}
            >
                <Alert
                    severity={toast.severity}
                    variant="filled"
                    onClose={() => setToast((t) => ({ ...t, open: false }))}
                    sx={{ width: '100%' }}
                >
                    {toast.message}
                </Alert>
            </Snackbar>

            <Dialog open={variantDialogOpen} onClose={() => setVariantDialogOpen(false)} fullWidth maxWidth="xs">
                <DialogTitle>{t('Select option')}</DialogTitle>
                <DialogContent sx={{ pt: '8px !important', pb: '8px' }}>
                    <Stack spacing="8px">
                        {purchasableSkus.map((sku) => {
                            const isSelected = selectedSkuIds.includes(sku.id);
                            const quantity = getSkuQuantity(sku);
                            return (
                                <Box
                                    key={sku.id}
                                    sx={{
                                        p: '10px 12px',
                                        border: '1px solid',
                                        borderColor: isSelected ? 'primary.main' : 'divider',
                                        borderRadius: 2,
                                        bgcolor: isSelected ? 'primary.light' : 'background.paper',
                                        color: 'text.primary',
                                        transition: 'border-color 0.15s, background 0.15s',
                                    }}
                                >
                                    <Box
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isSelected}
                                        aria-label={`${t('Select option')} ${formatSkuLabel(sku)}`}
                                        onClick={() => toggleSkuSelection(sku)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                toggleSkuSelection(sku);
                                            }
                                        }}
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: '22px minmax(0, 1fr) auto',
                                            gap: '10px',
                                            alignItems: 'center',
                                            minHeight: 44,
                                            minWidth: 0,
                                            cursor: 'pointer',
                                            outline: 'none',
                                            '&:focus-visible': { boxShadow: '0 0 0 3px', boxShadowColor: 'primary.light', borderRadius: 1 },
                                        }}
                                    >
                                        {isSelected
                                            ? <CheckCircleRounded color="primary" sx={{ fontSize: 21 }} />
                                            : <RadioButtonUncheckedRounded color="disabled" sx={{ fontSize: 21 }} />}
                                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.3 }} title={formatSkuLabel(sku)}>
                                                {formatSkuLabel(sku)}
                                            </Typography>
                                        </Box>
                                        <Typography variant="body2" color="primary" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {formatMoney(skuPrice(sku))}
                                        </Typography>
                                    </Box>
                                    {isSelected && (
                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', pt: '8px', mt: '6px', borderTop: '1px solid', borderColor: 'divider' }}>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                                                {t('Quantity')}
                                            </Typography>
                                            <Box sx={{ display: 'grid', gridTemplateColumns: '44px 34px 44px', alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, bgcolor: 'background.paper', overflow: 'hidden' }}>
                                                <IconButton
                                                    size="small"
                                                    aria-label={`${t('Decrease quantity for')} ${formatSkuLabel(sku)}`}
                                                    disabled={quantity <= 1}
                                                    onClick={() => changeSkuQuantity(sku, quantity - 1)}
                                                    sx={{ width: 44, height: 44, borderRadius: 0 }}
                                                >
                                                    <Remove fontSize="small" />
                                                </IconButton>
                                                <Typography aria-label={`${t('Qty')} ${formatSkuLabel(sku)}`} sx={{ height: 44, lineHeight: '44px', textAlign: 'center', fontWeight: 700, borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider', fontSize: '0.875rem' }}>
                                                    {quantity}
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    aria-label={`${t('Increase quantity for')} ${formatSkuLabel(sku)}`}
                                                    disabled={quantity >= skuQtyLimit(sku)}
                                                    onClick={() => changeSkuQuantity(sku, quantity + 1)}
                                                    sx={{ width: 44, height: 44, borderRadius: 0 }}
                                                >
                                                    <Add fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        </Box>
                                    )}
                                </Box>
                            );
                        })}
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setVariantDialogOpen(false)} color="inherit">
                        {t('Cancel')}
                    </Button>
                    <Button variant="contained" onClick={handleConfirmAddToCart} disabled={selectedCartSkus.length === 0}>
                        {t('Add to cart')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default ProductCard;
