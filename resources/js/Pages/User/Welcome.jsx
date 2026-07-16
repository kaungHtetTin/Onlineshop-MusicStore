import React from 'react';
import { usePage, Link } from '@inertiajs/react';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Container,
    Typography,
    Button,
    Stack,
    Avatar,
    Chip,
} from '@mui/material';
import {
    ArrowForward,
    LocalFireDepartment,
    AutoAwesome,
    ShoppingBag,
    ArticleOutlined,
    PlayCircle,
    AccountBalanceWallet,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import ProductCard from '@/Components/User/ProductCard';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { productListGridSx } from '@/Utils/productListGrid';

const defaultSections = {
    categories: { title: 'Categories', is_active: true },
    flash_sale: { title: null, is_active: true },
    promos: { title: null, is_active: true },
    best_sellers: { title: 'Best Sellers', is_active: true },
    blogs: { title: 'Ideas and guides', subtitle: 'Fresh shopping inspiration from our team.', is_active: true },
};

const defaultHero = {
    title: 'Fresh picks for every occasion',
    subtitle: 'Discover customer favorites, seasonal gifts, and new arrivals curated for today.',
    button_label: 'Shop now',
    link_url: '/products',
    accent_color: null,
    image_url: null,
};

const fallbackPromos = [
    {
        id: 'editors-picks',
        title: "Editor's Picks",
        subtitle: 'Handpicked favorites',
        link_url: '/products',
        accent_color: null,
        image_url: null,
    },
    {
        id: 'new-arrivals',
        title: 'New Arrivals',
        subtitle: 'Latest drops',
        link_url: '/products?sort=newest',
        accent_color: null,
        image_url: null,
    },
];

const isExternal = (href) => /^https?:\/\//i.test(href || '');
const blockHref = (href, appBase) => {
    if (!href) return routeWithBase('/products', appBase);
    return isExternal(href) ? href : routeWithBase(href, appBase);
};

function blockLinkProps(href, appBase) {
    const resolved = blockHref(href, appBase);
    if (isExternal(resolved)) {
        return { component: 'a', href: resolved, target: '_blank', rel: 'noopener noreferrer' };
    }

    return { component: Link, href: resolved };
}

const formatBlogDate = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric' });
};

