import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useForm, usePage } from '@/spa/router';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import WizardSkuCatalog, { ProductIdentity } from '@/Components/Admin/WizardSkuCatalog';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

function Stat({ label, value }) {
    const t = usePhraseTranslation();

    return (
        <div className="metric-card" style={{ padding: 12 }}>
            <span>{t(label)}</span>
            <strong>{value}</strong>
        </div>
    );
}

export default function InventoryDocumentForm({ type, locations, categories = [], reasons = [], initialData = null, submitUrl = null, submitMethod = 'post', submitLabel = 'Save draft' }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const isReceipt = type === 'receipt';
    const form = useForm({
        location_id: initialData?.location_id || locations[0]?.id || '',
        supplier_reference: initialData?.supplier_reference || '',
        reason_code: initialData?.reason_code || reasons[0]?.value || 'physical_count',
        notes: initialData?.notes || '',
        items: initialData?.items || [],
    });

    const receiptSteps = [
        { key: 'basic', label: 'Basic' },
        { key: 'products', label: 'Products' },
        { key: 'details', label: 'Quantities' },
        { key: 'review', label: 'Review' },
    ];
    const [receiptStep, setReceiptStep] = useState('basic');

    const search = async () => {
        if (!form.data.location_id) return;
        setSearching(true);
        try {
            const params = { q: query, location_id: form.data.location_id };
            const response = await axios.get(routeWithBase('/admin/inventory/skus/search', app_base), { params });
            setResults(response.data);
        } finally {
            setSearching(false);
        }
    };

    const fetchCatalogPage = useCallback(async ({ q, categoryId, page, perPage }) => {
        if (!form.data.location_id) {
            return { data: [], current_page: 1, last_page: 1, total: 0 };
        }
        const params = {
            q,
            location_id: form.data.location_id,
            paginated: 1,
            page,
            per_page: perPage,
        };
        if (categoryId !== 'all') params.category_id = categoryId;
        const response = await axios.get(routeWithBase('/admin/inventory/skus/search', app_base), { params });
        return response.data;
    }, [app_base, form.data.location_id]);

    const addSku = (sku) => {
        if (form.data.items.some((item) => item.sku_id === sku.id)) return;
        const item = isReceipt
            ? {
                sku_id: sku.id,
                sku,
                received_quantity: 1,
                unit_cost: sku.original_price ?? sku.cost ?? sku.market_price ?? '',
                wholesale_price: sku.wholesale_price ?? '',
                retail_price: sku.retail_price ?? sku.price ?? '',
            }
            : { sku_id: sku.id, sku, system_quantity: sku.on_hand_qty, counted_quantity: sku.on_hand_qty, notes: '' };
        form.setData('items', [...form.data.items, item]);
        if (!isReceipt) {
            setResults([]);
            setQuery('');
        }
    };

    const updateItem = (index, patch) => {
        const items = [...form.data.items];
        items[index] = { ...items[index], ...patch };
        form.setData('items', items);
    };

    const submit = (event) => {
        event?.preventDefault?.();
        form.transform((data) => ({ ...data, items: data.items.map(({ sku, system_quantity, ...item }) => item) }));
        const url = submitUrl || routeWithBase(isReceipt ? '/admin/inventory/receipts' : '/admin/inventory/adjustments', app_base);
        if (submitMethod.toLowerCase() === 'put') {
            form.put(url);
        } else {
            form.post(url);
        }
    };

    const lineCount = form.data.items.length;
    const receiptStepIndex = receiptSteps.findIndex((step) => step.key === receiptStep);
    const selectedSkuIds = form.data.items.map((item) => item.sku_id);
    const selectedSkus = form.data.items.map((item) => item.sku).filter(Boolean);
    const selectedLocation = locations.find((location) => String(location.id) === String(form.data.location_id));
    const totalUnits = useMemo(
        () => form.data.items.reduce((sum, item) => sum + Number(item.received_quantity || 0), 0),
        [form.data.items],
    );
    const detailsComplete = lineCount > 0 && form.data.items.every((item) => Number(item.received_quantity) >= 1);
    const basicComplete = Boolean(form.data.location_id);
    const productsComplete = basicComplete && lineCount > 0;
    const canAccessReceiptStep = (index) => (
        index === 0
        || (index === 1 && basicComplete)
        || (index === 2 && productsComplete)
        || (index === 3 && detailsComplete)
    );
    const goReceiptStep = (offset) => {
        const nextIndex = Math.min(Math.max(receiptStepIndex + offset, 0), receiptSteps.length - 1);
        if (!canAccessReceiptStep(nextIndex) && offset > 0) return;
        const next = receiptSteps[nextIndex]?.key;
        if (next) setReceiptStep(next);
    };

    const handleReceiptSubmit = (event) => {
        event.preventDefault();
        if (receiptStep === 'review') {
            submit(event);
        }
    };

    const handleReceiptNext = (event) => {
        event.preventDefault();
        if (receiptStep === 'basic') {
            setReceiptStep('products');
            return;
        }
        if (receiptStep === 'products') {
            setReceiptStep('details');
            return;
        }
        if (receiptStep === 'details') {
            setReceiptStep('review');
            return;
        }
        submit(event);
    };

    const removeSku = (skuId) => {
        form.setData('items', form.data.items.filter((line) => line.sku_id !== skuId));
    };

    const toggleSku = (sku, nextSelected) => {
        if (nextSelected) addSku(sku);
        else removeSku(sku.id);
    };

    if (isReceipt) {
        const stepMeta = {
            basic: { eyebrow: 'Step 1', title: 'Basic information' },
            products: { eyebrow: 'Step 2', title: 'Select products' },
            details: { eyebrow: 'Step 3', title: 'Quantities & prices' },
            review: { eyebrow: 'Step 4', title: 'Review and submit' },
        }[receiptStep];
        const canGoNext = receiptStep === 'basic'
            ? basicComplete
            : receiptStep === 'products'
                ? productsComplete
                : receiptStep === 'details'
                    ? detailsComplete
                    : detailsComplete;

        return (
            <form onSubmit={handleReceiptSubmit} className="admin-wizard">
                {Object.keys(form.errors).length > 0 && (
                    <div className="flash error">{Object.values(form.errors).map((error) => <div key={error}>{error}</div>)}</div>
                )}

                <section className="panel glass">
                    <div className="wizard-toolbar">
                        <div className="tab-bar wizard-stepper" role="tablist" aria-label={t('Receipt form steps')}>
                            {receiptSteps.map((step, index) => (
                                <button
                                    type="button"
                                    key={step.key}
                                    className={receiptStep === step.key ? 'active' : index < receiptStepIndex ? 'is-complete' : ''}
                                    disabled={!canAccessReceiptStep(index)}
                                    onClick={() => canAccessReceiptStep(index) && setReceiptStep(step.key)}
                                    aria-current={receiptStep === step.key ? 'step' : undefined}
                                >
                                    <span className="wizard-step-number">
                                        {index < receiptStepIndex ? <Icon name="check" size={13} /> : index + 1}
                                    </span>
                                    <span className="wizard-step-label">{t(step.label)}</span>
                                </button>
                            ))}
                        </div>
                        <div className="wizard-toolbar-actions">
                            <button type="button" className="btn secondary" onClick={() => goReceiptStep(-1)} disabled={receiptStepIndex === 0}>
                                {t('Previous')}
                            </button>
                            <button
                                type="button"
                                className="btn primary"
                                onClick={handleReceiptNext}
                                disabled={!canGoNext || form.processing}
                            >
                                {t(receiptStep === 'review' ? submitLabel : 'Next')}
                            </button>
                        </div>
                    </div>

                    {receiptStep === 'basic' && (
                        <>
                            <PanelHeading eyebrow={t(stepMeta.eyebrow)} title={t(stepMeta.title)} />
                            <div className="receipt-basic-grid">
                                <label className="form-field">
                                    <span>{t('Warehouse')}</span>
                                    <select value={form.data.location_id} onChange={(event) => { form.setData({ ...form.data, location_id: event.target.value, items: [] }); setResults([]); }} required>
                                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                    </select>
                                </label>
                                <label className="form-field">
                                    <span>{t('Supplier / reference')}</span>
                                    <input value={form.data.supplier_reference} onChange={(event) => form.setData('supplier_reference', event.target.value)} placeholder={t('Invoice, PO, or supplier name')} />
                                </label>
                                <label className="form-field receipt-wide-field">
                                    <span>{t('Document note')}</span>
                                    <textarea rows="5" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} placeholder={t('Receiving notes, delivery condition, or internal comments')} />
                                </label>
                            </div>
                        </>
                    )}

                    {receiptStep === 'products' && (
                        <>
                            <PanelHeading eyebrow={t(stepMeta.eyebrow)} title={t(stepMeta.title)} action={<small className="muted">{lineCount} {t('selected')}</small>} />
                            <WizardSkuCatalog
                                categories={categories}
                                selectedSkus={selectedSkus}
                                selectedSkuIds={selectedSkuIds}
                                onToggle={toggleSku}
                                fetchPage={fetchCatalogPage}
                                enabled={receiptStep === 'products'}
                                resetKey={String(form.data.location_id || '')}
                                searchDisabled={!form.data.location_id}
                                columns={[
                                    {
                                        key: 'on_hand',
                                        label: 'On hand',
                                        render: (sku) => (<><strong>{sku.on_hand_qty}</strong><small>{t('on hand')}</small></>),
                                    },
                                    {
                                        key: 'retail',
                                        label: 'Retail',
                                        render: (sku) => (<><strong>{sku.retail_price ?? sku.price ?? '-'}</strong><small>{t('retail')}</small></>),
                                    },
                                ]}
                            />
                        </>
                    )}

                    {receiptStep === 'details' && (
                        <>
                            <PanelHeading eyebrow={t(stepMeta.eyebrow)} title={t(stepMeta.title)} action={<small className="muted">{t('Original, wholesale, and retail prices update the SKU.')}</small>} />
                            <div className="wizard-qty-table" style={{ '--wizard-qty-fields': 4, '--wizard-qty-unit': '120px' }}>
                                {lineCount > 0 && (
                                    <div className="wizard-qty-list-head" aria-hidden="true">
                                        <span>{t('Product / SKU')}</span>
                                        <span>{t('Received')}</span>
                                        <span>{t('Original price')}</span>
                                        <span>{t('Wholesale price')}</span>
                                        <span>{t('Retail price')}</span>
                                        <span>{t('Action')}</span>
                                    </div>
                                )}
                                <div className="receipt-price-lines wizard-console-lines">
                                    {lineCount === 0 ? <div className="empty-document-lines">{t('Select products before entering quantities.')}</div> : form.data.items.map((item, index) => (
                                    <div className="receipt-price-line has-remove wizard-console-line" key={item.sku_id}>
                                        <ProductIdentity sku={item.sku} showBarcode={false} />
                                        <label className="form-field"><span>{t('Received')}</span><input type="number" min="1" value={item.received_quantity} onChange={(event) => updateItem(index, { received_quantity: event.target.value })} required /></label>
                                        <label className="form-field"><span>{t('Original price')}</span><input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => updateItem(index, { unit_cost: event.target.value })} /></label>
                                        <label className="form-field"><span>{t('Wholesale price')}</span><input type="number" min="0" step="0.01" value={item.wholesale_price} onChange={(event) => updateItem(index, { wholesale_price: event.target.value })} /></label>
                                        <label className="form-field"><span>{t('Retail price')}</span><input type="number" min="0" step="0.01" value={item.retail_price} onChange={(event) => updateItem(index, { retail_price: event.target.value })} /></label>
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

                    {receiptStep === 'review' && (
                        <>
                            <PanelHeading eyebrow={t(stepMeta.eyebrow)} title={t(stepMeta.title)} />
                            <div className="metrics-grid compact" style={{ marginBottom: 14 }}>
                                <Stat label="Warehouse" value={selectedLocation?.name || '-'} />
                                <Stat label="Supplier / reference" value={form.data.supplier_reference?.trim() || t('None')} />
                                <Stat label="Lines" value={lineCount} />
                                <Stat label="Units" value={totalUnits} />
                                <Stat label="Note" value={form.data.notes?.trim() || t('None')} />
                            </div>
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>{t('SKU')}</th>
                                            <th>{t('Received')}</th>
                                            <th>{t('Original')}</th>
                                            <th>{t('Wholesale')}</th>
                                            <th>{t('Retail')}</th>
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
                                                <td>{item.received_quantity}</td>
                                                <td>{item.unit_cost !== '' && item.unit_cost != null ? formatMoney(item.unit_cost) : '-'}</td>
                                                <td>{item.wholesale_price !== '' && item.wholesale_price != null ? formatMoney(item.wholesale_price) : '-'}</td>
                                                <td>{item.retail_price !== '' && item.retail_price != null ? formatMoney(item.retail_price) : '-'}</td>
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

    return (
        <form onSubmit={submit}>
            {Object.keys(form.errors).length > 0 && <div className="flash error">{Object.values(form.errors).map((error) => <div key={error}>{error}</div>)}</div>}
            <div className="inventory-document-layout">
                <section className="panel glass inventory-lines-panel">
                    <PanelHeading eyebrow="Items" title={isReceipt ? 'Received stock' : 'Counted stock'} />
                    <div className="sku-search-row">
                        <div className="search-box"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} placeholder={t('Scan barcode or search SKU')} /></div>
                        <button className="btn secondary" type="button" onClick={search} disabled={searching}>{t(searching ? 'Searching...' : 'Search')}</button>
                    </div>
                    {results.length > 0 && <div className="sku-search-results">{results.map((sku) => <button type="button" key={sku.id} onClick={() => addSku(sku)}><span><strong>{sku.product_name}</strong><small>{sku.sku_code} / {sku.barcode || t('no barcode')}</small></span><span><strong>{sku.on_hand_qty}</strong><small>{t('on hand')}</small></span></button>)}</div>}

                    <div className="document-lines">
                        {form.data.items.length === 0 ? <div className="empty-document-lines">{t('No items added.')}</div> : form.data.items.map((item, index) => {
                            const delta = Number(item.counted_quantity || 0) - Number(item.system_quantity || 0);
                            return <div className="document-line" key={item.sku_id}>
                                <div className="document-line-product"><strong>{item.sku.product_name}</strong><small>{item.sku.sku_code}</small></div>
                                <div className="line-system-qty"><span>{t('System')}</span><strong>{item.system_quantity}</strong></div>
                                <label className="form-field"><span>{t('Counted')}</span><input type="number" min="0" value={item.counted_quantity} onChange={(event) => updateItem(index, { counted_quantity: event.target.value })} required /></label>
                                <div className={delta < 0 ? 'line-delta negative' : delta > 0 ? 'line-delta positive' : 'line-delta'}><span>{t('Variance')}</span><strong>{delta > 0 ? '+' : ''}{delta}</strong></div>
                                <label className="form-field document-line-note"><span>{t('Item note')}</span><input value={item.notes} onChange={(event) => updateItem(index, { notes: event.target.value })} required={!isReceipt && delta < 0} /></label>
                                <button type="button" className="icon-btn small danger" onClick={() => form.setData('items', form.data.items.filter((_, itemIndex) => itemIndex !== index))} aria-label={t('Remove item')}><Icon name="trash" size={13} /></button>
                            </div>;
                        })}
                    </div>
                </section>

                <aside className="panel glass inventory-document-meta">
                    <PanelHeading eyebrow="Document" title={isReceipt ? 'Receipt details' : 'Adjustment details'} />
                    <label className="form-field"><span>{t('Warehouse')}</span><select value={form.data.location_id} onChange={(event) => { form.setData({ ...form.data, location_id: event.target.value, items: [] }); setResults([]); }} required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                    {isReceipt ? <label className="form-field"><span>{t('Supplier / reference')}</span><input value={form.data.supplier_reference} onChange={(event) => form.setData('supplier_reference', event.target.value)} /></label> : <label className="form-field"><span>{t('Reason')}</span><select value={form.data.reason_code} onChange={(event) => form.setData('reason_code', event.target.value)}>{reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>}
                    <label className="form-field"><span>{t('Document note')}</span><textarea rows="4" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /></label>
                    <div className="document-impact"><span>{t('Lines')}</span><strong>{form.data.items.length}</strong>{!isReceipt && <><span>{t('Total variance')}</span><strong>{form.data.items.reduce((sum, item) => sum + Number(item.counted_quantity || 0) - Number(item.system_quantity || 0), 0)}</strong></>}</div>
                    <button className="btn primary full-width" type="submit" disabled={form.processing || form.data.items.length === 0}><Icon name="check" size={14} /> {t(submitLabel)}</button>
                </aside>
            </div>
        </form>
    );
}
