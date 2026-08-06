import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useForm, usePage } from '@/spa/router';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import WizardSkuCatalog, { ProductIdentity } from '@/Components/Admin/WizardSkuCatalog';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

function Stat({ label, value }) {
    const t = usePhraseTranslation();

    return (
        <div className="metric-card" style={{ padding: 12 }}>
            <span>{t(label)}</span>
            <strong>{value}</strong>
        </div>
    );
}

export default function TransferDocumentForm({ locations, categories = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const firstSource = locations[0]?.id || '';
    const firstDestination = locations.find((location) => String(location.id) !== String(firstSource))?.id || '';
    const [step, setStep] = useState('route');
    const form = useForm({
        source_location_id: firstSource,
        destination_location_id: firstDestination,
        items: [],
    });

    const steps = [
        { key: 'route', label: 'Route' },
        { key: 'products', label: 'Products' },
        { key: 'details', label: 'Quantities' },
        { key: 'review', label: 'Review' },
    ];
    const stepIndex = steps.findIndex((item) => item.key === step);
    const destinationOptions = locations.filter((location) => String(location.id) !== String(form.data.source_location_id));
    const selectedSkuIds = form.data.items.map((item) => item.sku_id);
    const selectedSkus = form.data.items.map((item) => item.sku).filter(Boolean);
    const lineCount = form.data.items.length;
    const sourceLocation = locations.find((location) => String(location.id) === String(form.data.source_location_id));
    const destinationLocation = locations.find((location) => String(location.id) === String(form.data.destination_location_id));
    const totalUnits = useMemo(
        () => form.data.items.reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0),
        [form.data.items],
    );
    const routeComplete = Boolean(form.data.source_location_id && form.data.destination_location_id);
    const productsComplete = routeComplete && lineCount > 0;
    const detailsComplete = lineCount > 0 && form.data.items.every((item) => {
        const qty = Number(item.requested_quantity);
        const available = Number(item.sku?.available_qty || 0);
        return Number.isFinite(qty) && qty >= 1 && qty <= Math.max(1, available);
    });
    const canAccessStep = (index) => (
        index === 0
        || (index === 1 && routeComplete)
        || (index === 2 && productsComplete)
        || (index === 3 && detailsComplete)
    );
    const canContinue = step === 'route'
        ? routeComplete
        : step === 'products'
            ? productsComplete
            : step === 'details'
                ? detailsComplete
                : detailsComplete && form.data.destination_location_id;

    const fetchCatalogPage = useCallback(async ({ q, categoryId, page, perPage }) => {
        if (!form.data.source_location_id) {
            return { data: [], current_page: 1, last_page: 1, total: 0 };
        }
        const params = {
            q,
            location_id: form.data.source_location_id,
            paginated: 1,
            page,
            per_page: perPage,
        };
        if (categoryId !== 'all') params.category_id = categoryId;
        const response = await axios.get(routeWithBase('/admin/inventory/skus/search', app_base), { params });
        return response.data;
    }, [app_base, form.data.source_location_id]);

    const addSku = (sku) => {
        if (form.data.items.some((item) => item.sku_id === sku.id)) return;
        form.setData('items', [...form.data.items, {
            sku_id: sku.id,
            sku,
            requested_quantity: 1,
        }]);
    };

    const updateItem = (index, patch) => {
        const items = [...form.data.items];
        items[index] = { ...items[index], ...patch };
        form.setData('items', items);
    };

    const updateRequestedQuantity = (index, value, availableQuantity) => {
        if (value === '') {
            updateItem(index, { requested_quantity: '' });
            return;
        }

        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) return;

        const maximum = Math.max(1, Number(availableQuantity) || 0);
        const requestedQuantity = Math.min(Math.max(Math.trunc(numericValue), 1), maximum);
        updateItem(index, { requested_quantity: requestedQuantity });
    };

    const removeSku = (skuId) => {
        form.setData('items', form.data.items.filter((line) => line.sku_id !== skuId));
    };

    const toggleSku = (sku, nextSelected) => {
        if (nextSelected) addSku(sku);
        else removeSku(sku.id);
    };

    const setSource = (sourceId) => {
        const nextDestination = locations.find((location) => String(location.id) !== String(sourceId));
        form.setData({
            ...form.data,
            source_location_id: sourceId,
            destination_location_id: nextDestination?.id || '',
            items: [],
        });
    };

    const goStep = (offset) => {
        const nextIndex = Math.min(Math.max(stepIndex + offset, 0), steps.length - 1);
        if (!canAccessStep(nextIndex) && offset > 0) return;
        const next = steps[nextIndex]?.key;
        if (next) setStep(next);
    };

    const submit = (event) => {
        event?.preventDefault?.();
        form.transform((data) => ({
            ...data,
            items: data.items.map(({ sku, ...item }) => item),
        }));
        form.post(routeWithBase('/admin/inventory/transfers', app_base));
    };

    const next = (event) => {
        event.preventDefault();
        if (step === 'route') {
            setStep('products');
            return;
        }
        if (step === 'products') {
            setStep('details');
            return;
        }
        if (step === 'details') {
            setStep('review');
            return;
        }
        submit(event);
    };

    return (
        <form onSubmit={(event) => { event.preventDefault(); if (step === 'review') submit(event); }} className="admin-wizard transfer-wizard">
            {Object.keys(form.errors).length > 0 && (
                <div className="flash error">
                    {Object.values(form.errors).map((error) => <div key={error}>{error}</div>)}
                </div>
            )}

            <section className="panel glass">
                <div className="wizard-toolbar">
                    <div className="tab-bar wizard-stepper" role="tablist" aria-label={t('Transfer form steps')}>
                        {steps.map((item, index) => (
                            <button
                                type="button"
                                key={item.key}
                                className={step === item.key ? 'active' : index < stepIndex ? 'is-complete' : ''}
                                disabled={!canAccessStep(index)}
                                onClick={() => canAccessStep(index) && setStep(item.key)}
                                aria-current={step === item.key ? 'step' : undefined}
                            >
                                <span className="wizard-step-number">
                                    {index < stepIndex ? <Icon name="check" size={13} /> : index + 1}
                                </span>
                                <span className="wizard-step-label">{t(item.label)}</span>
                            </button>
                        ))}
                    </div>
                    <div className="wizard-toolbar-actions">
                        <button type="button" className="btn secondary" onClick={() => goStep(-1)} disabled={stepIndex === 0}>
                            {t('Previous')}
                        </button>
                        <button type="button" className="btn primary" onClick={next} disabled={!canContinue || form.processing}>
                            {t(step === 'review' ? 'Transfer stock' : 'Next')}
                        </button>
                    </div>
                </div>

                {step === 'route' && (
                    <>
                        <PanelHeading eyebrow={t('Step 1')} title={t('Choose the warehouses')} />
                        <div className="receipt-basic-grid transfer-route-grid">
                            <label className="form-field">
                                <span>{t('Source warehouse')}</span>
                                <select value={form.data.source_location_id} onChange={(event) => setSource(event.target.value)} required>
                                    {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                </select>
                            </label>
                            <div className="transfer-route-direction" aria-hidden="true">
                                <span><Icon name="truck" size={16} /></span>
                                <i />
                                <Icon name="navigation" size={13} />
                            </div>
                            <label className="form-field">
                                <span>{t('Destination warehouse')}</span>
                                <select value={form.data.destination_location_id} onChange={(event) => form.setData('destination_location_id', event.target.value)} required>
                                    {destinationOptions.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                </select>
                            </label>
                        </div>
                    </>
                )}

                {step === 'products' && (
                    <>
                        <PanelHeading eyebrow={t('Step 2')} title={t('Select products')} action={<small className="muted">{lineCount} {t('selected')}</small>} />
                        <WizardSkuCatalog
                            categories={categories}
                            selectedSkus={selectedSkus}
                            selectedSkuIds={selectedSkuIds}
                            onToggle={toggleSku}
                            fetchPage={fetchCatalogPage}
                            enabled={step === 'products'}
                            resetKey={String(form.data.source_location_id || '')}
                            searchDisabled={!form.data.source_location_id}
                            columns={[
                                {
                                    key: 'on_hand',
                                    label: 'On hand',
                                    render: (sku) => (<><strong>{sku.on_hand_qty}</strong><small>{t('on hand')}</small></>),
                                },
                                {
                                    key: 'available',
                                    label: 'Available',
                                    render: (sku) => (<><strong>{sku.available_qty}</strong><small>{t('available')}</small></>),
                                },
                            ]}
                        />
                    </>
                )}

                {step === 'details' && (
                    <>
                        <PanelHeading eyebrow={t('Step 3')} title={t('Quantities')} action={<small className="muted">{t('Requested quantity cannot exceed source availability.')}</small>} />
                        <div className="wizard-qty-table" style={{ '--wizard-qty-fields': 2, '--wizard-qty-unit': '96px' }}>
                            {lineCount > 0 && (
                                <div className="wizard-qty-list-head" aria-hidden="true">
                                    <span>{t('Product / SKU')}</span>
                                    <span>{t('Available')}</span>
                                    <span>{t('Requested')}</span>
                                    <span>{t('Action')}</span>
                                </div>
                            )}
                            <div className="receipt-price-lines wizard-console-lines">
                                {lineCount === 0 ? <div className="empty-document-lines">{t('Select products before entering quantities.')}</div> : form.data.items.map((item, index) => (
                                <div className="receipt-price-line has-remove wizard-console-line" key={item.sku_id}>
                                    <ProductIdentity sku={item.sku} />
                                    <label className="form-field">
                                        <span>{t('Available')}</span>
                                        <input type="number" value={item.sku.available_qty} readOnly tabIndex={-1} />
                                    </label>
                                    <label className="form-field">
                                        <span>{t('Requested')}</span>
                                        <input
                                            type="number"
                                            min="1"
                                            max={item.sku.available_qty}
                                            step="1"
                                            inputMode="numeric"
                                            value={item.requested_quantity}
                                            onChange={(event) => updateRequestedQuantity(index, event.target.value, item.sku.available_qty)}
                                            onBlur={() => {
                                                if (item.requested_quantity === '') updateRequestedQuantity(index, '1', item.sku.available_qty);
                                            }}
                                            required
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        className="icon-btn small danger wizard-qty-remove"
                                        onClick={() => removeSku(item.sku_id)}
                                        aria-label={t('Remove item')}
                                        title={t('Remove item')}
                                    >
                                        <Icon name="trash" size={13} />
                                    </button>
                                </div>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {step === 'review' && (
                    <>
                        <PanelHeading eyebrow={t('Step 4')} title={t('Review and submit')} />
                        <div className="metrics-grid compact" style={{ marginBottom: 14 }}>
                            <Stat label="Source warehouse" value={sourceLocation?.name || '-'} />
                            <Stat label="Destination warehouse" value={destinationLocation?.name || '-'} />
                            <Stat label="Lines" value={lineCount} />
                            <Stat label="Units" value={totalUnits} />
                        </div>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>{t('SKU')}</th>
                                        <th>{t('Available')}</th>
                                        <th>{t('Requested')}</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {form.data.items.map((item) => (
                                        <tr key={item.sku_id}>
                                            <td>
                                                <strong>{item.sku?.product_name}</strong>
                                                <small className="muted" style={{ display: 'block' }}>
                                                    {item.sku?.sku_code}
                                                    {item.sku?.barcode ? ` / ${item.sku.barcode}` : ''}
                                                </small>
                                            </td>
                                            <td>{item.sku?.available_qty ?? '-'}</td>
                                            <td>{item.requested_quantity}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="icon-btn small danger"
                                                    onClick={() => removeSku(item.sku_id)}
                                                    aria-label={t('Remove item')}
                                                >
                                                    <Icon name="trash" size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </section>
        </form>
    );
}
