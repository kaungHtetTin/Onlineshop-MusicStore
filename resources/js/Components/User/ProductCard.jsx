import React, { useMemo, useState, useCallback } from 'react';
import { Card, CardMedia, CardContent, Typography, Box, IconButton, Rating, Stack, Snackbar, Alert, Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { FavoriteBorder, Favorite, AddShoppingCart, Add, Remove } from '@mui/icons-material';
import { usePage, Link } from '@inertiajs/react';
import { storageUrl, routeWithBase } from '@/Utils/url';
import { useCartStore } from '@/stores/cartStore';
import { useWishlistStore } from '@/stores/wishlistStore';
import { pickDefaultSkuForProduct } from '@/Utils/pickDefaultSku';
import { formatMoney, hasFlashSale, skuOriginalPrice, skuPrice } from '@/Utils/pricing';

const formatSkuLabel = (sku) => {
    const attrs = sku?.attributes || {};
    const entries = Object.entries(attrs);
    if (entries.length > 0) {
        return entries.map(([k, v]) => `${k}: ${v}`).join(' / ');
    }
    return sku?.sku_code || 'Default';
};

const getSkuImageUrl = (sku, fallbackUrl, appUrl) => {
    const path = sku?.image?.image_path;
    if (!path) return fallbackUrl;
    return storageUrl(path, appUrl);
};

const ProductCard = ({ product }) => {
    const ORDER_QTY_MAX = 999;
    const { app_url, app_base } = usePage().props;
    const addToCart = useCartStore((s) => s.addItem);
    const wishToggle = useWishlistStore((s) => s.toggle);
    const inWishlist = useWishlistStore((s) => s.items.some((i) => i.productId === product.id));

    const [toast, setToast] = useState({ open: false, message: '', severity: 'success' });
    const [variantDialogOpen, setVariantDialogOpen] = useState(false);
    const [selectedSkuId, setSelectedSkuId] = useState(null);
    const [quantity, setQuantity] = useState(1);

    const minPrice = useMemo(() => {
        if (!product.skus || product.skus.length === 0) return 0;
        return Math.min(...product.skus.map((s) => skuPrice(s)));
    }, [product.skus]);

    const imageUrl = useMemo(() => {
        return product.primary_image
            ? storageUrl(product.primary_image.image_path, app_url)
            : 'https://via.placeholder.com/300?text=No+Image';
    }, [product.primary_image, app_url]);

    const defaultSku = useMemo(() => pickDefaultSkuForProduct(product), [product]);
    const canAddCart = Boolean(defaultSku);
    const selectedSku = useMemo(
        () => (product.skus || []).find((s) => s.id === selectedSkuId) || defaultSku || null,
        [product.skus, selectedSkuId, defaultSku]
    );

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
            showToast(added ? 'Saved to wishlist' : 'Removed from wishlist', 'success');
        },
        [wishToggle, wishlistPayload, showToast]
    );

    const handleAddToCart = useCallback(
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!defaultSku || !canAddCart) {
                showToast('No purchasable SKU found for this product.', 'warning');
                return;
            }
            setSelectedSkuId(defaultSku.id);
            setQuantity(1);
            setVariantDialogOpen(true);
        },
        [defaultSku, canAddCart, showToast]
    );

    const handleConfirmAddToCart = useCallback(() => {
            if (!selectedSku) {
                showToast('Please select an option first.', 'warning');
                return;
            }
            const isPreorder = Number(selectedSku.available_qty ?? 0) <= 0;
            const skuLabel = formatSkuLabel(selectedSku);
            const imagePath = selectedSku?.image?.image_path || product.primary_image?.image_path || null;

            addToCart({
                skuId: selectedSku.id,
                productId: product.id,
                name: product.name,
                skuLabel,
                skuCode: selectedSku.sku_code || null,
                variantAttributes: selectedSku.attributes || {},
                price: skuPrice(selectedSku),
                originalPrice: skuOriginalPrice(selectedSku),
                flashSale: selectedSku.flash_sale || null,
                imagePath,
                maxQty: Number(selectedSku.available_qty ?? 0),
                isPreorder,
                qty: quantity,
            });
            setVariantDialogOpen(false);
            showToast(isPreorder ? 'Added as preorder' : 'Added to cart', 'success');
        },
        [selectedSku, product, addToCart, showToast, quantity]
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
                borderColor: 'divider',
                transition: 'border-color 0.2s',
                '&:hover': {
                    borderColor: 'primary.main',
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
                    }}
                />
                <IconButton
                    sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        bgcolor: 'rgba(255,255,255,0.9)',
                        padding: '4px',
                        zIndex: 1,
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleWishlist}
                    aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
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
                        top: 36,
                        right: 4,
                        bgcolor: 'rgba(255,255,255,0.9)',
                        padding: '4px',
                        zIndex: 1,
                        '&:hover': { bgcolor: 'white' },
                    }}
                    size="small"
                    onClick={handleAddToCart}
                    disabled={!defaultSku || !canAddCart}
                    aria-label="Add to cart"
                >
                    <AddShoppingCart sx={{ fontSize: '1rem' }} color="primary" />
                </IconButton>
            </Box>
            <CardContent sx={{ flexGrow: 1, p: '8px !important' }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
                    {product.category?.name || 'Uncategorized'}
                </Typography>
                <Typography
                    variant="body2"
                    component={Link}
                    href={routeWithBase(`/products/${product.slug}`, app_base)}
                    sx={{
                        fontWeight: 600,
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
                        '&:hover': { color: 'primary.main' },
                    }}
                >
                    {product.name}
                </Typography>

                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
                    <Rating value={parseFloat(product.rating || 0)} readOnly size="small" precision={0.5} sx={{ fontSize: '0.75rem' }} />
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                        ({product.review_count || 0})
                    </Typography>
                </Stack>

                <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
                    <Box>
                        {product.skus?.some(hasFlashSale) && (
                            <Typography
                                variant="caption"
                                sx={{ color: 'error.main', fontWeight: 800, display: 'block', lineHeight: 1.1 }}
                            >
                                Flash Sale
                            </Typography>
                        )}
                        <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 700, lineHeight: 1 }}>
                            {formatMoney(minPrice)}
                        </Typography>
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
                <DialogTitle sx={{ pb: 1, fontWeight: 800 }}>Select option</DialogTitle>
                <DialogContent>
                    <Stack spacing={1}>
                        {(product.skus || []).map((sku) => {
                            const isSelected = selectedSku?.id === sku.id;
                            const isPreorder = Number(sku.available_qty ?? 0) <= 0;
                            const skuImageUrl = getSkuImageUrl(sku, imageUrl, app_url);
                            return (
                                <Button
                                    key={sku.id}
                                    variant={isSelected ? 'contained' : 'outlined'}
                                    onClick={() => {
                                        setSelectedSkuId(sku.id);
                                        setQuantity(1);
                                    }}
                                    sx={{ justifyContent: 'space-between', textTransform: 'none', py: 1.2, px: 1.5 }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                                        <Box
                                            component="img"
                                            src={skuImageUrl}
                                            alt={formatSkuLabel(sku)}
                                            sx={{ width: 44, aspectRatio: '3 / 4', objectFit: 'cover', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                                        />
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                {formatSkuLabel(sku)}
                                            </Typography>
                                            <Typography variant="caption" color={isPreorder ? 'warning.main' : 'text.secondary'}>
                                                {isPreorder ? 'Out of stock - Preorder' : `In stock (${sku.available_qty})`}
                                            </Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                        <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                            {formatMoney(skuPrice(sku))}
                                        </Typography>
                                        {hasFlashSale(sku) && (
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                sx={{ textDecoration: 'line-through', display: 'block' }}
                                            >
                                                {formatMoney(skuOriginalPrice(sku))}
                                            </Typography>
                                        )}
                                    </Box>
                                </Button>
                            );
                        })}
                    </Stack>

                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 56 }}>
                            Qty
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                            <IconButton size="small" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                                <Remove fontSize="small" />
                            </IconButton>
                            <Typography sx={{ px: 1.5, fontWeight: 700 }}>{quantity}</Typography>
                            <IconButton
                                size="small"
                                onClick={() =>
                                    setQuantity((q) =>
                                        Math.min(ORDER_QTY_MAX, q + 1)
                                    )
                                }
                                disabled={quantity >= ORDER_QTY_MAX}
                            >
                                <Add fontSize="small" />
                            </IconButton>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setVariantDialogOpen(false)} color="inherit">
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleConfirmAddToCart} disabled={!selectedSku}>
                        {selectedSku && Number(selectedSku.available_qty ?? 0) <= 0 ? 'Add Preorder' : 'Add to cart'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Card>
    );
};

export default ProductCard;
