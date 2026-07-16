import { useMemo, useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const emptyForm = {
    name: '',
    starts_at: '',
    ends_at: '',
    is_active: true,
    items: [],
};

const steps = [
    { key: 'basic', label: 'Basic' },
    { key: 'products', label: 'Products' },
    { key: 'pricing', label: 'Sale data' },
    { key: 'review', label: 'Review' },
];

const toDateTimeInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const skuLabel = (sku) => {
    const attrs = sku?.attributes || {};
    const attrText = Object.entries(attrs).map(([key, value]) => `${key}: ${value}`).join(' / ');
    return [sku?.sku_code, sku?.title, attrText].filter(Boolean).join(' - ') || 'Default SKU';
};

const buildInitialData = (flashSale) => {
    if (!flashSale) return { ...emptyForm };

    return {
        name: flashSale.name || '',
        starts_at: toDateTimeInput(flashSale.starts_at),
        ends_at: toDateTimeInput(flashSale.ends_at),
        is_active: Boolean(flashSale.is_active),
        items: (flashSale.items || []).map((item) => ({
            sku_id: item.sku_id,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            quantity_limit: item.quantity_limit ?? '',
        })),
    };
};

const salePriceFor = (sku, item) => {
    if (!sku || !item?.discount_value) return null;
    const original = Number(sku.price || 0);
    const value = Number(item.discount_value || 0);
    const price = item.discount_type === 'percentage' ? original * (1 - value / 100) : value;

    return Math.max(0.01, Math.min(original, price));
};

const formatDateTime = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const campaignDuration = (startsAt, endsAt) => {
    if (!startsAt || !endsAt) return '-';
    const diffMs = new Date(endsAt).getTime() - new Date(startsAt).getTime();
    if (!Number.isFinite(diffMs) || diffMs <= 0) return '-';

    const totalMinutes = Math.round(diffMs / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    const parts = [];

    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes || parts.length === 0) parts.push(`${minutes}m`);

    return parts.join(' ');
};

function Stat({ label, value }) {
    return (
        <div className="metric-card" style={{ padding: 12 }}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

export default function FlashSaleForm({ productOptions, flashSale = null, mode = 'create' }) {
    const { app_base, flash } = usePage().props;
    const [tab, setTab] = useState(0);
    const [productSearch, setProductSearch] = useState('');
    const form = useForm(buildInitialData(flashSale));

    const skuMap = useMemo(() => {
        const map = new Map();
        productOptions.forEach((product) => {
            product.skus.forEach((sku) => {
                map.set(Number(sku.id), { ...sku, product });
            });
        });
        return map;
    }, [productOptions]);

    const selectedSkuIds = useMemo(
        () => new Set(form.data.items.map((item) => Number(item.sku_id)).filter(Boolean)),
        [form.data.items],
    );

    const selectedProductIds = useMemo(() => {
        const ids = new Set();
        selectedSkuIds.forEach((skuId) => {
            const sku = skuMap.get(Number(skuId));
            if (sku?.product?.id) ids.add(Number(sku.product.id));
        });
        return ids;
    }, [selectedSkuIds, skuMap]);

    const selectedProducts = useMemo(
        () => productOptions.filter((product) => selectedProductIds.has(Number(product.id))),
        [productOptions, selectedProductIds],
    );

    const selectedItems = useMemo(
        () => form.data.items
            .map((item, index) => ({ item, index, sku: skuMap.get(Number(item.sku_id)) }))
            .filter((row) => row.sku),
        [form.data.items, skuMap],
    );

    const filteredProducts = useMemo(() => {
        const q = productSearch.trim().toLowerCase();
        if (!q) return productOptions;

        return productOptions.filter((product) => {
            const haystack = [
                product.name,
                product.category,
                ...product.skus.map((sku) => `${sku.sku_code} ${sku.title || ''} ${Object.values(sku.attributes || {}).join(' ')}`),
            ].join(' ').toLowerCase();

            return haystack.includes(q);
        });
    }, [productOptions, productSearch]);

    const selectedCountForProduct = (product) =>
        product.skus.filter((sku) => selectedSkuIds.has(Number(sku.id))).length;

    const isProductSelected = (product) => selectedCountForProduct(product) === product.skus.length && product.skus.length > 0;

    const toggleProduct = (product) => {
        const allSelected = isProductSelected(product);
        const skuIds = new Set(product.skus.map((sku) => Number(sku.id)));

        if (allSelected) {
            form.setData('items', form.data.items.filter((item) => !skuIds.has(Number(item.sku_id))));
            return;
        }

        const existing = new Set(form.data.items.map((item) => Number(item.sku_id)));
        const additions = product.skus
            .filter((sku) => !existing.has(Number(sku.id)))
            .map((sku) => ({
                sku_id: sku.id,
                discount_type: 'percentage',
                discount_value: '',
                quantity_limit: '',
            }));

        form.setData('items', [...form.data.items, ...additions]);
    };

    const updateItem = (skuId, patch) => {
        form.setData(
            'items',
            form.data.items.map((item) => (Number(item.sku_id) === Number(skuId) ? { ...item, ...patch } : item)),
        );
    };

    const removeSku = (skuId) => {
        form.clearErrors();
        form.setData('items', form.data.items.filter((item) => Number(item.sku_id) !== Number(skuId)));
    };

    const itemErrorFor = (index) => form.errors[`items.${index}.sku_id`] || form.errors[`items.${index}`];

    const canGoNext =
        tab === 0
            ? form.data.name.trim() && form.data.starts_at && form.data.ends_at
            : tab === 1
                ? form.data.items.length > 0
                : tab === 2
                    ? form.data.items.length > 0 && form.data.items.every((item) => item.discount_value && Number(item.discount_value) > 0)
                    : true;
    const canSubmit =
        form.data.name.trim()
        && form.data.starts_at
        && form.data.ends_at
        && form.data.items.length > 0
        && form.data.items.every((item) => item.discount_value && Number(item.discount_value) > 0);

    const submitFlashSale = () => {
        if (mode === 'edit') {
            form.patch(routeWithBase(`/admin/flash-sales/${flashSale.id}`, app_base), { preserveScroll: true });
        } else {
            form.post(routeWithBase('/admin/flash-sales', app_base), { preserveScroll: true });
        }
    };

    const goNext = () => {
        if (!canGoNext) return;
        setTab((value) => Math.min(steps.length - 1, value + 1));
    };

    const submit = (e) => {
        e.preventDefault();

        if (tab < steps.length - 1) {
            goNext();
            return;
        }

        if (canSubmit && !form.processing) {
            submitFlashSale();
        }
    };

    return (
        <AdminLayout
            title={mode === 'edit' ? 'Edit flash sale' : 'Create flash sale'}
            eyebrow="Marketing"
            action={
                <Link href={routeWithBase('/admin/flash-sales', app_base)} className="btn secondary">
                    <Icon name="navigation" size={14} />
                    Back to list
                </Link>
            }
        >
            <Head title={mode === 'edit' ? 'Edit Flash Sale' : 'Create Flash Sale'} />
            <AdminFlash flash={flash} errors={form.errors} />

            <form onSubmit={submit}>
                <section className="panel glass">
                    <div className="tab-bar" style={{ marginBottom: 16 }}>
                        {steps.map((step, index) => (
                            <button
                                key={step.key}
                                type="button"
                                className={tab === index ? 'active' : ''}
                                onClick={() => setTab(index)}
                            >
                                {index + 1}. {step.label}
                            </button>
                        ))}
                    </div>

                    {tab === 0 && (
                        <>
                            <PanelHeading eyebrow="Step 1" title="Basic information" />
                            <div className="crud-grid">
                                <label className="form-field span-2">
                                    <span>Campaign name</span>
                                    <input value={form.data.name} onChange={(e) => form.setData('name', e.target.value)} required />
                                </label>
                                <label className="form-field">
                                    <span>Starts</span>
                                    <input type="datetime-local" value={form.data.starts_at} onChange={(e) => form.setData('starts_at', e.target.value)} required />
                                </label>
                                <label className="form-field">
                                    <span>Ends</span>
                                    <input type="datetime-local" value={form.data.ends_at} onChange={(e) => form.setData('ends_at', e.target.value)} required />
                                </label>
                                <label className="form-field checkbox-row">
                                    <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                                    <span>Active campaign</span>
                                </label>
                            </div>
                        </>
                    )}

                    {tab === 1 && (
                        <>
                            <PanelHeading eyebrow="Step 2" title="Select products" />
                            <div className="filter-toolbar compact" style={{ marginBottom: 12 }}>
                                <div className="search-box">
                                    <Icon name="search" size={16} />
                                    <input
                                        type="search"
                                        placeholder="Search products, categories, SKU codes..."
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                    />
                                </div>
                                <span className="muted">{form.data.items.length} SKUs selected</span>
                            </div>

                            <div className="table-wrap flash-sale-product-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 44 }} />
                                            <th>Product</th>
                                            <th>Category</th>
                                            <th>SKUs</th>
                                            <th>Selected</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredProducts.length === 0 ? (
                                            <tr><td colSpan={5}><span className="muted">No products match your search.</span></td></tr>
                                        ) : filteredProducts.map((product) => {
                                            const selected = selectedCountForProduct(product);
                                            return (
                                                <tr key={product.id}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={isProductSelected(product)}
                                                            onChange={() => toggleProduct(product)}
                                                        />
                                                    </td>
                                                    <td><strong>{product.name}</strong></td>
                                                    <td><span className="muted">{product.category || 'Uncategorized'}</span></td>
                                                    <td>{product.skus.length}</td>
                                                    <td>{selected} / {product.skus.length}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {tab === 2 && (
                        <>
                            <PanelHeading eyebrow="Step 3" title="Sale data by SKU" />
                            <div className="table-wrap flash-sale-pricing-table">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Product / SKU</th>
                                            <th>Original</th>
                                            <th>Discount</th>
                                            <th>Value</th>
                                            <th>Limit</th>
                                            <th>Sale price</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedItems.length === 0 ? (
                                            <tr><td colSpan={7}><span className="muted">Select products first.</span></td></tr>
                                        ) : selectedItems.map(({ item, sku }) => {
                                            const salePrice = salePriceFor(sku, item);
                                            return (
                                                <tr key={sku.id}>
                                                    <td>
                                                        <strong>{sku.product.name}</strong>
                                                        <small className="muted" style={{ display: 'block' }}>{skuLabel(sku)} · available {sku.available_qty}</small>
                                                    </td>
                                                    <td>
                                                        <span className="price-pill">${Number(sku.price).toFixed(2)}</span>
                                                    </td>
                                                    <td>
                                                        <div className="sale-control select-control">
                                                            <select
                                                                value={item.discount_type}
                                                                onChange={(e) => updateItem(sku.id, { discount_type: e.target.value, discount_value: '' })}
                                                                aria-label="Discount type"
                                                            >
                                                                <option value="percentage">Percentage</option>
                                                                <option value="fixed_price">Fixed price</option>
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="sale-control input-control">
                                                            <span>{item.discount_type === 'percentage' ? '%' : '$'}</span>
                                                            <input
                                                                type="number"
                                                                min="0.01"
                                                                step="0.01"
                                                                value={item.discount_value}
                                                                onChange={(e) => updateItem(sku.id, { discount_value: e.target.value })}
                                                                placeholder={item.discount_type === 'percentage' ? '20' : '9.99'}
                                                                required
                                                                aria-label="Discount value"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div className="sale-control input-control">
                                                            <span>Qty</span>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                value={item.quantity_limit}
                                                                onChange={(e) => updateItem(sku.id, { quantity_limit: e.target.value })}
                                                                placeholder="No limit"
                                                                aria-label="Quantity limit"
                                                            />
                                                        </div>
                                                    </td>
                                                    <td>
                                                        {salePrice ? (
                                                            <span className="sale-price-preview">${salePrice.toFixed(2)}</span>
                                                        ) : (
                                                            <span className="muted">-</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <button type="button" className="icon-btn small danger" onClick={() => removeSku(sku.id)} aria-label="Remove SKU">
                                                            <Icon name="trash" size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    {tab === 3 && (
                        <>
                            <PanelHeading eyebrow="Step 4" title="Review and submit" />
                            <div className="metrics-grid compact" style={{ marginBottom: 14 }}>
                                <Stat label="Campaign" value={form.data.name || '-'} />
                                <Stat label="Starts" value={formatDateTime(form.data.starts_at)} />
                                <Stat label="Ends" value={formatDateTime(form.data.ends_at)} />
                                <Stat label="Duration" value={campaignDuration(form.data.starts_at, form.data.ends_at)} />
                                <Stat label="Products" value={selectedProducts.length} />
                                <Stat label="SKUs" value={selectedItems.length} />
                                <Stat label="Status" value={form.data.is_active ? 'Active' : 'Inactive'} />
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>SKU</th>
                                            <th>Discount</th>
                                            <th>Limit</th>
                                            <th>Sale price</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedItems.map(({ item, index, sku }) => {
                                            const salePrice = salePriceFor(sku, item);
                                            const itemError = itemErrorFor(index);
                                            return (
                                                <tr key={sku.id} className={itemError ? 'flash-sale-conflict-row' : ''}>
                                                    <td>
                                                        <strong>{sku.product.name}</strong>
                                                        <small className="muted" style={{ display: 'block' }}>{skuLabel(sku)}</small>
                                                        {itemError && <small className="flash-sale-conflict-message">{itemError}</small>}
                                                    </td>
                                                    <td>
                                                        {item.discount_type === 'percentage'
                                                            ? `${Number(item.discount_value || 0)}% off`
                                                            : `$${Number(item.discount_value || 0).toFixed(2)} fixed`}
                                                    </td>
                                                    <td>{item.quantity_limit || 'No limit'}</td>
                                                    <td>{salePrice ? `$${salePrice.toFixed(2)}` : '-'}</td>
                                                    <td>
                                                        <button type="button" className="icon-btn small danger" onClick={() => removeSku(sku.id)} aria-label="Remove overlapping SKU">
                                                            <Icon name="trash" size={13} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}

                    <div className="modal-actions">
                        <button type="button" className="btn secondary" disabled={tab === 0} onClick={() => setTab((value) => Math.max(0, value - 1))}>
                            Previous
                        </button>
                        {tab < steps.length - 1 ? (
                            <button type="button" className="btn primary" disabled={!canGoNext} onClick={goNext}>
                                Next
                            </button>
                        ) : (
                            <button type="submit" className="btn primary" disabled={form.processing || !canSubmit}>
                                {mode === 'edit' ? 'Save flash sale' : 'Create flash sale'}
                            </button>
                        )}
                    </div>
                </section>
            </form>
        </AdminLayout>
    );
}
