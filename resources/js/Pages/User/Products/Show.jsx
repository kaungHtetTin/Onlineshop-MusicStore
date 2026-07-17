import React, { useState, useMemo, useEffect } from 'react';
import { usePage, Link, useForm, router } from '@/spa/router';
import { 
    Box, Container, Typography, Stack, 
    Button, Chip, Rating, Divider, IconButton,
    ToggleButton, ToggleButtonGroup,
    Snackbar,
    Alert,
    TextField,
    Pagination
} from '@mui/material';
import { 
    Add as AddIcon, 
    Remove as RemoveIcon,
    FavoriteBorder,
    Share,
    ShoppingBag,
    Star,
    StarBorder
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import BackLink from '@/Components/User/BackLink';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import ProductCard from '@/Components/User/ProductCard';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { storageUrl, routeWithBase } from '@/Utils/url';
import { productListGridSx } from '@/Utils/productListGrid';
import { useCartStore } from '@/stores/cartStore';
import { formatMoney, hasFlashSale, skuOriginalPrice, skuPrice } from '@/Utils/pricing';
import {
    eyebrowSxForTheme,
    getMusicStoreColors,
    sectionShellSxForTheme,
    storefrontBackgroundSx,
} from '@/Components/User/musicStoreDesign';
import { usePhraseTranslation } from '@/Utils/i18n';

const productImageUrl = (image, appUrl) => {
    const path = image?.image_url || image?.image_path;
    return path ? storageUrl(path, appUrl) : 'https://via.placeholder.com/600?text=No+Image';
};

const Show = ({ product, relatedProducts, recommendedProducts = [], frequentlyBoughtTogether = [], reviews = { data: [] } }) => {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const sectionShellSx = sectionShellSxForTheme(theme);
    const ORDER_QTY_MAX = 999;
    const { app_url, app_base, auth } = usePage().props;
    const t = usePhraseTranslation();
    const [selectedSku, setSelectedSku] = useState(product.skus[0] || null);
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [cartToast, setCartToast] = useState(false);
    const addItem = useCartStore((s) => s.addItem);
    const selectedSkuQtyLimit = Math.min(ORDER_QTY_MAX, Math.max(1, Number(selectedSku?.available_qty ?? 1)));
    const reviewRows = reviews.data || product.reviews || [];
    const { data, setData, post, processing, errors } = useForm({
        rating: 5,
        comment: '',
    });

    const images = useMemo(() => {
        return product.images.length > 0 ? product.images : [{ image_path: 'https://via.placeholder.com/600?text=No+Image' }];
    }, [product.images]);

    useEffect(() => {
        if (!selectedSku?.image?.image_path || images.length === 0) return;
        const skuImagePath = selectedSku.image.image_path;
        const idx = images.findIndex((img) => img?.image_path === skuImagePath || img?.id === selectedSku?.image?.id);
        if (idx >= 0 && idx !== activeImageIndex) {
            setActiveImageIndex(idx);
        }
    }, [selectedSku, images, activeImageIndex]);

    const handleQuantityChange = (delta) => {
        setQuantity(prev => Math.max(1, Math.min(selectedSkuQtyLimit, prev + delta)));
    };

    const handleAddToCart = () => {
        if (!selectedSku) return;
        const skuLabel = Object.entries(selectedSku.attributes || {}).length
            ? Object.entries(selectedSku.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(' / ')
            : (selectedSku.sku_code || 'Default');
        const img = selectedSku?.image?.image_path || images[activeImageIndex]?.image_path || null;
        addItem({
            skuId: selectedSku.id,
            productId: product.id,
            name: product.name,
            skuLabel,
            skuCode: selectedSku.sku_code || null,
            variantAttributes: selectedSku.attributes || {},
            price: skuPrice(selectedSku),
            originalPrice: skuOriginalPrice(selectedSku),
            flashSale: selectedSku.flash_sale || null,
            imagePath: img,
            maxQty: selectedSku.available_qty,
            isPreorder: false,
            qty: Math.min(quantity, Number(selectedSku.available_qty ?? 1)),
        });
        setCartToast(true);
        setQuantity(1);
    };

    const submitReview = (e) => {
        e.preventDefault();
        post(routeWithBase(`/products/${product.slug}/reviews`, app_base), {
            preserveScroll: true,
        });
    };

    const handleReviewPageChange = (_event, page) => {
        router.get(routeWithBase(`/products/${product.slug}`, app_base), { reviews_page: page }, {
            preserveScroll: true,
            preserveState: true,
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
            <UserBrandHead title={product.name} />
            
            <Navbar />

            <Container maxWidth="xl" sx={{ mt: { xs: 2, md: 4 }, px: { lg: 6 } }}>
                <BackLink href={routeWithBase('/products', app_base)}>
                    {t('Back to Shop')}
                </BackLink>

                <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 0.4fr) minmax(0, 0.6fr)' }, 
                    gap: { xs: 4, md: 8 },
                    alignItems: 'start'
                }}>
                    {/* Image Gallery */}
                    <Stack spacing={2} sx={{ width: '100%', maxWidth: { sm: 420 }, mx: 'auto' }}>
                        <Box sx={{ 
                            position: 'relative', 
                            pt: '133.33%', 
                            borderRadius: 2, 
                            overflow: 'hidden',
                            border: '1px solid',
                            borderColor: 'rgba(36,27,24,0.1)',
                            bgcolor: musicColors.sheet,
                            boxShadow: '0 22px 58px rgba(36,27,24,0.14)',
                        }}>
                            <Box 
                                component="img" 
                                src={productImageUrl(images[activeImageIndex], app_url)}
                                sx={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover'
                                }}
                            />
                        </Box>
                    </Stack>

                    {/* Product Info */}
                    <Stack spacing={3.5} sx={{ minWidth: 0 }}>
                        <Box>
                            <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 1.5 }}>
                                {product.category?.name || t('Uncategorized')}
                            </Typography>
                            <Typography variant="h3" sx={{ fontWeight: 950, mb: 2, lineHeight: 1.08, color: musicColors.ink }}>
                                {product.name}
                            </Typography>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                                <Rating value={parseFloat(product.rating || 0)} readOnly size="small" precision={0.5} />
                                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.5 }}>
                                    ({product.review_count || 0} {t('reviews')})
                                </Typography>
                            </Stack>
                        </Box>

                        <Box sx={{ py: 1 }}>
                            <Typography variant="h3" sx={{ fontWeight: 950, mb: 1, color: musicColors.rosin }}>
                                {formatMoney(skuPrice(selectedSku))}
                            </Typography>
                            {hasFlashSale(selectedSku) && (
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                    <Chip label={t('Flash Sale')} color="error" size="small" sx={{ fontWeight: 800 }} />
                                    <Typography variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
                                        {formatMoney(skuOriginalPrice(selectedSku))}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('Ends')} {new Date(selectedSku.flash_sale.ends_at).toLocaleString()}
                                    </Typography>
                                </Stack>
                            )}
                            <Typography variant="caption" color="success.main" sx={{ fontWeight: 600 }}>
                                {t('In Stock')} ({selectedSku?.available_qty ?? 0} {t('available')})
                            </Typography>
                        </Box>

                        {/* Image Selector moved here */}
                        <Box sx={{ display: 'flex', gap: 1.5, overflowX: 'auto', pb: 1 }}>
                            {images.map((img, idx) => (
                                <Box 
                                    key={idx}
                                    onClick={() => {
                                        setActiveImageIndex(idx);
                                        const relatedSku = product.skus.find(
                                            (sku) => sku?.image?.id === img?.id || sku?.image?.image_path === img?.image_path
                                        );
                                        if (relatedSku) {
                                            setSelectedSku(relatedSku);
                                            setQuantity(1);
                                        }
                                    }}
                                    component="img"
                                    src={productImageUrl(img, app_url)}
                                    sx={{ 
                                        width: 72, 
                                        height: 96, 
                                        borderRadius: 1, 
                                        border: activeImageIndex === idx ? '2px solid' : '1px solid',
                                        borderColor: activeImageIndex === idx ? 'primary.main' : 'divider',
                                        cursor: 'pointer',
                                        objectFit: 'cover'
                                    }}
                                />
                            ))}
                        </Box>

                        <Divider />

                        {/* Variants Selection */}
                        {product.skus.length > 1 && (
                            <Box sx={{ py: 1 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 2 }}>{t('Choose finish / variant')}</Typography>
                                <ToggleButtonGroup
                                    value={selectedSku?.id}
                                    exclusive
                                    onChange={(e, next) => {
                                        const sku = product.skus.find(s => s.id === next);
                                        if (sku) {
                                            setSelectedSku(sku);
                                            setQuantity(1);
                                        }
                                    }}
                                    size="small"
                                    sx={{ flexWrap: 'wrap', gap: 1.5, '& .MuiToggleButton-root': { border: '1px solid !important', borderRadius: '8px !important', px: 2, py: 1 } }}
                                >
                                    {product.skus.map((sku) => (
                                        <ToggleButton key={sku.id} value={sku.id} disabled={!sku.is_active}>
                                            <Stack spacing={0.25} alignItems="flex-start">
                                                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                                    {Object.values(sku.attributes || {}).join(' / ') || sku.sku_code}
                                                </Typography>
                                                <Typography variant="caption" color={hasFlashSale(sku) ? 'error.main' : 'text.secondary'} sx={{ fontWeight: 800 }}>
                                                    {formatMoney(skuPrice(sku))}
                                                </Typography>
                                            </Stack>
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Box>
                        )}

                        {/* Quantity & Actions */}
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1.25}
                            alignItems={{ xs: 'stretch', sm: 'center' }}
                            sx={{ pt: 2, width: '100%', minWidth: 0 }}
                        >
                            <Box sx={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'space-between',
                                border: '1px solid', 
                                borderColor: 'divider', 
                                borderRadius: 2,
                                bgcolor: musicColors.sheet,
                                p: 0.5,
                                width: { xs: '100%', sm: 120 },
                                flex: { xs: '0 0 auto', sm: '0 0 120px' },
                            }}>
                                <IconButton size="small" onClick={() => handleQuantityChange(-1)} disabled={quantity <= 1}>
                                    <RemoveIcon fontSize="small" />
                                </IconButton>
                                <Typography variant="body1" sx={{ px: 2.5, fontWeight: 700 }}>{quantity}</Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => handleQuantityChange(1)}
                                    disabled={quantity >= selectedSkuQtyLimit}
                                >
                                    <AddIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Button 
                                variant="contained" 
                                startIcon={<ShoppingBag />}
                                disabled={!selectedSku}
                                onClick={handleAddToCart}
                                sx={{
                                    py: 1.75,
                                    fontWeight: 800,
                                    borderRadius: 2,
                                    fontSize: '1rem',
                                    flex: { xs: '0 0 auto', sm: '1 1 0' },
                                    minWidth: 0,
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {t('Add to Cart')}
                            </Button>
                            <IconButton
                                sx={{
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    borderRadius: 2,
                                    p: 1.5,
                                    width: { xs: '100%', sm: 56 },
                                    height: 56,
                                    flex: { xs: '0 0 auto', sm: '0 0 56px' },
                                }}
                            >
                                <FavoriteBorder color="primary" />
                            </IconButton>
                        </Stack>

                        <Box sx={{ ...sectionShellSx, p: { xs: 2.5, md: 4 }, mt: 4 }}>
                            <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>{t('Details')}</Typography>
                            <Typography variant="h6" sx={{ fontWeight: 950, mb: 2, color: musicColors.ink }}>{t('Product description')}</Typography>
                            <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.8, opacity: 0.9 }}>
                                {product.description || t('No description available.')}
                            </Typography>
                        </Box>

                        <Stack direction="row" spacing={3}>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' } }}>
                                <Share fontSize="small" />
                                <Typography variant="caption" sx={{ fontWeight: 600 }}>{t('Share')}</Typography>
                            </Stack>
                        </Stack>
                    </Stack>
                </Box>

                <Box sx={{ mt: 8 }}>
                    <Typography sx={{ ...eyebrowSxForTheme(theme), mb: 0.5 }}>
                        {t('Feedback')}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 950, mb: 2, color: musicColors.ink }}>
                        {t('Ratings & Reviews')}
                    </Typography>
                    <Stack spacing={2}>
                        {auth?.user ? (
                            <Box component="form" onSubmit={submitReview} sx={{ ...sectionShellSx, p: 2 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                    {t('Rate this product')}
                                </Typography>
                                <Stack
                                    direction={{ xs: 'column', sm: 'row' }}
                                    spacing={1}
                                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                                    sx={{ mb: 1.5 }}
                                >
                                    <Rating
                                        name="product-rating"
                                        value={Number(data.rating)}
                                        onChange={(_, value) => setData('rating', value || 1)}
                                        icon={<Star fontSize="inherit" />}
                                        emptyIcon={<StarBorder fontSize="inherit" />}
                                        size="large"
                                        sx={{
                                            color: 'primary.main',
                                            '& .MuiRating-icon': {
                                                width: 34,
                                                height: 34,
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            },
                                            '& .MuiSvgIcon-root': {
                                                display: 'block',
                                                fontSize: 30,
                                            },
                                        }}
                                    />
                                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                                        {t('Your rating')}: {Number(data.rating) || 1} / 5
                                    </Typography>
                                </Stack>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={2}
                                    label={t('Comment (optional)')}
                                    value={data.comment}
                                    onChange={(e) => setData('comment', e.target.value)}
                                    error={Boolean(errors.comment)}
                                    helperText={errors.comment}
                                />
                                {errors.rating && (
                                    <Typography variant="caption" color="error">
                                        {errors.rating}
                                    </Typography>
                                )}
                                <Button type="submit" variant="contained" sx={{ mt: 1.5 }} disabled={processing}>
                                    {t(processing ? 'Saving...' : 'Submit rating')}
                                </Button>
                            </Box>
                        ) : (
                            <Alert severity="info" variant="outlined">
                                <Link href={routeWithBase('/login', app_base)}>{t('Log in')}</Link> {t('to leave a rating.')}
                            </Alert>
                        )}

                        {reviewRows.length > 0 ? (
                            <>
                                {reviewRows.map((r) => (
                                    <Box key={r.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                {r.user?.name || t('Customer')}
                                            </Typography>
                                            <Rating readOnly size="small" value={Number(r.rating)} />
                                        </Stack>
                                        {r.comment && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                                                {r.comment}
                                            </Typography>
                                        )}
                                    </Box>
                                ))}
                                {reviews.last_page > 1 && (
                                    <Stack alignItems="center" sx={{ mt: 1 }}>
                                        <Pagination
                                            count={reviews.last_page}
                                            page={reviews.current_page}
                                            onChange={handleReviewPageChange}
                                            color="primary"
                                            size="small"
                                        />
                                    </Stack>
                                )}
                            </>
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                {t('No reviews yet. Be the first to rate this product.')}
                            </Typography>
                        )}
                    </Stack>
                </Box>

                {/* Recommendations */}
                {frequentlyBoughtTogether.length > 0 && (
                    <Box sx={{ mt: 10, mb: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>{t('Frequently Bought Together')}</Typography>
                        <Box sx={{
                            ...productListGridSx,
                        }}>
                            {frequentlyBoughtTogether.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </Box>
                    </Box>
                )}

                {recommendedProducts.length > 0 && (
                    <Box sx={{ mt: 10, mb: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>{t('Recommended for you')}</Typography>
                        <Box sx={{ 
                            ...productListGridSx,
                        }}>
                            {recommendedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Related Products */}
                {relatedProducts.length > 0 && (
                    <Box sx={{ mt: 6, mb: 4 }}>
                        <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>{t('You May Also Like')}</Typography>
                        <Box sx={{ 
                            ...productListGridSx,
                        }}>
                            {relatedProducts.map((p) => (
                                <ProductCard key={p.id} product={p} />
                            ))}
                        </Box>
                    </Box>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />

            <Snackbar
                open={cartToast}
                autoHideDuration={3000}
                onClose={() => setCartToast(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                sx={{ bottom: { xs: 72, sm: 24 } }}
            >
                <Alert severity="success" variant="filled" onClose={() => setCartToast(false)} sx={{ width: '100%' }}>
                    {t('Added to your cart')}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default Show;
