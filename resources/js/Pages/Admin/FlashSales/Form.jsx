import { useCallback, useMemo, useRef, useState } from 'react';
import { Head, Link, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import WizardSkuCatalog, { ProductIdentity } from '@/Components/Admin/WizardSkuCatalog';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';
import { formatErrorMessage } from '@/Utils/formatErrorMessage';

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

const toDateInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

/** Date-only fields default to 12:00 AM local — no clock picker. */
const dateToIsoMidnight = (value) => {
    if (!value) return null;
    const datePart = String(value).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
    return new Date(`${datePart}T00:00:00`).toISOString();
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
        starts_at: toDateInput(flashSale.starts_at),
        ends_at: toDateInput(flashSale.ends_at),
        is_active: Boolean(flashSale.is_active),
        items: (flashSale.items || []).map((item) => ({
            sku_id: item.sku_id,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            quantity_limit: item.quantity_limit ?? '',
            sold_count: Number(item.sold_count || 0),
        })),
    };
};

const salePriceFor = (sku, item) => {
    if (!sku || !item?.discount_value) return null;
    const original = Number(sku.price || 0);
    const value = Number(item.discount_value || 0);
    if (item.discount_type === 'percentage' && value >= 100) return null;
    if (item.discount_type === 'fixed_price' && value >= original) return null;
    const price = item.discount_type === 'percentage' ? original * (1 - value / 100) : value;

    return Math.max(0.01, Math.min(original, price));
};

function FieldError({ message, id }) {
    if (!message) return null;
    return <small id={id} className="flash-sale-conflict-message" role="alert">{formatErrorMessage(message)}</small>;
}

