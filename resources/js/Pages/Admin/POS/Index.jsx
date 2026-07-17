import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Head, Link, usePage } from '@/spa/router';
import LanguageSwitcher from '@/Components/LanguageSwitcher';
import { usePhraseTranslation, useTranslation } from '@/Utils/i18n';
import { routeWithBase, storageUrl } from '@/Utils/url';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Card,
    CardActionArea,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    IconButton,
    InputAdornment,
    MenuItem,
    Paper,
    Radio,
    RadioGroup,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
    useMediaQuery,
} from '@mui/material';
import {
    Add as AddIcon,
    ChevronLeft as ChevronLeftIcon,
    ChevronRight as ChevronRightIcon,
    Close as CloseIcon,
    Delete as DeleteIcon,
    GridView as GridViewIcon,
    List as ListViewIcon,
    PointOfSale as CheckoutIcon,
    Print as PrintIcon,
    QrCodeScanner as ScanIcon,
    Remove as RemoveIcon,
    Search as SearchIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const money = (value) => Number(value || 0).toFixed(2);
const POS_RESULT_PAGE_SIZE = 24;
const POS_TABLE_ROW_HEIGHT = 54;
const POS_GRID_ROW_HEIGHT = 126;
const POS_RESULT_OVERSCAN_ROWS = 6;

export default function PosIndex({ locations = [], categories = [], can = {}, taxRate = 0 }) {
    const { app_base, app_url, flash = {}, errors: pageErrors = {} } = usePage().props;
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
    const t = useTranslation();
    const tp = usePhraseTranslation();
    const firstLocation = locations[0];
    const [locationId, setLocationId] = useState(firstLocation?.id || '');
    const [categoryId, setCategoryId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [resultMeta, setResultMeta] = useState({ page: 1, per_page: POS_RESULT_PAGE_SIZE, has_more: false, next_page: null, mode: 'popular' });
    const [searchLoading, setSearchLoading] = useState(false);
    const [productResultsElement, setProductResultsElement] = useState(null);
    const [productScrollTop, setProductScrollTop] = useState(0);
    const [productViewportHeight, setProductViewportHeight] = useState(520);
    const [scanError, setScanError] = useState('');
    const [resultsView, setResultsView] = useState('table');
    const [cart, setCart] = useState([]);
    const [customerOptions, setCustomerOptions] = useState([]);
    const [customerSearchInput, setCustomerSearchInput] = useState('');
    const [customerLoading, setCustomerLoading] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [salePriceType, setSalePriceType] = useState('retail');
    const [discountType, setDiscountType] = useState('');
    const [discountValue, setDiscountValue] = useState('');
    const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
    const [mobileStep, setMobileStep] = useState('products');
    const [tenderType, setTenderType] = useState('cash');
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState('');
    const [errors, setErrors] = useState({});
    const [receipt, setReceipt] = useState(null);
    const [isOnline, setIsOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
    const searchInputRef = useRef(null);
    const categoryScrollRef = useRef(null);
    const checkoutIntentRef = useRef('complete');
    const productScrollFrameRef = useRef(null);

    const location = locations.find((item) => Number(item.id) === Number(locationId));
    const currencySymbol = '$';
    const paymentMethods = ['cash', 'card', 'mobile'];

    const api = async (url, options = {}) => {
        setErrors({});
        try {
            const response = await window.axios({ url: routeWithBase(url, app_base), ...options });
            return response.data;
        } catch (error) {
            const nextErrors = error.response?.data?.errors || { request: error.response?.data?.message || tp('Request failed.') };
            setErrors(nextErrors);
            throw error;
        }
    };

    const fetchSearch = useCallback(async (options = {}) => {
        const { autoAddFirst = false, clearInputAfterSearch = false, append = false, page = 1 } = options;
        if (!locationId) return;

        setScanError('');
        setSearchLoading(true);
        try {
            const data = await api('/admin/pos/products/search', {
                method: 'get',
                params: { location_id: locationId, category_id: categoryId || undefined, q: searchQuery.trim(), page, per_page: resultMeta.per_page },
            });
            const products = Array.isArray(data) ? data : data.data || [];
            const meta = Array.isArray(data)
                ? { page, per_page: resultMeta.per_page, has_more: false, next_page: null, mode: searchQuery.trim() ? 'search' : 'popular' }
                : data.meta;
            setResultMeta(meta);
            setSearchResults((prev) => {
                if (!append) return products;
                const existingIds = new Set(prev.map((item) => item.id));
                return [...prev, ...products.filter((item) => !existingIds.has(item.id))];
            });
            if (autoAddFirst && products[0]) {
                addProductToCart(products[0]);
            }
        } finally {
            setSearchLoading(false);
            if (clearInputAfterSearch) {
                setSearchQuery('');
                window.setTimeout(() => searchInputRef.current?.focus(), 0);
            }
        }
    }, [app_base, categoryId, locationId, resultMeta.per_page, searchQuery]);

    const fetchCustomers = useCallback(async (query) => {
        setCustomerLoading(true);
        try {
            const data = await api('/admin/pos/customers/search', {
                method: 'get',
                params: { q: query.trim() },
            });
            setCustomerOptions(Array.isArray(data) ? data : []);
        } catch {
            setCustomerOptions([]);
        } finally {
            setCustomerLoading(false);
        }
    }, [app_base]);

    useEffect(() => {
        const updateNetworkState = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', updateNetworkState);
        window.addEventListener('offline', updateNetworkState);
        return () => {
            window.removeEventListener('online', updateNetworkState);
            window.removeEventListener('offline', updateNetworkState);
        };
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            fetchSearch();
        }, 180);
        return () => window.clearTimeout(timer);
    }, [fetchSearch]);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            fetchCustomers(customerSearchInput);
        }, 300);
        return () => window.clearTimeout(timer);
    }, [customerSearchInput, fetchCustomers]);

    useEffect(() => {
        window.setTimeout(() => searchInputRef.current?.focus(), 150);
    }, []);

    useEffect(() => {
        if (!productResultsElement) return undefined;

        const updateMetrics = () => {
            setProductScrollTop(productResultsElement.scrollTop);
            setProductViewportHeight(productResultsElement.clientHeight || 520);
        };
        const onScroll = () => {
            if (productScrollFrameRef.current) return;
            productScrollFrameRef.current = window.requestAnimationFrame(() => {
                productScrollFrameRef.current = null;
                updateMetrics();
            });
        };

        updateMetrics();
        productResultsElement.addEventListener('scroll', onScroll, { passive: true });

        let resizeObserver = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(updateMetrics);
            resizeObserver.observe(productResultsElement);
        }

        return () => {
            productResultsElement.removeEventListener('scroll', onScroll);
            resizeObserver?.disconnect();
            if (productScrollFrameRef.current) {
                window.cancelAnimationFrame(productScrollFrameRef.current);
                productScrollFrameRef.current = null;
            }
        };
    }, [productResultsElement]);

    useEffect(() => {
        productResultsElement?.scrollTo({ top: 0 });
        setProductScrollTop(0);
    }, [categoryId, locationId, resultsView, searchQuery, productResultsElement]);

    useEffect(() => {
        if (isMobile && cart.length === 0 && mobileStep !== 'products') {
            setMobileStep('products');
        }
    }, [cart.length, isMobile, mobileStep]);

    useEffect(() => {
        setCart([]);
        setSearchResults([]);
        setResultMeta((prev) => ({ ...prev, page: 1, has_more: false, next_page: null, mode: 'popular' }));
        setSearchQuery('');
    }, [locationId]);

    const getProductDisplayName = (product) => [product?.product_name, product?.title].filter(Boolean).join(' - ') || product?.sku_code || tp('Product');

    const resolveProductPrice = (product, priceType = salePriceType) => {
        const wholesale = Number(product?.wholesale_price || 0);
        if (priceType === 'wholesale' && wholesale > 0) return wholesale;
        return Number(product?.price || 0);
    };

    const addProductToCart = (product) => {
        if (Number(product?.available_qty || 0) <= 0) {
            setScanError(`${getProductDisplayName(product)}: ${tp('Out of stock')}`);
            return;
        }

        setCart((prev) => {
            const existingIndex = prev.findIndex((line) => line.sku_id === product.id && line.price_type === salePriceType);
            if (existingIndex >= 0) {
                const updated = [...prev];
                const line = updated[existingIndex];
                updated[existingIndex] = {
                    ...line,
                    quantity: Math.min(Number(line.quantity || 0) + 1, Number(line.available_qty || 1)),
                };
                return updated;
            }

            return [
                ...prev,
                {
                    id: makeId(),
                    sku_id: product.id,
                    sku_code: product.sku_code,
                    barcode: product.barcode,
                    name: getProductDisplayName(product),
                    image_path: product.image_path,
                    available_qty: Number(product.available_qty || 0),
                    price_type: salePriceType,
                    retail_price: Number(product.price || 0),
                    wholesale_price: product.wholesale_price !== null ? Number(product.wholesale_price || 0) : null,
                    unit_price: resolveProductPrice(product),
                    quantity: 1,
                },
            ];
        });
    };

    const updateCartLine = (id, patch) => {
        setCart((prev) => prev.map((line) => {
            if (line.id !== id) return line;
            const updated = { ...line, ...patch };
            updated.quantity = Math.max(1, Math.min(Number(updated.quantity || 1), Number(line.available_qty || 1)));
            updated.unit_price = Math.max(0, Number(updated.unit_price || 0));
            return updated;
        }));
    };

    const adjustCartQuantity = (id, delta) => {
        setCart((prev) => prev.map((line) => {
            if (line.id !== id) return line;
            const current = Number(line.quantity || 1);
            const max = Math.max(1, Number(line.available_qty || 1));
            return {
                ...line,
                quantity: Math.max(1, Math.min(current + delta, max)),
            };
        }));
    };

    const removeCartLine = (id) => {
        setCart((items) => items.filter((item) => item.id !== id));
    };

    const changeSalePriceType = (next) => {
        if (!next || next === salePriceType) return;
        setSalePriceType(next);
        setCart((prev) => prev.map((line) => ({
            ...line,
            price_type: next,
            unit_price: next === 'wholesale' && Number(line.wholesale_price || 0) > 0 ? Number(line.wholesale_price) : Number(line.retail_price || line.unit_price || 0),
        })));
    };

    const totals = useMemo(() => {
        const subtotal = cart.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0);
        const discountRaw = discountType === 'percent'
            ? subtotal * (Number(discountValue || 0) / 100)
            : Number(discountValue || 0);
        const discount = Math.min(Math.max(discountRaw, 0), subtotal);
        const tax = Math.max(0, subtotal - discount) * Number(taxRate || 0);
        const grandTotal = Math.max(0, subtotal - discount + tax);

        return { subtotal, discount, tax, grandTotal };
    }, [cart, discountType, discountValue, taxRate]);

    const hasStockIssue = useMemo(() => cart.some((line) => Number(line.quantity || 0) > Number(line.available_qty || 0)), [cart]);
    const hasWholesaleCartItems = useMemo(() => cart.some((line) => line.price_type === 'wholesale'), [cart]);
    const resultHeading = resultMeta.mode === 'popular' && !searchQuery.trim() ? tp('POPULAR PRODUCTS') : tp('RESULTS');
    const gridColumnCount = resultsView === 'grid' && !isSmallScreen ? 2 : 1;
    const virtualRowHeight = resultsView === 'grid' ? POS_GRID_ROW_HEIGHT : POS_TABLE_ROW_HEIGHT;
    const virtualRowCount = resultsView === 'grid'
        ? Math.ceil(searchResults.length / gridColumnCount)
        : searchResults.length;
    const virtualStartRow = Math.max(0, Math.floor(productScrollTop / virtualRowHeight) - POS_RESULT_OVERSCAN_ROWS);
    const virtualEndRow = Math.min(
        virtualRowCount,
        Math.ceil((productScrollTop + productViewportHeight) / virtualRowHeight) + POS_RESULT_OVERSCAN_ROWS,
    );
    const virtualTopSpacer = virtualStartRow * virtualRowHeight;
    const virtualBottomSpacer = Math.max(0, (virtualRowCount - virtualEndRow) * virtualRowHeight);
    const visibleTableProducts = searchResults.slice(virtualStartRow, virtualEndRow);
    const visibleGridProducts = searchResults.slice(virtualStartRow * gridColumnCount, virtualEndRow * gridColumnCount);

    const scrollCategories = (direction) => {
        categoryScrollRef.current?.scrollBy({
            left: direction * 260,
            behavior: 'smooth',
        });
    };

    const openPaymentDialog = () => {
        if (!locationId) {
            setScanError(tp('Select a warehouse before selling.'));
            if (isMobile) setMobileStep('products');
            return;
        }
        if (hasStockIssue) {
            setScanError(tp('Cart quantity exceeds available warehouse stock.'));
            if (isMobile) setMobileStep('cart');
            return;
        }
        if (cart.length) {
            if (isMobile) {
                setMobileStep('sell');
            } else {
                setPaymentDialogOpen(true);
            }
        }
    };

    const checkout = async (event) => {
        event.preventDefault();
        if (!locationId || !cart.length) return;

        setBusy(true);
        try {
            const data = await api('/admin/pos/checkout', {
                method: 'post',
                data: {
                    location_id: locationId,
                    customer_id: selectedCustomer?.id || null,
                    customer_name: selectedCustomer?.name || 'Walk-in customer',
                    customer_phone: selectedCustomer?.phone || null,
                    items: cart.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity, unit_price: item.unit_price })),
                    discount_type: discountType || null,
                    discount_value: discountValue || 0,
                    tender_type: tenderType,
                },
            });
            if (checkoutIntentRef.current === 'print' && data.receipt_url) {
                const separator = data.receipt_url.includes('?') ? '&' : '?';
                window.location.assign(`${data.receipt_url}${separator}print=1`);
                return;
            }
            setReceipt(data);
            setCart([]);
            setDiscountType('');
            setDiscountValue('');
            setSelectedCustomer(null);
            setPaymentDialogOpen(false);
            setMobileStep('products');
            setMessage(`${tp('Sale completed')}: ${data.order.receipt_number}`);
            window.setTimeout(() => searchInputRef.current?.focus(), 100);
        } finally {
            checkoutIntentRef.current = 'complete';
            setBusy(false);
        }
    };

    const paymentFormContent = (
        <Stack spacing={1.5}>
            <Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 1, alignItems: 'center' }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{tp('Customer')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>{selectedCustomer?.name || tp('Walk-in customer')}</Typography>
                    </Box>
                </Stack>
                <Autocomplete
                    size="small"
                    fullWidth
                    options={customerOptions}
                    value={selectedCustomer}
                    onChange={(event, value) => setSelectedCustomer(value)}
                    inputValue={customerSearchInput}
                    onInputChange={(event, value) => setCustomerSearchInput(value || '')}
                    getOptionLabel={(option) => option?.name || ''}
                    renderOption={(props, option) => (
                        <li {...props} key={option.id || option.email || option.name}>
                            <Stack>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>{option.name}</Typography>
                                <Typography variant="caption" color="text.secondary">{[option.phone, option.email].filter(Boolean).join(' / ') || tp('No contact')}</Typography>
                            </Stack>
                        </li>
                    )}
                    loading={customerLoading}
                    isOptionEqualToValue={(option, value) => option?.id === value?.id && option?.name === value?.name}
                    renderInput={(params) => <TextField {...params} placeholder={tp('Search customer by name, phone, or email...')} size="small" />}
                />
            </Box>

            {can.discount && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                        select
                        size="small"
                        label={tp('Discount')}
                        value={discountType}
                        onChange={(event) => setDiscountType(event.target.value)}
                        sx={{ flex: 1 }}
                    >
                        <MenuItem value="">{tp('No discount')}</MenuItem>
                        <MenuItem value="amount">{tp('Amount')}</MenuItem>
                        <MenuItem value="percent">{tp('Percent')}</MenuItem>
                    </TextField>
                    <TextField
                        size="small"
                        type="number"
                        label={tp('Value')}
                        value={discountValue}
                        disabled={!discountType}
                        onChange={(event) => setDiscountValue(event.target.value)}
                        slotProps={{ htmlInput: { min: 0, step: '0.01' } }}
                        sx={{ flex: 1 }}
                    />
                </Stack>
            )}

            <Box sx={{ p: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}>
                <Stack spacing={0.85}>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">{tp('Subtotal')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>{currencySymbol}{money(totals.subtotal)}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">{tp('Discount')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: totals.discount > 0 ? 'success.main' : 'inherit', textAlign: 'right' }}>-{currencySymbol}{money(totals.discount)}</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">{tp('Tax')}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, textAlign: 'right' }}>{currencySymbol}{money(totals.tax)}</Typography>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'baseline', gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{tp('Sale total')}</Typography>
                        <Typography variant="h5" sx={{ fontWeight: 800, color: 'primary.main', textAlign: 'right' }}>{currencySymbol}{money(totals.grandTotal)}</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                        {tp('Stock will be deducted from')} {location?.name || tp('selected warehouse')}.
                    </Typography>
                </Stack>
            </Box>

            <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>{tp('Payment Method')}</Typography>
                <ToggleButtonGroup
                    size="small"
                    exclusive
                    fullWidth
                    value={tenderType}
                    onChange={(event, next) => next && setTenderType(next)}
                >
                    {paymentMethods.map((method) => (
                        <ToggleButton key={method} value={method} sx={{ flex: 1, textTransform: 'none' }}>{tp(method)}</ToggleButton>
                    ))}
                </ToggleButtonGroup>
            </Box>
        </Stack>
    );

    const completeSaleButtons = (
        <>
            <Button
                type="submit"
                variant="outlined"
                startIcon={<PrintIcon />}
                disabled={busy || cart.length === 0 || !locationId || hasStockIssue}
                onClick={() => {
                    checkoutIntentRef.current = 'print';
                }}
                sx={{
                    width: { xs: '100%', sm: 'auto' },
                    minWidth: 0,
                    minHeight: { xs: 48, sm: 36 },
                    px: { xs: 1, sm: 2 },
                    whiteSpace: 'normal',
                    lineHeight: 1.2,
                    '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
                }}
            >
                {tp('Complete & Print')}
            </Button>
            <Button
                type="submit"
                variant="contained"
                startIcon={<CheckoutIcon />}
                disabled={busy || cart.length === 0 || !locationId || hasStockIssue}
                onClick={() => {
                    checkoutIntentRef.current = 'complete';
                }}
                sx={{
                    width: { xs: '100%', sm: 'auto' },
                    minWidth: 0,
                    minHeight: { xs: 48, sm: 36 },
                    px: { xs: 1, sm: 2 },
                    whiteSpace: 'normal',
                    lineHeight: 1.2,
                    '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
                }}
            >
                {tp('Complete Sale')}
            </Button>
        </>
    );

    return (
        <Box
            sx={{
                minHeight: '100vh',
                background: (theme) => `
                    radial-gradient(circle at 12% 0%, ${alpha(theme.palette.primary.main, 0.16)} 0, transparent 28%),
                    linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.9)} 0%, ${alpha(theme.palette.primary.main, 0.07)} 48%, ${theme.palette.background.paper} 100%)
                `,
                display: 'flex',
                flexDirection: 'column',
                overflow: { xs: 'auto', md: 'hidden' },
            }}
        >
            <Head title={tp('POS')} />

            <Box
                component="header"
                sx={{
                    minHeight: 52,
                    px: { xs: 1.5, md: 2 },
                    py: 0.75,
                    bgcolor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    flexWrap: 'wrap',
                    flexShrink: 0,
                }}
            >
                <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                    <CheckoutIcon color="primary" fontSize="small" />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                            {tp('POS Interface')}
                        </Typography>
                    </Box>
                </Stack>
                <TextField
                    select
                    size="small"
                    label={tp('Warehouse')}
                    value={locationId}
                    onChange={(event) => setLocationId(event.target.value)}
                    sx={{ width: { xs: '100%', sm: 220 }, maxWidth: '100%' }}
                >
                    {locations.map((item) => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
                </TextField>
                <Box sx={{ flex: 1 }} />
                <Chip size="small" color={isOnline ? 'success' : 'error'} label={isOnline ? tp('Online') : tp('Offline')} variant="outlined" />
                <LanguageSwitcher compact className="pos-language-switcher" />
                <Button size="small" variant="text" component={Link} href={routeWithBase('/admin/dashboard', app_base)}>
                    {t('admin.items.dashboard', 'Dashboard')}
                </Button>
            </Box>

            <Box
                component="main"
                sx={{
                    flex: 1,
                    minHeight: 0,
                    p: { xs: 1, md: 1.25 },
                    overflow: { xs: 'visible', md: 'hidden' },
                    '& .MuiPaper-root': { borderRadius: 1, boxShadow: 'none' },
                }}
            >
                {(flash?.success || flash?.error || message || Object.keys(errors).length > 0 || Object.keys(pageErrors).length > 0) && (
                    <Stack spacing={1} sx={{ mb: 2 }}>
                        {flash?.success && <Alert severity="success">{flash.success}</Alert>}
                        {flash?.error && <Alert severity="error">{flash.error}</Alert>}
                        {message && <Alert severity="success" onClose={() => setMessage('')}>{message}</Alert>}
                        {Object.entries({ ...pageErrors, ...errors }).map(([key, value]) => (
                            <Alert severity="error" key={key}>
                                {Array.isArray(value) ? value.join(' ') : value}
                            </Alert>
                        ))}
                    </Stack>
                )}

                <Paper
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        mb: 1,
                        p: 0.75,
                        border: '1px solid',
                        borderColor: 'divider',
                        bgcolor: 'background.paper',
                    }}
                >
                    <ToggleButtonGroup
                        fullWidth
                        exclusive
                        size="small"
                        value={mobileStep}
                        onChange={(event, next) => next && setMobileStep(next)}
                    >
                        <ToggleButton value="products" sx={{ textTransform: 'none', fontWeight: 800 }}>
                            {tp('Products')}
                        </ToggleButton>
                        <ToggleButton value="cart" sx={{ textTransform: 'none', fontWeight: 800 }}>
                            {tp('Cart')} ({cart.length})
                        </ToggleButton>
                        <ToggleButton value="sell" disabled={cart.length === 0} sx={{ textTransform: 'none', fontWeight: 800 }}>
                            {tp('Sell')}
                        </ToggleButton>
                    </ToggleButtonGroup>
                </Paper>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(420px, 0.9fr)' },
                        gap: 1.25,
                        alignItems: 'stretch',
                        height: {
                            xs: 'auto',
                            md: (flash?.success || flash?.error || message || Object.keys(errors).length > 0 || Object.keys(pageErrors).length > 0)
                                ? 'calc(100% - 56px)'
                                : '100%',
                        },
                        minHeight: 0,
                    }}
                >
                    <Paper sx={{ p: { xs: 1.25, md: 1.35 }, width: '100%', height: { xs: 'auto', md: '100%' }, display: { xs: mobileStep === 'products' ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', borderTop: '2px solid', borderTopColor: 'primary.main' }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                            <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                                <ScanIcon color="primary" fontSize="small" />
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {tp('Product Selection')}
                                </Typography>
                            </Stack>
                            <Box sx={{ flex: 1 }} />
                            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                                <ToggleButtonGroup
                                    size="small"
                                    exclusive
                                    value={salePriceType}
                                    onChange={(event, next) => changeSalePriceType(next)}
                                >
                                    <ToggleButton value="retail" sx={{ textTransform: 'none' }}>{tp('Retail')}</ToggleButton>
                                    <ToggleButton value="wholesale" sx={{ textTransform: 'none' }}>{tp('Wholesale')}</ToggleButton>
                                </ToggleButtonGroup>
                            </Stack>
                            <ToggleButtonGroup
                                size="small"
                                exclusive
                                value={resultsView}
                                onChange={(event, next) => next && setResultsView(next)}
                            >
                                <ToggleButton value="table" title={tp('List view')}>
                                    <ListViewIcon fontSize="small" />
                                </ToggleButton>
                                <ToggleButton value="grid" title={tp('Grid view')}>
                                    <GridViewIcon fontSize="small" />
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Stack>

                        {scanError && (
                            <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setScanError('')}>
                                {scanError}
                            </Alert>
                        )}

                        <Stack direction="row" spacing={1}>
                            <TextField
                                fullWidth
                                size="small"
                                inputRef={searchInputRef}
                                placeholder={tp('Scan barcode or search product...')}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        fetchSearch({ autoAddFirst: true, clearInputAfterSearch: true });
                                    }
                                }}
                                slotProps={{
                                    input: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon fontSize="small" />
                                            </InputAdornment>
                                        ),
                                    },
                                    htmlInput: { enterKeyHint: 'search' },
                                }}
                            />
                            <Button variant="contained" size="small" onClick={() => fetchSearch()} disabled={searchLoading} sx={{ minWidth: 110 }}>
                                {tp('Search')}
                            </Button>
                        </Stack>

                        <Stack
                            direction="row"
                            spacing={0.5}
                            sx={{
                                mt: 1.25,
                                mb: 0.35,
                                alignItems: 'center',
                            }}
                        >
                            <IconButton
                                size="small"
                                aria-label={tp('Scroll categories left')}
                                onClick={() => scrollCategories(-1)}
                                sx={{
                                    width: 30,
                                    height: 34,
                                    flexShrink: 0,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                }}
                            >
                                <ChevronLeftIcon fontSize="small" />
                            </IconButton>
                            <Box
                                ref={categoryScrollRef}
                                sx={{
                                    flex: 1,
                                    minWidth: 0,
                                    px: 0.5,
                                    pt: 0.35,
                                    pb: 0.9,
                                    overflowX: 'auto',
                                    overflowY: 'hidden',
                                    scrollbarWidth: 'none',
                                    msOverflowStyle: 'none',
                                    '&::-webkit-scrollbar': { display: 'none' },
                                }}
                            >
                                <RadioGroup
                                    row
                                    value={String(categoryId)}
                                    onChange={(event) => setCategoryId(event.target.value)}
                                    sx={{
                                        flexWrap: 'nowrap',
                                        gap: 0.85,
                                        minWidth: 'max-content',
                                        width: 'max-content',
                                        '& .MuiFormControlLabel-root': {
                                            mr: 0,
                                            ml: 0,
                                            px: 1,
                                            pr: 1.25,
                                            height: 34,
                                            minWidth: 'fit-content',
                                            flexShrink: 0,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            bgcolor: 'background.paper',
                                            borderRadius: 1,
                                        },
                                        '& .MuiFormControlLabel-root:has(.Mui-checked)': {
                                            borderColor: 'primary.main',
                                            bgcolor: 'rgba(10, 23, 91, 0.06)',
                                        },
                                        '& .MuiFormControlLabel-label': {
                                            fontSize: 13,
                                            fontWeight: 700,
                                            whiteSpace: 'nowrap',
                                        },
                                        '& .MuiRadio-root': {
                                            p: 0.25,
                                            mr: 0.25,
                                        },
                                    }}
                                >
                                    <FormControlLabel value="" control={<Radio size="small" />} label={tp('All')} />
                                    {categories.map((item) => (
                                        <FormControlLabel key={item.id} value={String(item.id)} control={<Radio size="small" />} label={item.name} />
                                    ))}
                                </RadioGroup>
                            </Box>
                            <IconButton
                                size="small"
                                aria-label={tp('Scroll categories right')}
                                onClick={() => scrollCategories(1)}
                                sx={{
                                    width: 30,
                                    height: 34,
                                    flexShrink: 0,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    bgcolor: 'background.paper',
                                }}
                            >
                                <ChevronRightIcon fontSize="small" />
                            </IconButton>
                        </Stack>

                        {cart.length > 0 && (
                            <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 0.75 }}>
                                <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75, alignItems: 'center' }}>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary' }}>
                                        {tp('Selected products')}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                        {cart.length} {cart.length === 1 ? tp('item') : tp('items')}
                                    </Typography>
                                </Stack>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        gap: 1,
                                        overflowX: 'auto',
                                        overflowY: 'hidden',
                                        pb: 0.75,
                                        scrollbarWidth: 'none',
                                        msOverflowStyle: 'none',
                                        '&::-webkit-scrollbar': { display: 'none' },
                                    }}
                                >
                                    {cart.map((line) => {
                                        const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);

                                        return (
                                            <Box
                                                key={line.id}
                                                sx={{
                                                    width: 176,
                                                    minWidth: 176,
                                                    display: 'grid',
                                                    gridTemplateColumns: '48px minmax(0, 1fr) 28px',
                                                    gap: 0.75,
                                                    alignItems: 'center',
                                                    p: 0.75,
                                                    border: '1px solid',
                                                    borderColor: 'divider',
                                                    bgcolor: 'background.paper',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 48,
                                                        height: 48,
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        bgcolor: 'action.hover',
                                                        overflow: 'hidden',
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    {line.image_path ? (
                                                        <Box component="img" src={storageUrl(line.image_path, app_url)} alt="" loading="lazy" decoding="async" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, fontWeight: 800, textAlign: 'center', px: 0.25 }}>
                                                            {line.sku_code || tp('No image')}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="caption" title={line.name} sx={{ display: 'block', fontWeight: 800, lineHeight: 1.12 }} noWrap>
                                                        {line.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                                                        x{line.quantity} - {currencySymbol}{money(lineTotal)}
                                                    </Typography>
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    aria-label={`${tp('Remove item')} ${line.name}`}
                                                    onClick={() => removeCartLine(line.id)}
                                                    sx={{ width: 28, height: 28, alignSelf: 'start' }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>
                        )}

                        <Divider sx={{ my: 1.25 }} />

                        <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                                {resultHeading}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {searchLoading && searchResults.length === 0 ? tp('Loading...') : `${searchResults.length} ${tp('shown')}`}
                            </Typography>
                        </Stack>

                        {resultsView === 'table' ? (
                            <TableContainer ref={setProductResultsElement} sx={{ mt: 1, flex: 1, minHeight: 0, overflow: 'auto' }}>
                                <Table
                                    size="small"
                                    stickyHeader
                                    sx={{
                                        tableLayout: 'fixed',
                                        '& .MuiTableCell-root': { px: 0.75, py: 0.55 },
                                        '& .MuiTableCell-head': { py: 0.55, fontSize: 12 },
                                    }}
                                >
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'light' ? 'grey.50' : 'rgba(255,255,255,.05)' }}>
                                            <TableCell sx={{ fontWeight: 700, width: '47%' }}>{tp('Product')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: '28%' }}>{tp('SKU / Barcode')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: '13%' }} align="right">{tp('Stock')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: '12%' }} align="center">{tp('Add')}</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {virtualTopSpacer > 0 && (
                                            <TableRow aria-hidden="true">
                                                <TableCell colSpan={4} sx={{ p: 0, height: virtualTopSpacer, border: 0 }} />
                                            </TableRow>
                                        )}
                                        {visibleTableProducts.map((product) => {
                                            const outOfStock = Number(product.available_qty || 0) <= 0;
                                            return (
                                                <TableRow key={product.id} hover sx={outOfStock ? { bgcolor: 'rgba(211, 47, 47, 0.08)' } : undefined}>
                                                    <TableCell>
                                                        <Stack direction="row" spacing={1} sx={{ minWidth: 0, alignItems: 'center' }}>
                                                            <Box
                                                                sx={{
                                                                    width: 36,
                                                                    height: 36,
                                                                    flexShrink: 0,
                                                                    border: '1px solid',
                                                                    borderColor: 'divider',
                                                                    bgcolor: 'action.hover',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    overflow: 'hidden',
                                                                }}
                                                            >
                                                                {product.image_path ? (
                                                                    <Box component="img" src={storageUrl(product.image_path, app_url)} alt="" loading="lazy" decoding="async" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                ) : (
                                                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9, fontWeight: 700 }}>{tp('No image')}</Typography>
                                                                )}
                                                            </Box>
                                                            <Box sx={{ minWidth: 0 }}>
                                                                <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.15 }} noWrap title={getProductDisplayName(product)}>{getProductDisplayName(product)}</Typography>
                                                                <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>{currencySymbol}{money(resolveProductPrice(product))}</Typography>
                                                            </Box>
                                                        </Stack>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography variant="caption" color="text.secondary">{product.sku_code || '-'}</Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{product.barcode || '-'}</Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Typography variant="body2" sx={{ fontWeight: 700, color: outOfStock ? 'error.main' : 'inherit' }}>{product.available_qty}</Typography>
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <IconButton size="small" color={outOfStock ? 'error' : 'primary'} disabled={outOfStock} onClick={() => addProductToCart(product)} sx={{ width: 30, height: 30 }}>
                                                            <AddIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {virtualBottomSpacer > 0 && (
                                            <TableRow aria-hidden="true">
                                                <TableCell colSpan={4} sx={{ p: 0, height: virtualBottomSpacer, border: 0 }} />
                                            </TableRow>
                                        )}
                                        {searchResults.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={4} align="center" sx={{ py: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">{tp('Search products or scan a barcode to add items.')}</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Box ref={setProductResultsElement} sx={{ mt: 1, flex: 1, minHeight: 0, overflow: 'auto', display: 'grid', alignContent: 'start', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1, pr: 0.5 }}>
                                {virtualTopSpacer > 0 && (
                                    <Box aria-hidden="true" sx={{ height: virtualTopSpacer, gridColumn: '1 / -1' }} />
                                )}
                                {visibleGridProducts.map((product) => {
                                    const outOfStock = Number(product.available_qty || 0) <= 0;
                                    return (
                                        <Card
                                            key={product.id}
                                            variant="outlined"
                                            sx={{
                                                overflow: 'hidden',
                                                borderColor: outOfStock ? 'error.main' : undefined,
                                                bgcolor: outOfStock ? 'rgba(211, 47, 47, 0.08)' : 'background.paper',
                                            }}
                                        >
                                            <CardActionArea
                                                onClick={() => addProductToCart(product)}
                                                disabled={outOfStock}
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: { xs: '76px minmax(0, 1fr)', sm: '86px minmax(0, 1fr)', xl: '96px minmax(0, 1fr)' },
                                                    minHeight: { xs: 108, sm: 116, xl: 126 },
                                                    alignItems: 'stretch',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        bgcolor: 'action.hover',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        p: 0.5,
                                                        overflow: 'hidden',
                                                        borderRight: '1px solid',
                                                        borderColor: 'divider',
                                                    }}
                                                >
                                                    {product.image_path ? (
                                                        <Box
                                                            component="img"
                                                            src={storageUrl(product.image_path, app_url)}
                                                            alt=""
                                                            loading="lazy"
                                                            decoding="async"
                                                            sx={{
                                                                width: '100%',
                                                                height: '100%',
                                                                aspectRatio: '3 / 4',
                                                                objectFit: 'contain',
                                                            }}
                                                        />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary" align="center" sx={{ px: 0.5, fontWeight: 700, wordBreak: 'break-word' }}>
                                                            {product.sku_code || tp('No image')}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <CardContent
                                                    sx={{
                                                        minWidth: 0,
                                                        p: 1,
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        justifyContent: 'center',
                                                        '&:last-child': { pb: 1 },
                                                    }}
                                                >
                                                    <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.18 }} noWrap title={getProductDisplayName(product)}>
                                                        {getProductDisplayName(product)}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.15, mt: 0.35 }} noWrap>
                                                        {product.sku_code || product.barcode || '-'}
                                                    </Typography>
                                                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.8, alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="caption" color="text.secondary">{tp('Each')}</Typography>
                                                        <Typography variant="body2" sx={{ fontWeight: 900 }} noWrap>{currencySymbol}{money(resolveProductPrice(product))}</Typography>
                                                    </Stack>
                                                    <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.35, alignItems: 'center', gap: 1 }}>
                                                        <Typography variant="caption" color="text.secondary">{tp('Stock')}</Typography>
                                                        {outOfStock ? (
                                                            <Chip size="small" color="error" label={tp('Out of stock')} sx={{ height: 20, '& .MuiChip-label': { px: 0.75, fontSize: '0.68rem', fontWeight: 600 } }} />
                                                        ) : (
                                                            <Typography variant="caption" sx={{ fontWeight: 700 }}>{product.available_qty}</Typography>
                                                        )}
                                                    </Stack>
                                                </CardContent>
                                            </CardActionArea>
                                        </Card>
                                    );
                                })}
                                {virtualBottomSpacer > 0 && (
                                    <Box aria-hidden="true" sx={{ height: virtualBottomSpacer, gridColumn: '1 / -1' }} />
                                )}
                                {searchResults.length === 0 && (
                                    <Paper variant="outlined" sx={{ p: 2, gridColumn: '1 / -1' }}>
                                        <Typography variant="body2" color="text.secondary" align="center">{tp('Search products or scan a barcode to add items.')}</Typography>
                                    </Paper>
                                )}
                            </Box>
                        )}

                        {resultMeta.has_more && (
                            <Box sx={{ pt: 1.25, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={() => fetchSearch({ append: true, page: resultMeta.next_page || resultMeta.page + 1 })}
                                    disabled={searchLoading}
                                >
                                    {tp('Load more products')}
                                </Button>
                            </Box>
                        )}

                        <Box sx={{ display: { xs: 'grid', md: 'none' }, gridTemplateColumns: '1fr auto', gap: 1, pt: 1.25, flexShrink: 0 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
                                {cart.length} {cart.length === 1 ? tp('item') : tp('items')} - {currencySymbol}{money(totals.grandTotal)}
                            </Typography>
                            <Button variant="contained" size="small" disabled={cart.length === 0} onClick={() => setMobileStep('cart')}>
                                {tp('Next: Cart')}
                            </Button>
                        </Box>
                    </Paper>

                    <Paper sx={{ p: { xs: 1.15, md: 1.25 }, width: '100%', height: { xs: 'auto', md: '100%' }, display: { xs: mobileStep === 'cart' ? 'flex' : 'none', md: 'flex' }, flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden', borderTop: '2px solid', borderTopColor: 'success.main' }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', columnGap: 1, width: '100%' }}>
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{tp('Current Sale')}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                    {cart.length} {cart.length === 1 ? tp('item') : tp('items')} {tp('from')} {location?.name || tp('warehouse')}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1} sx={{ justifySelf: 'end', flexShrink: 0, alignItems: 'center' }}>
                                {hasWholesaleCartItems && (
                                    <Chip size="small" color="warning" variant="outlined" label={tp('Wholesale pricing')} />
                                )}
                                <Button
                                    variant="contained"
                                    size="small"
                                    startIcon={<CheckoutIcon />}
                                    disabled={busy || !isOnline || !locationId || cart.length === 0 || hasStockIssue}
                                    onClick={openPaymentDialog}
                                    sx={{ minWidth: 128, fontWeight: 800 }}
                                >
                                    {tp('Sell')} {currencySymbol}{money(totals.grandTotal)}
                                </Button>
                            </Stack>
                        </Box>

                        <Divider sx={{ my: 1 }} />

                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{tp('Cart')}</Typography>

                        {isMobile ? (
                            <Stack spacing={0.85} sx={{ flex: 1, minHeight: 140, overflow: 'visible' }}>
                                {cart.map((line) => {
                                    const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
                                    const exceedsStock = Number(line.quantity || 0) > Number(line.available_qty || 0);

                                    return (
                                        <Paper
                                            key={line.id}
                                            variant="outlined"
                                            sx={{
                                                p: 0.85,
                                                borderColor: exceedsStock ? 'error.main' : 'divider',
                                                bgcolor: exceedsStock ? 'rgba(211, 47, 47, 0.08)' : 'background.paper',
                                            }}
                                        >
                                            <Stack direction="row" spacing={0.85} sx={{ alignItems: 'center', minWidth: 0 }}>
                                                <Box
                                                    sx={{
                                                        width: 48,
                                                        height: 48,
                                                        flexShrink: 0,
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        bgcolor: 'action.hover',
                                                        border: '1px solid',
                                                        borderColor: 'divider',
                                                        overflow: 'hidden',
                                                    }}
                                                >
                                                    {line.image_path ? (
                                                        <Box component="img" src={storageUrl(line.image_path, app_url)} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <Typography variant="caption" color="text.secondary" sx={{ px: 0.25, fontSize: 9, fontWeight: 800, textAlign: 'center' }}>
                                                            {line.sku_code || tp('No image')}
                                                        </Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography variant="body2" title={line.name} sx={{ fontWeight: 800, lineHeight: 1.12 }} noWrap>
                                                        {line.name}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }} noWrap>
                                                        {line.sku_code || line.barcode || '-'} - {tp('Max')} {line.available_qty}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                                                        {tp('Price')}: {currencySymbol}{money(line.unit_price)}
                                                    </Typography>
                                                </Box>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    aria-label={`${tp('Remove item')} ${line.name}`}
                                                    onClick={() => removeCartLine(line.id)}
                                                    sx={{ width: 34, height: 34, flexShrink: 0 }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Stack>

                                            <Box
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                                    alignItems: 'center',
                                                    columnGap: 1,
                                                    mt: 0.85,
                                                }}
                                            >
                                                <Box>
                                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1 }}>
                                                        {tp('Total')}
                                                    </Typography>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 900, lineHeight: 1.25 }}>
                                                        {currencySymbol}{money(lineTotal)}
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        display: 'grid',
                                                        gridTemplateColumns: '34px 44px 34px',
                                                        alignItems: 'center',
                                                        height: 34,
                                                        border: '1px solid',
                                                        borderColor: exceedsStock ? 'error.main' : 'divider',
                                                        bgcolor: 'background.paper',
                                                    }}
                                                >
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`${tp('Decrease quantity for')} ${line.name}`}
                                                        disabled={Number(line.quantity || 1) <= 1}
                                                        onClick={() => adjustCartQuantity(line.id, -1)}
                                                        sx={{ width: 34, height: 32, borderRadius: 0 }}
                                                    >
                                                        <RemoveIcon fontSize="small" />
                                                    </IconButton>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{
                                                            fontWeight: 900,
                                                            textAlign: 'center',
                                                            lineHeight: '32px',
                                                            borderLeft: '1px solid',
                                                            borderRight: '1px solid',
                                                            borderColor: 'divider',
                                                        }}
                                                    >
                                                        {line.quantity}
                                                    </Typography>
                                                    <IconButton
                                                        size="small"
                                                        aria-label={`${tp('Increase quantity for')} ${line.name}`}
                                                        disabled={Number(line.quantity || 1) >= Number(line.available_qty || 0)}
                                                        onClick={() => adjustCartQuantity(line.id, 1)}
                                                        sx={{ width: 34, height: 32, borderRadius: 0 }}
                                                    >
                                                        <AddIcon fontSize="small" />
                                                    </IconButton>
                                                </Box>
                                            </Box>
                                        </Paper>
                                    );
                                })}
                                {cart.length === 0 && (
                                    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                                        <Typography variant="body2" color="text.secondary" align="center">{tp('Cart is empty.')}</Typography>
                                    </Paper>
                                )}
                            </Stack>
                        ) : (
                            <TableContainer sx={{ flex: 1, minHeight: 180, overflow: 'auto' }}>
                                <Table
                                    size="small"
                                    stickyHeader
                                    sx={{
                                        tableLayout: 'fixed',
                                        minWidth: 0,
                                        '& .MuiTableCell-root': { px: 0.75, py: 0.7, verticalAlign: 'middle' },
                                        '& .MuiTableCell-head': { py: 0.65, fontSize: 12, letterSpacing: '0.04em' },
                                        '& .MuiInputBase-root': { height: 34, fontSize: 13 },
                                        '& .MuiInputBase-input': { px: 0.75, py: 0.5 },
                                    }}
                                >
                                    <TableHead>
                                        <TableRow sx={{ bgcolor: (theme) => theme.palette.mode === 'light' ? 'grey.50' : 'rgba(255,255,255,.05)' }}>
                                            <TableCell sx={{ fontWeight: 700, width: '36%' }}>{tp('Item')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: '16%' }}>{tp('Price')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: '24%' }} align="center">{tp('Qty')}</TableCell>
                                            <TableCell sx={{ fontWeight: 700, width: '16%' }} align="right">{tp('Total')}</TableCell>
                                            <TableCell sx={{ width: '8%' }} />
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {cart.map((line) => {
                                            const lineTotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
                                            const exceedsStock = Number(line.quantity || 0) > Number(line.available_qty || 0);
                                            return (
                                                <TableRow key={line.id} hover>
                                                    <TableCell>
                                                        <Typography variant="body2" title={line.name} sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>{line.name}</Typography>
                                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }} noWrap>
                                                            {line.sku_code || line.barcode || '-'} - {tp('Max')} {line.available_qty}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                                                        {currencySymbol}{money(line.unit_price)}
                                                    </TableCell>
                                                    <TableCell align="center">
                                                        <Box
                                                            sx={{
                                                                display: 'grid',
                                                                gridTemplateColumns: '30px minmax(32px, 1fr) 30px',
                                                                alignItems: 'center',
                                                                width: '100%',
                                                                maxWidth: 116,
                                                                height: 34,
                                                                mx: 'auto',
                                                                border: '1px solid',
                                                                borderColor: exceedsStock ? 'error.main' : 'divider',
                                                                bgcolor: 'background.paper',
                                                            }}
                                                        >
                                                            <IconButton
                                                                size="small"
                                                                aria-label={`${tp('Decrease quantity for')} ${line.name}`}
                                                                disabled={Number(line.quantity || 1) <= 1}
                                                                onClick={() => adjustCartQuantity(line.id, -1)}
                                                                sx={{ width: 30, height: 32, borderRadius: 0 }}
                                                            >
                                                                <RemoveIcon fontSize="small" />
                                                            </IconButton>
                                                            <Typography variant="body2" sx={{ fontWeight: 800, textAlign: 'center', lineHeight: '32px', borderLeft: '1px solid', borderRight: '1px solid', borderColor: 'divider' }}>
                                                                {line.quantity}
                                                            </Typography>
                                                            <IconButton
                                                                size="small"
                                                                aria-label={`${tp('Increase quantity for')} ${line.name}`}
                                                                disabled={Number(line.quantity || 1) >= Number(line.available_qty || 0)}
                                                                onClick={() => adjustCartQuantity(line.id, 1)}
                                                                sx={{ width: 30, height: 32, borderRadius: 0 }}
                                                            >
                                                                <AddIcon fontSize="small" />
                                                            </IconButton>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>{currencySymbol}{money(lineTotal)}</TableCell>
                                                    <TableCell align="right">
                                                        <IconButton size="small" color="error" onClick={() => removeCartLine(line.id)} sx={{ p: 0.25 }}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {cart.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} align="center" sx={{ py: 2 }}>
                                                    <Typography variant="body2" color="text.secondary">{tp('Cart is empty.')}</Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}

                        <Stack direction="row" spacing={1} sx={{ display: { xs: 'flex', md: 'none' }, pt: 1.25, flexShrink: 0 }}>
                            <Button variant="outlined" size="small" fullWidth onClick={() => setMobileStep('products')}>
                                {tp('Back')}
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                fullWidth
                                disabled={busy || !isOnline || !locationId || cart.length === 0 || hasStockIssue}
                                onClick={openPaymentDialog}
                            >
                                {tp('Next: Sell')} {currencySymbol}{money(totals.grandTotal)}
                            </Button>
                        </Stack>
                    </Paper>

                    <Paper
                        component="form"
                        onSubmit={checkout}
                        sx={{
                            p: 1.25,
                            width: '100%',
                            display: { xs: mobileStep === 'sell' ? 'flex' : 'none', md: 'none' },
                            flexDirection: 'column',
                            gap: 1.25,
                            borderTop: '2px solid',
                            borderTopColor: 'warning.main',
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ alignItems: 'center' }}>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{tp('Final Sell')}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {cart.length} {cart.length === 1 ? tp('item') : tp('items')} - {location?.name || tp('warehouse')}
                                </Typography>
                            </Box>
                            <Chip size="small" color="primary" label={`${currencySymbol}${money(totals.grandTotal)}`} />
                        </Stack>

                        {paymentFormContent}

                        <Stack spacing={1} sx={{ pt: 0.5, width: '100%', minWidth: 0 }}>
                            <Button
                                type="button"
                                variant="outlined"
                                fullWidth
                                onClick={() => setMobileStep('cart')}
                                disabled={busy}
                                sx={{ minHeight: 46, fontWeight: 800 }}
                            >
                                {tp('Back')}
                            </Button>
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                                    gap: 1,
                                    width: '100%',
                                    minWidth: 0,
                                    '& .MuiButton-root': {
                                        fontWeight: 800,
                                        overflow: 'hidden',
                                        textAlign: 'center',
                                    },
                                }}
                            >
                                {completeSaleButtons}
                            </Box>
                        </Stack>
                    </Paper>
                </Box>
            </Box>

            <Dialog open={paymentDialogOpen} onClose={() => !busy && setPaymentDialogOpen(false)} maxWidth="sm" fullWidth>
                <Box component="form" onSubmit={checkout}>
                    <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {tp('Complete Sale')}
                        <IconButton size="small" onClick={() => setPaymentDialogOpen(false)} disabled={busy}>
                            <CloseIcon />
                        </IconButton>
                    </DialogTitle>
                    <DialogContent dividers>
                        {paymentFormContent}
                    </DialogContent>
                    <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <Button type="button" onClick={() => setPaymentDialogOpen(false)} disabled={busy}>{tp('Cancel')}</Button>
                        {completeSaleButtons}
                    </DialogActions>
                </Box>
            </Dialog>

            <Dialog open={Boolean(receipt)} onClose={() => setReceipt(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {tp('Sale complete')}
                    <IconButton size="small" onClick={() => setReceipt(null)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={1}>
                        <Typography variant="h6" sx={{ fontWeight: 800 }}>{receipt?.order?.receipt_number}</Typography>
                        <Typography variant="body2" color="text.secondary">
                            {tp('Total')} {currencySymbol}{money(receipt?.order?.final_amount)}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    {receipt?.receipt_url && <Button variant="contained" component="a" href={receipt.receipt_url}>{tp('Open receipt')}</Button>}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
