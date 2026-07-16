import React, { useState, useEffect, useMemo } from 'react';
import { usePage, router } from '@inertiajs/react';
import {
    Box,
    Container,
    Typography,
    Stack,
    Button,
    Chip,
    TextField,
    InputAdornment,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Pagination,
    Drawer,
    IconButton,
    Divider,
    Badge,
    useMediaQuery,
    useTheme,
} from '@mui/material';
import { Search, Clear, Tune, Close, LocalFireDepartment } from '@mui/icons-material';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MobileBottomNavSpacer } from '@/Components/User/MobileBottomNav';
import Footer from '@/Components/User/Footer';
import ProductCard from '@/Components/User/ProductCard';
import UserBrandHead from '@/Components/User/UserBrandHead';
import { routeWithBase } from '@/Utils/url';
import { productListGridSx } from '@/Utils/productListGrid';

const Index = ({ products, categories, filters }) => {
    const theme = useTheme();
    const isMobileFilters = useMediaQuery(theme.breakpoints.down('md'));
    const { app_base } = usePage().props;
    const [search, setSearch] = useState(filters.search || '');
    const [minPrice, setMinPrice] = useState(filters.min_price || '');
    const [maxPrice, setMaxPrice] = useState(filters.max_price || '');
    const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

    useEffect(() => {
        setSearch(filters.search || '');
        setMinPrice(filters.min_price || '');
        setMaxPrice(filters.max_price || '');
    }, [filters.search, filters.min_price, filters.max_price]);

    useEffect(() => {
        if (!isMobileFilters) {
            setFilterDrawerOpen(false);
        }
    }, [isMobileFilters]);

    const activeFilterCount = useMemo(() => {
        let n = 0;
        if (filters.category) n += 1;
        if (filters.search && String(filters.search).trim()) n += 1;
        if (filters.sort && filters.sort !== 'newest') n += 1;
        if (filters.min_price) n += 1;
        if (filters.max_price) n += 1;
        if (filters.min_rating) n += 1;
        if (filters.flash_sale) n += 1;
        return n;
    }, [filters.category, filters.search, filters.sort, filters.min_price, filters.max_price, filters.min_rating, filters.flash_sale]);

    const applyFilters = (newFilters) => {
        router.get(
            routeWithBase('/products', app_base),
            {
                ...filters,
                ...newFilters,
                page: 1,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
        if (isMobileFilters) {
            setFilterDrawerOpen(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ search });
    };

    const handleCategoryClick = (slug) => {
        const newCategory = filters.category === slug ? null : slug;
        applyFilters({ category: newCategory });
    };

    const handleSortChange = (e) => {
        applyFilters({ sort: e.target.value });
    };

    const applyPriceFilters = (e) => {
        e.preventDefault();
        applyFilters({ min_price: minPrice || undefined, max_price: maxPrice || undefined });
    };

    const handlePageChange = (event, value) => {
        router.get(
            routeWithBase('/products', app_base),
            {
                ...filters,
                page: value,
            },
            {
                preserveState: true,
                replace: true,
            },
        );
    };

    const clearFilters = () => {
        setSearch('');
        setMinPrice('');
        setMaxPrice('');
        router.get(routeWithBase('/products', app_base), {}, { replace: true });
        if (isMobileFilters) {
            setFilterDrawerOpen(false);
        }
    };

    const fieldSx = {
        bgcolor: 'background.paper',
        '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
        },
    };

    const categoryChips = (
        <Box
            sx={{
                display: 'flex',
                gap: 1,
                ...(isMobileFilters
                    ? {
                          flexWrap: 'wrap',
                      }
                    : {
                          flexWrap: 'nowrap',
                          overflowX: 'auto',
                          pb: 1.5,
                          mx: { xs: -0.5, sm: 0 },
                          px: { xs: 0.5, sm: 0 },
                          WebkitOverflowScrolling: 'touch',
                          '&::-webkit-scrollbar': { height: 6 },
                          '&::-webkit-scrollbar-thumb': { bgcolor: 'divider', borderRadius: 3 },
                      }),
            }}
        >
            <Chip
                label="All"
                onClick={() => handleCategoryClick(null)}
                variant={!filters.category ? 'filled' : 'outlined'}
                color={!filters.category ? 'primary' : 'default'}
                size="small"
                sx={{ fontWeight: 600, flexShrink: 0 }}
            />
            {categories.map((cat) => (
                <Chip
                    key={cat.id}
                    label={cat.name}
                    onClick={() => handleCategoryClick(cat.slug)}
                    variant={filters.category === cat.slug ? 'filled' : 'outlined'}
                    color={filters.category === cat.slug ? 'primary' : 'default'}
                    size="small"
                    sx={{ fontWeight: 600, flexShrink: 0 }}
                />
            ))}
        </Box>
    );

    const searchAndSort = (
        <Stack spacing={2}>
            <Box
                component="form"
                onSubmit={handleSearch}
                sx={{
                    display: 'flex',
                    gap: 1,
                    flexDirection: { xs: 'column', sm: 'row' },
                    alignItems: { sm: 'stretch' },
                }}
            >
                <TextField
                    fullWidth
                    size="small"
                    placeholder="Search products…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <Search fontSize="small" color="action" />
                            </InputAdornment>
                        ),
                        sx: { borderRadius: 1.5, bgcolor: 'background.paper' },
                    }}
                    sx={{ flex: 1 }}
                />
                <Button
                    type="submit"
                    variant="contained"
                    sx={{
                        px: 2.5,
                        borderRadius: 1.5,
                        fontWeight: 700,
                        flexShrink: 0,
                        minHeight: 40,
                    }}
                >
                    Search
                </Button>
            </Box>
            <FormControl size="small" fullWidth={isMobileFilters} sx={{ width: { md: 220 }, flexShrink: 0 }}>
                <InputLabel id="products-sort-label">Sort</InputLabel>
                <Select
                    labelId="products-sort-label"
                    label="Sort"
                    value={filters.sort || 'newest'}
                    onChange={handleSortChange}
                    sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}
                >
                    <MenuItem value="newest">Newest</MenuItem>
                    <MenuItem value="price_low">Price: low to high</MenuItem>
                    <MenuItem value="price_high">Price: high to low</MenuItem>
                    <MenuItem value="best_selling">Best selling</MenuItem>
                    <MenuItem value="rating">Top rated</MenuItem>
                </Select>
            </FormControl>
        </Stack>
    );

    const advancedFilters = (
        <Box
            component="form"
            onSubmit={applyPriceFilters}
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: isMobileFilters ? '1fr' : 'repeat(3, minmax(0, 1fr))',
                    lg: isMobileFilters ? '1fr' : 'minmax(150px, 1fr) minmax(150px, 1fr) minmax(180px, 1fr) auto auto',
                },
                gap: 1.25,
                alignItems: 'stretch',
            }}
        >
            <TextField size="small" type="number" label="Min price" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} sx={fieldSx} />
            <TextField size="small" type="number" label="Max price" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} sx={fieldSx} />
            <FormControl size="small" sx={fieldSx}>
                <InputLabel id={isMobileFilters ? 'rating-filter-label-mobile' : 'rating-filter-label'}>Rating</InputLabel>
                <Select
                    labelId={isMobileFilters ? 'rating-filter-label-mobile' : 'rating-filter-label'}
                    label="Rating"
                    value={filters.min_rating || ''}
                    onChange={(e) => applyFilters({ min_rating: e.target.value || undefined })}
                >
                    <MenuItem value="">Any rating</MenuItem>
                    <MenuItem value="4">4 stars & up</MenuItem>
                    <MenuItem value="3">3 stars & up</MenuItem>
                </Select>
            </FormControl>
            <Button
                variant="outlined"
                startIcon={<LocalFireDepartment />}
                onClick={() => applyFilters({ flash_sale: filters.flash_sale ? undefined : 1 })}
                sx={{
                    minHeight: 40,
                    px: 2,
                    borderRadius: 1.5,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                    color: filters.flash_sale ? 'primary.main' : 'text.primary',
                    borderColor: filters.flash_sale ? 'primary.main' : 'divider',
                    bgcolor: filters.flash_sale ? 'primary.light' : 'background.paper',
                    '&:hover': {
                        borderColor: 'primary.main',
                        bgcolor: filters.flash_sale ? 'primary.light' : 'primary.light',
                    },
                }}
            >
                Flash sale
            </Button>
            <Button
                type="submit"
                variant="contained"
                sx={{
                    minHeight: 40,
                    px: 3,
                    borderRadius: 1.5,
                    fontWeight: 900,
                    whiteSpace: 'nowrap',
                }}
            >
                Apply
            </Button>
        </Box>
    );

    return (
        <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
            <UserBrandHead title="Shop All Products" />

            <Navbar />

            <Container maxWidth="lg" sx={{ mt: { xs: 2, md: 4 }, px: { xs: 2, sm: 3 } }}>
                {/* Title + mobile filter entry */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 1.5,
                        mb: 2,
                    }}
                >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
                            {filters.category
                                ? categories.find((c) => c.slug === filters.category)?.name
                                : 'All Products'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Showing {products.from || 0}-{products.to || 0} of {products.total} items
                        </Typography>
                        {filters.flash_sale ? (
                            <Chip
                                icon={<LocalFireDepartment />}
                                label="Flash sale"
                                color="primary"
                                size="small"
                                onDelete={() => applyFilters({ flash_sale: undefined })}
                                sx={{ mt: 1, fontWeight: 800 }}
                            />
                        ) : null}
                    </Box>

                    {isMobileFilters ? (
                        <Badge
                            color="primary"
                            overlap="circular"
                            badgeContent={activeFilterCount}
                            invisible={activeFilterCount === 0}
                            sx={{ flexShrink: 0, '& .MuiBadge-badge': { fontWeight: 800 } }}
                        >
                            <Button
                                variant={activeFilterCount > 0 ? 'contained' : 'outlined'}
                                color="primary"
                                size="medium"
                                startIcon={<Tune />}
                                onClick={() => setFilterDrawerOpen(true)}
                                aria-label="Open filters"
                                sx={{
                                    fontWeight: 800,
                                    borderRadius: 2,
                                    px: 1.5,
                                    py: 1,
                                    minWidth: 'auto',
                                    whiteSpace: 'nowrap',
                                    boxShadow: activeFilterCount > 0 ? 2 : 0,
                                }}
                            >
                                Filters
                            </Button>
                        </Badge>
                    ) : null}
                </Box>

                {/* Desktop / tablet: filters inline */}
                {!isMobileFilters ? (
                    <>
                        <Box sx={{ mb: 2 }}>{categoryChips}</Box>
                        <Stack
                            direction={{ xs: 'column', md: 'row' }}
                            spacing={1.5}
                            alignItems={{ md: 'flex-start' }}
                            sx={{ mb: 3 }}
                        >
                            <Box
                                component="form"
                                onSubmit={handleSearch}
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    display: 'flex',
                                    gap: 1,
                                    flexDirection: { xs: 'column', sm: 'row' },
                                    alignItems: { sm: 'stretch' },
                                }}
                            >
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Search products…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <Search fontSize="small" color="action" />
                                            </InputAdornment>
                                        ),
                                        sx: { borderRadius: 1.5, bgcolor: 'background.paper' },
                                    }}
                                    sx={{ flex: 1 }}
                                />
                                <Button
                                    type="submit"
                                    variant="contained"
                                    sx={{
                                        px: 2.5,
                                        borderRadius: 1.5,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                        minHeight: 40,
                                    }}
                                >
                                    Search
                                </Button>
                            </Box>
                            <FormControl size="small" sx={{ width: { xs: '100%', md: 220 }, flexShrink: 0 }}>
                                <InputLabel id="products-sort-label-desktop">Sort</InputLabel>
                                <Select
                                    labelId="products-sort-label-desktop"
                                    label="Sort"
                                    value={filters.sort || 'newest'}
                                    onChange={handleSortChange}
                                    sx={{ borderRadius: 1.5, bgcolor: 'background.paper' }}
                                >
                                    <MenuItem value="newest">Newest</MenuItem>
                                    <MenuItem value="price_low">Price: low to high</MenuItem>
                                    <MenuItem value="price_high">Price: high to low</MenuItem>
                                    <MenuItem value="best_selling">Best selling</MenuItem>
                                    <MenuItem value="rating">Top rated</MenuItem>
                                </Select>
                            </FormControl>
                        </Stack>
                        <Box sx={{ mb: 3 }}>{advancedFilters}</Box>
                    </>
                ) : null}

                {/* Small screens: right drawer */}
                <Drawer
                    anchor="right"
                    open={isMobileFilters && filterDrawerOpen}
                    onClose={() => setFilterDrawerOpen(false)}
                    PaperProps={{
                        sx: {
                            width: 'min(100vw - 40px, 400px)',
                            maxWidth: '100%',
                            borderRadius: '12px 0 0 12px',
                            display: 'flex',
                            flexDirection: 'column',
                        },
                    }}
                    ModalProps={{ keepMounted: true }}
                >
                    <Box
                        sx={{
                            px: 2,
                            py: 1.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: 900 }}>
                            Categories & filters
                        </Typography>
                        <IconButton
                            edge="end"
                            onClick={() => setFilterDrawerOpen(false)}
                            aria-label="Close filters"
                            size="small"
                        >
                            <Close />
                        </IconButton>
                    </Box>

                    <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 1 }}>
                            Category
                        </Typography>
                        {categoryChips}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 1 }}>
                            Search & sort
                        </Typography>
                        {searchAndSort}

                        <Divider sx={{ my: 2 }} />

                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, display: 'block', mb: 1 }}>
                            Price & rating
                        </Typography>
                        {advancedFilters}

                        <Divider sx={{ my: 2 }} />

                        <Button
                            fullWidth
                            variant="outlined"
                            color="inherit"
                            startIcon={<Clear />}
                            onClick={clearFilters}
                            sx={{ fontWeight: 800 }}
                        >
                            Reset all filters
                        </Button>
                    </Box>
                </Drawer>

                {filters.flash_sale ? (
                    <Box
                        sx={{
                            mb: 2.5,
                            p: { xs: 1.5, sm: 2 },
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'primary.main',
                            bgcolor: 'primary.light',
                            display: 'flex',
                            alignItems: { xs: 'flex-start', sm: 'center' },
                            justifyContent: 'space-between',
                            gap: 1.5,
                            flexDirection: { xs: 'column', sm: 'row' },
                        }}
                    >
                        <Stack direction="row" spacing={1.25} alignItems="center">
                            <Box
                                sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 1.5,
                                    display: 'grid',
                                    placeItems: 'center',
                                    bgcolor: 'background.paper',
                                    color: 'primary.main',
                                    flexShrink: 0,
                                }}
                            >
                                <LocalFireDepartment fontSize="small" />
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.2 }}>
                                    Flash sale products
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                    Limited-time deals
                                </Typography>
                            </Box>
                        </Stack>
                        <Button
                            variant="outlined"
                            size="small"
                            color="primary"
                            onClick={() => applyFilters({ flash_sale: undefined })}
                            sx={{ borderRadius: 1.5, fontWeight: 900, bgcolor: 'background.paper' }}
                        >
                            Show all
                        </Button>
                    </Box>
                ) : null}

                {products.data.length > 0 ? (
                    <Box
                        sx={{
                            ...productListGridSx,
                            mb: 6,
                        }}
                    >
                        {products.data.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))}
                    </Box>
                ) : (
                    <Stack alignItems="center" justifyContent="center" sx={{ py: 12 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            No products found
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center', px: 2 }}>
                            Try a different category or clear your search.
                        </Typography>
                        <Button variant="outlined" onClick={clearFilters} startIcon={<Clear />}>
                            Reset filters
                        </Button>
                    </Stack>
                )}

                {products.total > products.per_page && (
                    <Stack alignItems="center" sx={{ mt: 4, mb: 8 }}>
                        <Pagination
                            count={products.last_page}
                            page={products.current_page}
                            onChange={handlePageChange}
                            color="primary"
                            size="medium"
                            sx={{
                                '& .MuiPaginationItem-root': { fontWeight: 700 },
                                '& .Mui-selected': { borderRadius: 1 },
                            }}
                        />
                    </Stack>
                )}
            </Container>

            <Footer />
            <MobileBottomNavSpacer />
            <MobileBottomNav />
        </Box>
    );
};

export default Index;