function BlogPreviewCard({ post }) {
    const { app_base } = usePage().props;

    return (
        <Box
            component={Link}
            href={routeWithBase(`/blogs/${post.slug}`, app_base)}
            sx={{
                display: 'grid',
                gridTemplateRows: 'auto 1fr',
                bgcolor: 'white',
                border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 1,
                overflow: 'hidden',
                color: 'inherit',
                textDecoration: 'none',
                minHeight: 260,
                '&:hover': { borderColor: 'primary.main' },
            }}
        >
            <Box sx={{ aspectRatio: '16 / 9', bgcolor: 'primary.light', display: 'grid', placeItems: 'center', overflow: 'hidden', position: 'relative' }}>
                {post.cover_image_url ? (
                    <Box component="img" src={post.cover_image_url} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <ArticleOutlined sx={{ fontSize: 42, color: 'primary.main', opacity: 0.55 }} />
                )}
                {post.youtube_video_id && (
                    <PlayCircle sx={{ position: 'absolute', right: 10, bottom: 10, color: 'white', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.45))' }} />
                )}
            </Box>
            <Stack spacing={0.75} sx={{ p: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                    {[post.category?.name, formatBlogDate(post.published_at)].filter(Boolean).join(' - ')}
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.25 }}>{post.title}</Typography>
                {post.excerpt && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {post.excerpt}
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}

const Welcome = ({ products, categories, flashSaleProducts = [], activeFlashSale = null, storefront = {}, latestBlogs = [], paymentMethods = [] }) => {
    const theme = useTheme();
    const { app_base, app_settings } = usePage().props;
    const sections = { ...defaultSections, ...(storefront.sections || {}) };
    const hasConfiguredPromos = Array.isArray(storefront.promos) && storefront.promos.length > 0;
    const hero = storefront.hero || defaultHero;
    const promos = hasConfiguredPromos
        ? storefront.promos.filter((promo) => promo.is_active !== false)
        : fallbackPromos;
    const themeColor = app_settings?.theme_color || '#087f74';
    const defaultAccent = alpha(theme.palette.primary.main, 0.12);

    const displayCategories = categories.map((cat) => ({
        ...cat,
        icon: cat.metadata?.icon || cat.icon || '🛍️',
        imageUrl: cat.icon_image_url,
        color: cat.metadata?.color || defaultAccent,
    }));

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="Home" />

            <Navbar />

            {hero.is_active !== false && (
                <Container maxWidth="lg" sx={{ mt: 2 }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: hero.image_url ? '1.05fr 0.95fr' : '1fr' },
                            gap: 0,
                            borderRadius: 1,
                            overflow: 'hidden',
                            bgcolor: hero.accent_color || themeColor,
                            minHeight: { xs: 180, sm: 240, md: 330 },
                            position: 'relative',
                        }}
                    >
                        <Box
                            sx={{
                                p: { xs: 3, md: 6 },
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                color: 'white',
                                position: 'relative',
                                zIndex: 1,
                            }}
                        >
                            <Typography variant="h4" sx={{ fontWeight: 900, fontSize: { xs: '1.55rem', md: '2.65rem' }, mb: 1, lineHeight: 1.05 }}>
                                {hero.title || defaultHero.title}
                            </Typography>
                            <Typography variant="body2" sx={{ opacity: 0.9, mb: 2, maxWidth: 460, display: { xs: 'none', sm: 'block' } }}>
                                {hero.subtitle || defaultHero.subtitle}
                            </Typography>
                            <Box>
                                <Button
                                    {...blockLinkProps(hero.link_url || '/products', app_base)}
                                    variant="contained"
                                    sx={{ bgcolor: 'white', color: 'primary.main', px: 3, '&:hover': { bgcolor: '#f5f5f5' } }}
                                >
                                    {hero.button_label || defaultHero.button_label}
                                </Button>
                            </Box>
                        </Box>
                        <Box
                            sx={{
                                display: { xs: 'none', md: 'flex' },
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: hero.image_url ? 'transparent' : 'primary.light',
                                position: 'relative',
                                overflow: 'hidden',
                                minHeight: 260,
                            }}
                        >
                            {hero.image_url ? (
                                <Box component="img" src={hero.image_url} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                <ShoppingBag sx={{ fontSize: 200, color: 'primary.main', opacity: 0.2 }} />
                            )}
                        </Box>
                    </Box>
                </Container>
            )}

            {sections.categories?.is_active !== false && (
                <Container maxWidth="lg" sx={{ mt: 4 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {sections.categories?.title || 'Categories'}
                            </Typography>
                            {sections.categories?.subtitle && (
                                <Typography variant="caption" color="text.secondary">{sections.categories.subtitle}</Typography>
                            )}
                        </Box>
                        <Button
                            component={Link}
                            href={routeWithBase('/categories', app_base)}
                            size="small"
                            endIcon={<ArrowForward />}
                            sx={{ color: 'primary.main', fontSize: '0.75rem' }}
                        >
                            View All
                        </Button>
                    </Stack>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: 'repeat(4, minmax(0, 1fr))',
                                sm: 'repeat(6, minmax(0, 1fr))',
                                md: 'repeat(8, minmax(0, 1fr))',
                            },
                            gap: { xs: 1.25, sm: 2 },
                        }}
                    >
                        {displayCategories.map((cat) => (
                            <Stack
                                key={cat.id}
                                alignItems="center"
                                spacing={0.5}
                                sx={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
                                component={Link}
                                href={routeWithBase(`/categories/${cat.slug}`, app_base)}
                            >
                                <Avatar
                                    src={cat.imageUrl || undefined}
                                    sx={{
                                        width: { xs: 48, md: 64 },
                                        height: { xs: 48, md: 64 },
                                        bgcolor: cat.color,
                                        fontSize: '1.25rem',
                                        borderRadius: 1,
                                        '& img': { objectFit: 'cover' },
                                        '&:hover': { transform: 'translateY(-2px)', transition: '0.2s' },
                                    }}
                                >
                                    {cat.icon}
                                </Avatar>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: '0.7rem',
                                        textAlign: 'center',
                                        lineHeight: 1.2,
                                        width: '100%',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}
                                >
                                    {cat.name}
                                </Typography>
                            </Stack>
                        ))}
                    </Box>
                </Container>
            )}

            {sections.flash_sale?.is_active !== false && activeFlashSale && flashSaleProducts.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: 4 }}>
                    <Box sx={{ bgcolor: 'white', p: 2, borderRadius: 1, border: '1px solid rgba(0,0,0,0.05)' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.25} sx={{ mb: 2 }}>
                            <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                                <LocalFireDepartment color="primary" sx={{ fontSize: '1.25rem' }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                    {sections.flash_sale?.title || activeFlashSale.name || 'Flash Sale'}
                                </Typography>
                                <Chip
                                    label={`Ends ${new Date(activeFlashSale.ends_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
                                    color="primary"
                                    size="small"
                                    sx={{ height: 20, fontSize: '0.65rem', fontWeight: 800 }}
                                />
                            </Stack>
                            <Button component={Link} href={routeWithBase('/products', app_base)} size="small" sx={{ color: 'text.secondary', fontSize: '0.75rem' }}>
                                More
                            </Button>
                        </Stack>
                        <Box sx={{ ...productListGridSx }}>
                            {flashSaleProducts.slice(0, 4).map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </Box>
                    </Box>
                </Container>
            )}

            {sections.promos?.is_active !== false && promos.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: 4 }}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(promos.length, 2)}, 1fr)` }, gap: 2 }}>
                        {promos.slice(0, 2).map((promo, index) => (
                            <Box
                                key={promo.id || promo.key || index}
                                {...blockLinkProps(promo.link_url || '/products', app_base)}
                                sx={{
                                    position: 'relative',
                                    minHeight: 92,
                                    p: 2,
                                    borderRadius: 1,
                                    bgcolor: promo.accent_color || defaultAccent,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    textDecoration: 'none',
                                    color: 'inherit',
                                    overflow: 'hidden',
                                }}
                            >
                                {promo.image_url && (
                                    <Box component="img" src={promo.image_url} alt="" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.22 }} />
                                )}
                                <Box sx={{ position: 'relative', zIndex: 1 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>{promo.title}</Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>{promo.subtitle}</Typography>
                                </Box>
                                <AutoAwesome sx={{ position: 'relative', zIndex: 1, fontSize: 32, color: 'primary.main' }} />
                            </Box>
                        ))}
                    </Box>
                </Container>
            )}

            {sections.best_sellers?.is_active !== false && (
                <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 0.25 }}>
                        {sections.best_sellers?.title || 'Best Sellers'}
                    </Typography>
                    {sections.best_sellers?.subtitle && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{sections.best_sellers.subtitle}</Typography>
                    )}
                    <Box sx={{ ...productListGridSx }}>
                        {products.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </Box>
                </Container>
            )}

            {sections.blogs?.is_active !== false && latestBlogs.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                {sections.blogs?.title || 'Ideas and guides'}
                            </Typography>
                            {sections.blogs?.subtitle && (
                                <Typography variant="caption" color="text.secondary">{sections.blogs.subtitle}</Typography>
                            )}
                        </Box>
                        <Button
                            component={Link}
                            href={routeWithBase('/blogs', app_base)}
                            size="small"
                            endIcon={<ArrowForward />}
                            sx={{ color: 'primary.main', fontSize: '0.75rem' }}
                        >
                            View All
                        </Button>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
                        {latestBlogs.slice(0, 3).map((post) => <BlogPreviewCard key={post.id} post={post} />)}
                    </Box>
                </Container>
            )}

            {paymentMethods.length > 0 && (
                <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                                Payment methods
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                Manual transfer accounts available at checkout.
                            </Typography>
                        </Box>
                        <Button
                            component={Link}
                            href={routeWithBase('/checkout', app_base)}
                            size="small"
                            endIcon={<ArrowForward />}
                            sx={{ color: 'primary.main', fontSize: '0.75rem' }}
                        >
                            Checkout
                        </Button>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
                        {paymentMethods.map((method) => (
                            <Stack
                                key={method.id}
                                direction="row"
                                spacing={1.25}
                                alignItems="center"
                                sx={{
                                    bgcolor: 'white',
                                    border: '1px solid rgba(0,0,0,0.06)',
                                    borderRadius: 1,
                                    p: 1.25,
                                    minWidth: 0,
                                }}
                            >
                                <Box
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 1,
                                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                                        display: 'grid',
                                        placeItems: 'center',
                                        overflow: 'hidden',
                                        flexShrink: 0,
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
                        ))}
                    </Box>
                </Container>
            )}

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
};

export default Welcome;