const formatDateLabel = (value) => {
    if (!value) return '-';
    const datePart = String(value).slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(datePart)
        ? new Date(`${datePart}T00:00:00`)
        : new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const campaignDuration = (startsAt, endsAt) => {
    if (!startsAt || !endsAt) return '-';
    const start = new Date(`${String(startsAt).slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(endsAt).slice(0, 10)}T00:00:00`);
    const diffMs = end.getTime() - start.getTime();
    if (!Number.isFinite(diffMs) || diffMs < 0) return '-';

    const days = Math.round(diffMs / 86400000);
    return days === 0 ? 'Same day' : `${days}d`;
};

function Stat({ label, value }) {
    const t = usePhraseTranslation();

    return (
        <div className="metric-card" style={{ padding: 12 }}>
            <span>{t(label)}</span>
            <strong>{value}</strong>
        </div>
    );
}

export default function FlashSaleForm({ productOptions, flashSale = null, mode = 'create' }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const [tab, setTab] = useState(0);
    const form = useForm(buildInitialData(flashSale));
    const campaignNameRef = useRef(null);

    const skuMap = useMemo(() => {
        const map = new Map();
        productOptions.forEach((product) => {
            product.skus.forEach((sku) => {
                map.set(Number(sku.id), { ...sku, product });
            });
        });
        return map;
    }, [productOptions]);

    const catalogSkus = useMemo(() => (
        productOptions.flatMap((product) => product.skus.map((sku) => ({
            id: sku.id,
            sku_code: sku.sku_code,
            barcode: null,
            product_name: product.name,
            title: sku.title,
            price: sku.price,
            retail_price: sku.price,
            available_qty: sku.available_qty,
            category: product.category || '',
            attributes: sku.attributes || {},
        })))
    ), [productOptions]);

    const selectedSkuIds = useMemo(
        () => form.data.items.map((item) => Number(item.sku_id)).filter(Boolean),
        [form.data.items],
    );

    const selectedSkuIdSet = useMemo(() => new Set(selectedSkuIds), [selectedSkuIds]);

    const selectedProductIds = useMemo(() => {
        const ids = new Set();
        selectedSkuIdSet.forEach((skuId) => {
            const sku = skuMap.get(Number(skuId));
            if (sku?.product?.id) ids.add(Number(sku.product.id));
        });
        return ids;
    }, [selectedSkuIdSet, skuMap]);

    const selectedProducts = useMemo(
        () => productOptions.filter((product) => selectedProductIds.has(Number(product.id))),
        [productOptions, selectedProductIds],
    );

    const selectedSkus = useMemo(
        () => form.data.items
            .map((item) => {
                const sku = skuMap.get(Number(item.sku_id));
                if (!sku) return null;
                return {
                    id: sku.id,
                    sku_code: sku.sku_code,
                    barcode: null,
                    product_name: sku.product?.name,
                    title: sku.title,
                    price: sku.price,
                    retail_price: sku.price,
                    available_qty: sku.available_qty,
                    category: sku.product?.category || '',
                };
            })
            .filter(Boolean),
        [form.data.items, skuMap],
    );

    const selectedItems = useMemo(
        () => form.data.items
            .map((item, index) => ({ item, index, sku: skuMap.get(Number(item.sku_id)) }))
            .filter((row) => row.sku),
        [form.data.items, skuMap],
    );

    const categoryOptions = useMemo(() => {
        const names = new Set();
        productOptions.forEach((product) => {
            if (product.category) names.add(product.category);
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b)).map((name) => ({ id: name, name }));
    }, [productOptions]);

    const fetchCatalogPage = useCallback(async ({ q, categoryId, page, perPage }) => {
        const term = String(q || '').trim().toLowerCase();
        const filtered = catalogSkus.filter((sku) => {
            if (categoryId !== 'all' && (sku.category || '') !== categoryId) return false;
            if (!term) return true;
            const haystack = [
                sku.product_name,
                sku.category,
                sku.sku_code,
                sku.title,
                Object.values(sku.attributes || {}).join(' '),
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });
        const lastPage = Math.max(1, Math.ceil(filtered.length / perPage));
        const start = (page - 1) * perPage;
        return {
            data: filtered.slice(start, start + perPage),
            current_page: page,
            last_page: lastPage,
            total: filtered.length,
        };
    }, [catalogSkus]);

    const removeSku = (skuId) => {
        const item = form.data.items.find((candidate) => Number(candidate.sku_id) === Number(skuId));
        if (Number(item?.sold_count || 0) > 0) return;
        form.clearErrors(...Object.keys(form.errors).filter((key) => key === 'items' || key.startsWith('items.')));
        form.setData('items', form.data.items.filter((item) => Number(item.sku_id) !== Number(skuId)));
    };

    const toggleSku = (sku, nextSelected) => {
        if (!nextSelected) {
            removeSku(sku.id);
            return;
        }
        if (selectedSkuIdSet.has(Number(sku.id))) return;
        form.clearErrors(...Object.keys(form.errors).filter((key) => key === 'items' || key.startsWith('items.')));
        form.setData('items', [
            ...form.data.items,
            {
                sku_id: sku.id,
                discount_type: 'percentage',
                discount_value: '',
                quantity_limit: '',
            },
        ]);
    };

    const updateItem = (skuId, patch) => {
        const index = form.data.items.findIndex((item) => Number(item.sku_id) === Number(skuId));
        form.setData(
            'items',
            form.data.items.map((item) => (Number(item.sku_id) === Number(skuId) ? { ...item, ...patch } : item)),
        );
        if (index >= 0) {
            form.clearErrors(
                `items.${index}.discount_type`,
                `items.${index}.discount_value`,
                `items.${index}.quantity_limit`,
            );
        }
    };

    const itemErrorFor = (index, field = null) => (
        (field ? form.errors[`items.${index}.${field}`] : null)
        || form.errors[`items.${index}.sku_id`]
        || form.errors[`items.${index}`]
    );

    const basicErrors = useMemo(() => {
        const errors = {};
        if (form.data.starts_at && form.data.ends_at) {
            const start = new Date(`${String(form.data.starts_at).slice(0, 10)}T00:00:00`);
            const end = new Date(`${String(form.data.ends_at).slice(0, 10)}T00:00:00`);
            if (end <= start) {
                errors.ends_at = t('End date must be after the start date.');
            }
        }
        return errors;
    }, [form.data.starts_at, form.data.ends_at, t]);

    const pricingErrors = useMemo(() => {
        const errors = {};
        form.data.items.forEach((item, index) => {
            const sku = skuMap.get(Number(item.sku_id));
            const value = Number(item.discount_value);
            const limit = item.quantity_limit === '' || item.quantity_limit === null ? null : Number(item.quantity_limit);

            if (!Number.isFinite(value) || value <= 0) {
                errors[`items.${index}.discount_value`] = t('Enter a discount greater than zero.');
            } else if (item.discount_type === 'percentage' && value >= 100) {
                errors[`items.${index}.discount_value`] = t('Percentage discount must be less than 100%.');
            } else if (item.discount_type === 'fixed_price' && sku && value >= Number(sku.price)) {
                errors[`items.${index}.discount_value`] = t('Fixed sale price must be lower than the SKU price.');
            }

            if (limit !== null && (!Number.isInteger(limit) || limit < 1)) {
                errors[`items.${index}.quantity_limit`] = t('Quantity limit must be a whole number of at least 1.');
            } else if (limit !== null && limit < Number(item.sold_count || 0)) {
                errors[`items.${index}.quantity_limit`] = t('Quantity limit cannot be lower than units already sold.');
            }
        });
        return errors;
    }, [form.data.items, skuMap, t]);

    const basicComplete = Boolean(
        form.data.name.trim()
        && form.data.starts_at
        && form.data.ends_at
        && Object.keys(basicErrors).length === 0
    );
    const productsComplete = basicComplete && form.data.items.length > 0;
    const pricingComplete = productsComplete && Object.keys(pricingErrors).length === 0;

    const canAccessStep = (index) => (
        index === 0
        || (index === 1 && basicComplete)
        || (index === 2 && productsComplete)
        || (index === 3 && pricingComplete)
    );

    const canGoNext =
        tab === 0
            ? basicComplete
            : tab === 1
                ? productsComplete
                : tab === 2
                    ? pricingComplete
                    : true;
    const canSubmit = pricingComplete;

    const handleServerErrors = (errors) => {
        const keys = Object.keys(errors);
        const firstKey = keys[0] || '';
        if (firstKey === 'name' || firstKey === 'starts_at' || firstKey === 'ends_at') setTab(0);
        else if (firstKey === 'items') setTab(1);
        else if (firstKey.startsWith('items.')) setTab(2);

        window.requestAnimationFrame(() => {
            const target = document.querySelector(`[name="${firstKey}"]`);
            (target || campaignNameRef.current)?.focus();
        });
    };

    const submitFlashSale = () => {
        if (!canSubmit || form.processing) return;

        form.transform((data) => ({
            ...data,
            starts_at: dateToIsoMidnight(data.starts_at),
            ends_at: dateToIsoMidnight(data.ends_at),
            items: data.items.map(({ sold_count, ...item }) => item),
        }));
        const options = { preserveScroll: true, onError: handleServerErrors };
        if (mode === 'edit') {
            form.patch(routeWithBase(`/admin/flash-sales/${flashSale.id}`, app_base), options);
        } else {
            form.post(routeWithBase('/admin/flash-sales', app_base), options);
        }
    };

    const goNext = (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        if (!canGoNext) return;
        setTab((value) => Math.min(steps.length - 1, value + 1));
    };

    const goPrevious = (event) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        setTab((value) => Math.max(0, value - 1));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Only the review step (tab 3) may submit. Earlier steps only advance.
        if (tab < steps.length - 1) {
            goNext();
            return;
        }

        submitFlashSale();
    };

    return (
        <AdminLayout
            title={mode === 'edit' ? t('Edit flash sale') : t('Create flash sale')}
            eyebrow={t('Marketing')}
            action={
                <Link href={routeWithBase('/admin/flash-sales', app_base)} className="btn secondary">
                    <Icon name="navigation" size={14} />
                    {t('Back to list')}
                </Link>
            }
        >
            <Head title={mode === 'edit' ? t('Edit Flash Sale') : t('Create Flash Sale')} />
            <AdminFlash flash={flash} errors={form.errors} />

            <form onSubmit={handleFormSubmit} noValidate>
                <section className="panel glass">
                    <div className="wizard-toolbar">
                        <div className="tab-bar wizard-stepper" role="tablist" aria-label={t('Flash sale form steps')}>
                            {steps.map((step, index) => (
                                <button
                                    key={step.key}
                                    type="button"
                                    className={tab === index ? 'active' : index < tab ? 'is-complete' : ''}
                                    disabled={!canAccessStep(index)}
                                    onClick={() => canAccessStep(index) && setTab(index)}
                                    aria-current={tab === index ? 'step' : undefined}
                                >
                                    <span className="wizard-step-number">
                                        {index < tab ? <Icon name="check" size={13} /> : index + 1}
                                    </span>
                                    <span className="wizard-step-label">{t(step.label)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="wizard-toolbar-actions">
                            <button type="button" className="btn secondary" disabled={tab === 0} onClick={goPrevious}>
                                {t('Previous')}
                            </button>
                            {tab < steps.length - 1 ? (
                                <button type="button" className="btn primary" disabled={!canGoNext} onClick={goNext}>
                                    {t('Next')}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="btn primary"
                                    disabled={form.processing || !canSubmit}
                                    onClick={submitFlashSale}
                                >
                                    {mode === 'edit' ? t('Save flash sale') : t('Create flash sale')}
                                </button>
                            )}
                        </div>
                    </div>

                    {tab === 0 && (
                        <>
                            <PanelHeading eyebrow={t('Step 1')} title={t('Basic information')} />
                            <div className="crud-grid">
                                <label className="form-field span-2">
                                    <span>{t('Campaign name')}</span>
                                    <input
                                        ref={campaignNameRef}
                                        name="name"
                                        value={form.data.name}
                                        onChange={(e) => {
                                            form.setData('name', e.target.value);
                                            form.clearErrors('name');
                                        }}
                                        aria-invalid={Boolean(form.errors.name)}
                                    />
                                    <FieldError id="flash-sale-name-error" message={form.errors.name} />
                                </label>
                                <label className="form-field">
                                    <span>{t('Starts')}</span>
                                    <input
                                        name="starts_at"
                                        type="date"
                                        value={form.data.starts_at}
                                        onChange={(e) => {
                                            form.setData('starts_at', e.target.value);
                                            form.clearErrors('starts_at', 'ends_at');
                                        }}
                                        aria-invalid={Boolean(form.errors.starts_at)}
                                    />
                                    <small className="muted">{t('Defaults to 12:00 AM')}</small>
                                    <FieldError id="flash-sale-start-error" message={form.errors.starts_at} />
                                </label>
                                <label className="form-field">
                                    <span>{t('Ends')}</span>
                                    <input
                                        name="ends_at"
                                        type="date"
                                        min={form.data.starts_at || undefined}
                                        value={form.data.ends_at}
                                        onChange={(e) => {
                                            form.setData('ends_at', e.target.value);
                                            form.clearErrors('ends_at');
                                        }}
                                        aria-invalid={Boolean(form.errors.ends_at || basicErrors.ends_at)}
                                    />
                                    <small className="muted">{t('Defaults to 12:00 AM')}</small>
                                    <FieldError id="flash-sale-end-error" message={form.errors.ends_at || basicErrors.ends_at} />
                                </label>
                                <label className="form-field checkbox-row">
                                    <input name="is_active" type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                                    <span>{t('Active campaign')}</span>
                                </label>
                            </div>
                        </>
                    )}

                    {tab === 1 && (
                        <>
                            <PanelHeading
                                eyebrow={t('Step 2')}
                                title={t('Select products')}
                                action={<small className="muted">{form.data.items.length} {t('SKUs selected')}</small>}
                            />
                            <FieldError id="flash-sale-items-error" message={form.errors.items} />
                            <WizardSkuCatalog
                                categories={categoryOptions}
                                selectedSkus={selectedSkus}
                                selectedSkuIds={selectedSkuIds}
                                onToggle={toggleSku}
                                isDisabled={(sku) => {
                                    const item = form.data.items.find((candidate) => Number(candidate.sku_id) === Number(sku.id));
                                    return Number(item?.sold_count || 0) > 0;
                                }}
                                fetchPage={fetchCatalogPage}
                                enabled={tab === 1}
                                searchPlaceholder="Search products, categories, SKU codes..."
                                columns={[
                                    {
                                        key: 'price',
                                        label: 'Price',
                                        render: (sku) => (<><strong>{formatMoney(sku.price)}</strong><small>{t('retail')}</small></>),
                                    },
                                    {
                                        key: 'available',
                                        label: 'Available',
                                        render: (sku) => (<><strong>{sku.available_qty ?? 0}</strong><small>{t('available')}</small></>),
                                    },
                                ]}
                            />
                        </>
                    )}

                    {tab === 2 && (
                        <>
                            <PanelHeading
                                eyebrow={t('Step 3')}
                                title={t('Sale data by SKU')}
                                action={<small className="muted">{t('Discount and quantity limit per SKU.')}</small>}
                            />
                            <div className="wizard-qty-table" style={{ '--wizard-qty-fields': 5, '--wizard-qty-unit': '108px' }}>
                                {selectedItems.length > 0 && (
                                    <div className="wizard-qty-list-head" aria-hidden="true">
                                        <span>{t('Product / SKU')}</span>
                                        <span>{t('Original')}</span>
                                        <span>{t('Discount')}</span>
                                        <span>{t('Value')}</span>
                                        <span>{t('Limit')}</span>
                                        <span>{t('Sale price')}</span>
                                        <span>{t('Action')}</span>
                                    </div>
                                )}
                                <div className="receipt-price-lines wizard-console-lines">
                                    {selectedItems.length === 0 ? (
                                        <div className="empty-document-lines">{t('Select products first.')}</div>
                                    ) : selectedItems.map(({ item, index, sku }) => {
                                        const salePrice = salePriceFor(sku, item);
                                        const locked = Number(item.sold_count || 0) > 0;
                                        const discountError = form.errors[`items.${index}.discount_type`]
                                            || form.errors[`items.${index}.discount_value`]
                                            || pricingErrors[`items.${index}.discount_value`];
                                        const quantityError = form.errors[`items.${index}.quantity_limit`]
                                            || pricingErrors[`items.${index}.quantity_limit`];
                                        const skuStatus = [
                                            `${sku.available_qty ?? 0} ${t('available')}`,
                                            locked ? `${item.sold_count} ${t('sold')}` : null,
                                        ].filter(Boolean).join(' · ');
                                        const identitySku = {
                                            id: sku.id,
                                            product_name: sku.product?.name,
                                            sku_code: `${sku.sku_code} · ${skuStatus}`,
                                            barcode: null,
                                        };

                                        const skuError = itemErrorFor(index);
                                        const rowInvalid = Boolean(discountError || quantityError || skuError);

                                        return (
                                        <div
                                            className={rowInvalid ? 'receipt-price-line has-remove wizard-console-line is-invalid' : 'receipt-price-line has-remove wizard-console-line'}
                                            key={sku.id}
                                        >
                                            <ProductIdentity sku={identitySku} showBarcode={false} />
                                            <div className="wizard-qty-value">
                                                <span>{t('Original')}</span>
                                                <strong>{formatMoney(sku.price)}</strong>
                                            </div>
                                            <label className={form.errors[`items.${index}.discount_type`] ? 'form-field is-invalid' : 'form-field'}>
                                                <span>{t('Discount')}</span>
                                                <select
                                                    name={`items.${index}.discount_type`}
                                                    value={item.discount_type}
                                                    onChange={(e) => updateItem(sku.id, { discount_type: e.target.value, discount_value: '' })}
                                                    aria-label={t('Discount type')}
                                                    aria-invalid={Boolean(form.errors[`items.${index}.discount_type`])}
                                                    title={form.errors[`items.${index}.discount_type`] || undefined}
                                                    disabled={locked}
                                                >
                                                    <option value="percentage">{t('Percentage')}</option>
                                                    <option value="fixed_price">{t('Fixed price')}</option>
                                                </select>
                                            </label>
                                            <label className={discountError ? 'form-field is-invalid' : 'form-field'}>
                                                <span>{item.discount_type === 'percentage' ? t('Value %') : t('Value')}</span>
                                                <input
                                                    name={`items.${index}.discount_value`}
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                    value={item.discount_value}
                                                    onChange={(e) => updateItem(sku.id, { discount_value: e.target.value })}
                                                    placeholder={item.discount_type === 'percentage' ? '20' : '9.99'}
                                                    aria-label={t('Discount value')}
                                                    aria-invalid={Boolean(discountError)}
                                                    title={discountError || undefined}
                                                    disabled={locked}
                                                />
                                            </label>
                                            <label className={quantityError ? 'form-field is-invalid' : 'form-field'}>
                                                <span>{t('Limit')}</span>
                                                <input
                                                    name={`items.${index}.quantity_limit`}
                                                    type="number"
                                                    min={Math.max(1, Number(item.sold_count || 0))}
                                                    step="1"
                                                    value={item.quantity_limit}
                                                    onChange={(e) => updateItem(sku.id, { quantity_limit: e.target.value })}
                                                    placeholder={t('No limit')}
                                                    aria-label={t('Quantity limit')}
                                                    aria-invalid={Boolean(quantityError)}
                                                    title={quantityError || undefined}
                                                />
                                            </label>
                                            <div className="wizard-qty-value">
                                                <span>{t('Sale price')}</span>
                                                <strong>{salePrice ? formatMoney(salePrice) : '-'}</strong>
                                            </div>
                                            <button
                                                type="button"
                                                className="icon-btn small danger wizard-qty-remove"
                                                onClick={() => removeSku(sku.id)}
                                                aria-label={locked ? t('SKU cannot be removed after sales') : t('Remove SKU')}
                                                title={locked ? t('SKUs with recorded sales cannot be removed.') : t('Remove SKU')}
                                                disabled={locked}
                                            >
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}

                    {tab === 3 && (
                        <>
                            <PanelHeading eyebrow={t('Step 4')} title={t('Review and submit')} />
                            <div className="metrics-grid compact" style={{ marginBottom: 14 }}>
                                <Stat label="Campaign" value={form.data.name || '-'} />
                                <Stat label="Starts" value={formatDateLabel(form.data.starts_at)} />
                                <Stat label="Ends" value={formatDateLabel(form.data.ends_at)} />
                                <Stat label="Duration" value={campaignDuration(form.data.starts_at, form.data.ends_at)} />
                                <Stat label="Products" value={selectedProducts.length} />
                                <Stat label="SKUs" value={selectedItems.length} />
                                <Stat label="Status" value={form.data.is_active ? t('Active') : t('Inactive')} />
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('SKU')}</th>
                                            <th>{t('Discount')}</th>
                                            <th>{t('Limit')}</th>
                                            <th>{t('Sale price')}</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedItems.map(({ item, index, sku }) => {
                                            const salePrice = salePriceFor(sku, item);
                                            const itemError = itemErrorFor(index)
                                                || form.errors[`items.${index}.discount_value`]
                                                || form.errors[`items.${index}.quantity_limit`];
                                            const locked = Number(item.sold_count || 0) > 0;
                                            return (
                                                <tr key={sku.id} className={itemError ? 'flash-sale-conflict-row' : ''}>
                                                    <td>
                                                        <strong>{sku.product.name}</strong>
                                                        <small className="muted" style={{ display: 'block' }}>{skuLabel(sku)}</small>
                                                        {itemError && <small className="flash-sale-conflict-message">{itemError}</small>}
                                                    </td>
                                                    <td>
                                                        {item.discount_type === 'percentage'
                                                            ? `${Number(item.discount_value || 0)}% ${t('off')}`
                                                            : `${formatMoney(item.discount_value || 0)} ${t('fixed')}`}
                                                    </td>
                                                    <td>{item.quantity_limit || t('No limit')}</td>
                                                    <td>{salePrice ? formatMoney(salePrice) : '-'}</td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className="icon-btn small danger"
                                                            onClick={() => removeSku(sku.id)}
                                                            aria-label={locked ? t('SKU cannot be removed after sales') : t('Remove SKU')}
                                                            disabled={locked}
                                                        >
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
                </section>
            </form>
        </AdminLayout>
    );
}
