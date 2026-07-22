import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardMedia, CardContent, Typography, Box, IconButton, Stack, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button, Checkbox } from '@mui/material';
import { FavoriteBorder, Favorite, AddShoppingCart, Add, Remove, StarRounded } from '@mui/icons-material';
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

const getSkuImageUrl = (sku, fallbackUrl, appUrl) => {
    const path = sku?.image?.image_url || sku?.image?.image_path;
    if (!path) return fallbackUrl;
    return storageUrl(path, appUrl);
};

const ProductCard = ({ product }) => {
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
            : 'https://via.placeholder.com/300?text=No+Image';
    }, [product.primary_image, app_url]);

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
                href={routeWithBase(`/products/${product.slug}`, app_base)}
                sx={{ position: 'relative', pt: '133.33%', display: 'block' }}
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
                        top: 8,
                        right: 8,
                        bgcolor: 'rgba(255,253,248,0.94)',
                        padding: '5px',
                        zIndex: 1,
                        border: '1px solid rgba(36,27,24,0.08)',
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleWishlist}
                    aria-label={t(inWishlist ? 'Remove from wishlist' : 'Add to wishlist')}
                >
                    {inWishlist ? (
                        <Favorite sx={{ fontSize: '1rem' }} color="primary" />
                    ) : (
                        <FavoriteBorder sx={{ fontSize: '1rem' }} color="primary" />
                    )}
                </IconButton>
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 44,
                        right: 8,
                        bgcolor: 'rgba(255,253,248,0.94)',
                        padding: '5px',
                        zIndex: 1,
                        border: '1px solid rgba(36,27,24,0.08)',
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleAddToCart}
                    disabled={!defaultSku || !canAddCart}
                    aria-label={t('Add to cart')}
                >
                    <AddShoppingCart sx={{ fontSize: '1rem' }} color="primary" />
                </IconButton>
            </Box>
            <CardContent sx={{ flexGrow: 1, p: '10px !important' }}>
                <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 900, color: musicColors.rosin, textTransform: 'uppercase', letterSpacing: 0 }}>
                    {product.category?.name || t('Uncategorized')}
                </Typography>
                <Typography
                    variant="body2"
                    component={Link}
                    href={routeWithBase(`/products/${product.slug}`, app_base)}
                    sx={{
                        fontWeight: 850,
                        mt: 0.25,
                        mb: 0.5,
                        lineHeight: 1.2,
                        height: '2.4em',
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
                    <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.primary', fontWeight: 800 }}>
                        {ratingValue > 0 ? ratingValue.toFixed(1).replace(/\.0$/, '') : '0'}
                    </Typography>
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
                                sx={{ color: 'error.main', fontWeight: 800, display: 'block', lineHeight: 1.1 }}
                            >
                                {t('Flash Sale')}
                            </Typography>
                        )}
                        <Stack direction="row" spacing={0.75} alignItems="baseline" useFlexGap flexWrap="wrap">
                    <Typography variant="subtitle2" sx={{ fontWeight: 950, lineHeight: 1, color: musicColors.rosin }}>
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
                <DialogTitle sx={{ pb: 1, fontWeight: 800 }}>{t('Select option')}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1}>
                        {purchasableSkus.map((sku) => {
                            const isSelected = selectedSkuIds.includes(sku.id);
                            const skuImageUrl = getSkuImageUrl(sku, imageUrl, app_url);
                            const quantity = getSkuQuantity(sku);
                            return (
                                <Box
                                    key={sku.id}
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '34px minmax(0, 1fr) auto', sm: 'auto minmax(0, 1fr) auto' },
                                        gap: { xs: 0.75, sm: 1 },
                                        alignItems: 'center',
                                        p: { xs: 0.75, sm: 1 },
                                        border: '1px solid',
                                        borderColor: isSelected ? 'primary.main' : 'divider',
                                        borderRadius: 1,
                                        bgcolor: isSelected ? 'primary.main' : 'background.paper',
                                        color: isSelected ? 'primary.contrastText' : 'text.primary',
                                        transition: 'border-color 0.15s, background 0.15s',
                                    }}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        onChange={() => toggleSkuSelection(sku)}
                                        inputProps={{ 'aria-label': `${t('Select option')} ${formatSkuLabel(sku)}` }}
                                        sx={{
                                            color: isSelected ? 'primary.contrastText' : 'text.secondary',
                                            '&.Mui-checked': { color: isSelected ? 'primary.contrastText' : 'primary.main' },
                                        }}
                                    />
                                    <Box
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => toggleSkuSelection(sku)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                toggleSkuSelection(sku);
                                            }
                                        }}
                                        sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0, sm: 1.25 }, minWidth: 0, cursor: 'pointer' }}
                                    >
                                        <Box
                                            component="img"
                                            src={skuImageUrl}
                                            alt={formatSkuLabel(sku)}
                                            sx={{ display: { xs: 'none', sm: 'block' }, width: 44, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                                        />
                                        <Box sx={{ minWidth: 0, textAlign: 'left' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.18, fontSize: { xs: '0.86rem', sm: '0.875rem' } }} noWrap title={formatSkuLabel(sku)}>
                                                {formatSkuLabel(sku)}
                                            </Typography>
                                            <Stack direction="row" spacing={0.75} alignItems="baseline" useFlexGap flexWrap="wrap" sx={{ mt: 0.25 }}>
                                                <Typography variant="caption" sx={{ color: isSelected ? 'rgba(255,255,255,0.82)' : 'text.secondary', lineHeight: 1.1 }}>
                                                    {t('In stock')} ({sku.available_qty})
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
                                                    {formatMoney(skuPrice(sku))}
                                                </Typography>
                                                {hasFlashSale(sku) && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ textDecoration: 'line-through', color: isSelected ? 'rgba(255,255,255,0.72)' : 'text.secondary' }}
                                                    >
                                                        {formatMoney(skuOriginalPrice(sku))}
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </Box>
                                    </Box>
                                    <Box
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: { xs: '28px 30px 28px', sm: '32px 38px 32px' },
                                            alignItems: 'center',
                                            justifySelf: 'end',
                                            border: '1px solid',
                                            borderColor: isSelected ? 'rgba(255,255,255,0.5)' : 'divider',
                                            borderRadius: 1,
                                            bgcolor: 'background.paper',
                                            color: 'text.primary',
                                            overflow: 'hidden',
                                        }}
                                    >
                                        <IconButton
                                            size="small"
                                            aria-label={`${t('Decrease quantity for')} ${formatSkuLabel(sku)}`}
                                            disabled={quantity <= 1}
                                            onClick={() => changeSkuQuantity(sku, quantity - 1)}
                                            sx={{ width: { xs: 28, sm: 32 }, height: { xs: 30, sm: 34 }, borderRadius: 0 }}
                                        >
                                            <Remove fontSize="small" />
                                        </IconButton>
                                        <Typography
                                            aria-label={`${t('Qty')} ${formatSkuLabel(sku)}`}
                                            sx={{
                                                height: { xs: 30, sm: 34 },
                                                lineHeight: { xs: '30px', sm: '34px' },
                                                textAlign: 'center',
                                                fontWeight: 900,
                                                borderLeft: '1px solid',
                                                borderRight: '1px solid',
                                                borderColor: 'divider',
                                                fontSize: { xs: '0.85rem', sm: '0.9rem' },
                                            }}
                                        >
                                            {quantity}
                                        </Typography>
                                        <IconButton
                                            size="small"
                                            aria-label={`${t('Increase quantity for')} ${formatSkuLabel(sku)}`}
                                            disabled={quantity >= skuQtyLimit(sku)}
                                            onClick={() => changeSkuQuantity(sku, quantity + 1)}
                                            sx={{ width: { xs: 28, sm: 32 }, height: { xs: 30, sm: 34 }, borderRadius: 0 }}
                                        >
                                            <Add fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>
                            );
                        })}
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
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
