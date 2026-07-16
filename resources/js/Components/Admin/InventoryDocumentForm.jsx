import { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm, usePage } from '@inertiajs/react';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';

const cleanPaginationLabel = (label = '') =>
    label.includes('&laquo;')
        ? 'Previous'
        : label.includes('&raquo;')
            ? 'Next'
            : label.replace(/&amp;/g, '&');

export default function InventoryDocumentForm({ type, locations, categories = [], reasons = [], initialData = null, submitUrl = null, submitMethod = 'post', submitLabel = 'Save draft' }) {
    const { app_base, app_url } = usePage().props;
    const [query, setQuery] = useState('');
    const [categoryId, setCategoryId] = useState('all');
    const [results, setResults] = useState([]);
    const [skuPage, setSkuPage] = useState({ data: [], current_page: 1, last_page: 1, total: 0, from: 0, to: 0, links: [] });
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
        { key: 'basic', eyebrow: 'Tab 1', title: 'Basic information' },
        { key: 'products', eyebrow: 'Tab 2', title: 'Select products' },
        { key: 'details', eyebrow: 'Tab 3', title: 'Quantities & prices' },
    ];
    const [receiptStep, setReceiptStep] = useState('basic');

    const search = async (page = 1) => {
        if (!form.data.location_id) return;
        setSearching(true);
        try {
            const params = { q: query, location_id: form.data.location_id };
            if (isReceipt) {
                params.paginated = 1;
                params.page = page;
                params.per_page = 8;
                if (categoryId !== 'all') params.category_id = categoryId;
            }
            const response = await axios.get(routeWithBase('/admin/inventory/skus/search', app_base), { params });
            if (isReceipt) {
                setSkuPage(response.data);
            } else {
                setResults(response.data);
            }
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        if (isReceipt && receiptStep === 'products') {
            search(1);
        }
    }, [isReceipt, receiptStep, categoryId, form.data.location_id]);

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
        event.preventDefault();
        form.transform((data) => ({ ...data, items: data.items.map(({ sku, system_quantity, ...item }) => item) }));
        const url = submitUrl || routeWithBase(isReceipt ? '/admin/inventory/receipts' : '/admin/inventory/adjustments', app_base);
        if (submitMethod.toLowerCase() === 'put') {
            form.put(url);
        } else {
            form.post(url);
        }
    };

    const lineCount = form.data.items.length;
    const totalReceived = form.data.items.reduce((sum, item) => sum + Number(item.received_quantity || 0), 0);
    const receiptStepIndex = receiptSteps.findIndex((step) => step.key === receiptStep);
    const selectedSkuIds = form.data.items.map((item) => item.sku_id);
    const selectedLocation = locations.find((location) => String(location.id) === String(form.data.location_id));
    const receiptCatalogSkus = isReceipt
        ? [
            ...form.data.items.map((item) => item.sku).filter(Boolean),
            ...skuPage.data.filter((sku) => !selectedSkuIds.includes(sku.id)),
        ]
        : [];
    const goReceiptStep = (offset) => {
        const next = receiptSteps[Math.min(Math.max(receiptStepIndex + offset, 0), receiptSteps.length - 1)]?.key;
        if (next) setReceiptStep(next);
    };

    const handleReceiptSubmit = (event) => {
        event.preventDefault();
        if (receiptStep === 'details') {
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
        submit(event);
    };

    const removeSku = (skuId) => {
        form.setData('items', form.data.items.filter((line) => line.sku_id !== skuId));
    };

    const SkuThumbnail = ({ sku }) => {
        const imagePath = sku?.image_path || sku?.product_image_path;

        return (
            <span className="receipt-product-thumb" aria-hidden="true">
                {imagePath ? <img src={storageUrl(imagePath, app_url)} alt="" /> : <Icon name="box" size={16} />}
            </span>
        );
    };

    const ProductIdentity = ({ sku, showBarcode = true }) => (
        <div className="line-product-identity">
            <SkuThumbnail sku={sku} />
            <span>
                <strong>{sku.product_name}</strong>
                <small>{sku.sku_code}{showBarcode ? ` / ${sku.barcode || 'no barcode'}` : ''}</small>
            </span>
        </div>
    );

    if (isReceipt) {
        return (
            <form onSubmit={handleReceiptSubmit} className="receipt-wizard">
                {Object.keys(form.errors).length > 0 && <div className="flash error">{Object.values(form.errors).map((error) => <div key={error}>{error}</div>)}</div>}

                <nav className="receipt-wizard-tabs" aria-label="Receipt form steps">
                    {receiptSteps.map((step, index) => {
                        const active = receiptStep === step.key;
                        const complete = index < receiptStepIndex;
                        return (
                            <button type="button" key={step.key} className={active ? 'active' : complete ? 'complete' : ''} onClick={() => setReceiptStep(step.key)}>
                                <span className="receipt-step-circle">{index + 1}</span>
                                <strong>{step.title}</strong>
                            </button>
                        );
                    })}
                </nav>

                <div className="receipt-wizard-topbar">
                    <div className="receipt-summary-strip" aria-label="Receipt summary">
                        <span><small>Warehouse</small><strong>{selectedLocation?.code || '-'}</strong></span>
                        <span><small>Lines</small><strong>{lineCount}</strong></span>
                        <span><small>Units</small><strong>{totalReceived}</strong></span>
                        <span><small>Reference</small><strong>{form.data.supplier_reference || '-'}</strong></span>
                    </div>
                    <div className="receipt-wizard-actions">
                        <button type="button" className="btn secondary" onClick={() => goReceiptStep(-1)} disabled={receiptStepIndex === 0}>Back</button>
                        <button
                            type="button"
                            className="btn primary"
                            onClick={handleReceiptNext}
                            disabled={(receiptStep === 'products' || receiptStep === 'details') && lineCount === 0}
                        >
                            Next
                        </button>
                    </div>
                </div>

                <div className="receipt-wizard-shell">
                    <section className="panel glass receipt-wizard-panel">
                        {receiptStep === 'basic' && (
                            <>
                                <PanelHeading eyebrow="Receiving document" title="Basic information" action={<small className="muted">Choose where this stock is arriving.</small>} />
                                <div className="receipt-basic-grid">
                                    <label className="form-field">
                                        <span>Warehouse</span>
                                        <select value={form.data.location_id} onChange={(event) => { form.setData({ ...form.data, location_id: event.target.value, items: [] }); setResults([]); }} required>
                                            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Supplier / reference</span>
                                        <input value={form.data.supplier_reference} onChange={(event) => form.setData('supplier_reference', event.target.value)} placeholder="Invoice, PO, or supplier name" />
                                    </label>
                                    <label className="form-field receipt-wide-field">
                                        <span>Document note</span>
                                        <textarea rows="5" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} placeholder="Receiving notes, delivery condition, or internal comments" />
                                    </label>
                                </div>
                            </>
                        )}

                        {receiptStep === 'products' && (
                            <>
                                <PanelHeading eyebrow="Product selection" title="Select the products" action={<small className="muted">{lineCount} selected</small>} />
                                <div className="receipt-product-toolbar">
                                    <div className="search-box"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(1); } }} placeholder="Search product, SKU, or barcode" /></div>
                                    <label className="receipt-category-select" aria-label="Category filter">
                                        <Icon name="tag" size={14} />
                                        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                                            <option value="all">All categories</option>
                                            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                        </select>
                                    </label>
                                    <button className="btn secondary" type="button" onClick={() => search(1)} disabled={searching || !form.data.location_id}>{searching ? 'Searching...' : 'Search'}</button>
                                </div>
                                <div className="receipt-product-catalog">
                                    {receiptCatalogSkus.length === 0 ? <div className="empty-document-lines">No products match these filters.</div> : receiptCatalogSkus.map((sku) => {
                                        const selected = selectedSkuIds.includes(sku.id);
                                        return (
                                            <div key={sku.id} className={selected ? 'receipt-product-row selected' : 'receipt-product-row'}>
                                                <ProductIdentity sku={sku} />
                                                <span><strong>{sku.on_hand_qty}</strong><small>on hand</small></span>
                                                <span><strong>{sku.retail_price ?? sku.price ?? '-'}</strong><small>retail</small></span>
                                                <button type="button" className={selected ? 'receipt-product-action remove' : 'receipt-product-action'} onClick={() => selected ? removeSku(sku.id) : addSku(sku)}>
                                                    {selected ? <><Icon name="trash" size={13} /> Remove</> : 'Add'}
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                                {skuPage.last_page > 1 && (
                                    <div className="receipt-product-pagination">
                                        <small>Showing {skuPage.from || 0}-{skuPage.to || 0} of {skuPage.total || 0}</small>
                                        <div>
                                            {skuPage.links.map((link, index) => (
                                                <button
                                                    type="button"
                                                    key={`${link.label}-${index}`}
                                                    className={link.active ? 'active' : ''}
                                                    disabled={!link.url}
                                                    onClick={() => link.url && search(Number(new URL(link.url, window.location.origin).searchParams.get('page') || 1))}
                                                >
                                                    {cleanPaginationLabel(link.label)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {receiptStep === 'details' && (
                            <>
                                <PanelHeading eyebrow="Receiving lines" title="Fill quantities and prices" action={<small className="muted">Original, wholesale, and retail prices update the SKU.</small>} />
                                <div className="receipt-price-lines">
                                    {lineCount === 0 ? <div className="empty-document-lines">Select products before entering quantities.</div> : form.data.items.map((item, index) => (
                                        <div className="receipt-price-line" key={item.sku_id}>
                                            <ProductIdentity sku={item.sku} showBarcode={false} />
                                            <label className="form-field"><span>Received</span><input type="number" min="1" value={item.received_quantity} onChange={(event) => updateItem(index, { received_quantity: event.target.value })} required /></label>
                                            <label className="form-field"><span>Original price</span><input type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => updateItem(index, { unit_cost: event.target.value })} /></label>
                                            <label className="form-field"><span>Wholesale price</span><input type="number" min="0" step="0.01" value={item.wholesale_price} onChange={(event) => updateItem(index, { wholesale_price: event.target.value })} /></label>
                                            <label className="form-field"><span>Retail price</span><input type="number" min="0" step="0.01" value={item.retail_price} onChange={(event) => updateItem(index, { retail_price: event.target.value })} /></label>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </section>
                </div>
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
                        <div className="search-box"><Icon name="search" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} placeholder="Scan barcode or search SKU" /></div>
                        <button className="btn secondary" type="button" onClick={search} disabled={searching}>{searching ? 'Searching...' : 'Search'}</button>
                    </div>
                    {results.length > 0 && <div className="sku-search-results">{results.map((sku) => <button type="button" key={sku.id} onClick={() => addSku(sku)}><span><strong>{sku.product_name}</strong><small>{sku.sku_code} / {sku.barcode || 'no barcode'}</small></span><span><strong>{sku.on_hand_qty}</strong><small>on hand</small></span></button>)}</div>}

                    <div className="document-lines">
                        {form.data.items.length === 0 ? <div className="empty-document-lines">No items added.</div> : form.data.items.map((item, index) => {
                            const delta = Number(item.counted_quantity || 0) - Number(item.system_quantity || 0);
                            return <div className="document-line" key={item.sku_id}>
                                <div className="document-line-product"><strong>{item.sku.product_name}</strong><small>{item.sku.sku_code}</small></div>
                                <div className="line-system-qty"><span>System</span><strong>{item.system_quantity}</strong></div>
                                <label className="form-field"><span>Counted</span><input type="number" min="0" value={item.counted_quantity} onChange={(event) => updateItem(index, { counted_quantity: event.target.value })} required /></label>
                                <div className={delta < 0 ? 'line-delta negative' : delta > 0 ? 'line-delta positive' : 'line-delta'}><span>Variance</span><strong>{delta > 0 ? '+' : ''}{delta}</strong></div>
                                <label className="form-field document-line-note"><span>Item note</span><input value={item.notes} onChange={(event) => updateItem(index, { notes: event.target.value })} required={!isReceipt && delta < 0} /></label>
                                <button type="button" className="icon-btn small danger" onClick={() => form.setData('items', form.data.items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove item"><Icon name="trash" size={13} /></button>
                            </div>;
                        })}
                    </div>
                </section>

                <aside className="panel glass inventory-document-meta">
                    <PanelHeading eyebrow="Document" title={isReceipt ? 'Receipt details' : 'Adjustment details'} />
                    <label className="form-field"><span>Warehouse</span><select value={form.data.location_id} onChange={(event) => { form.setData({ ...form.data, location_id: event.target.value, items: [] }); setResults([]); }} required>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
                    {isReceipt ? <label className="form-field"><span>Supplier / reference</span><input value={form.data.supplier_reference} onChange={(event) => form.setData('supplier_reference', event.target.value)} /></label> : <label className="form-field"><span>Reason</span><select value={form.data.reason_code} onChange={(event) => form.setData('reason_code', event.target.value)}>{reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}</select></label>}
                    <label className="form-field"><span>Document note</span><textarea rows="4" value={form.data.notes} onChange={(event) => form.setData('notes', event.target.value)} /></label>
                    <div className="document-impact"><span>Lines</span><strong>{form.data.items.length}</strong>{!isReceipt && <><span>Total variance</span><strong>{form.data.items.reduce((sum, item) => sum + Number(item.counted_quantity || 0) - Number(item.system_quantity || 0), 0)}</strong></>}</div>
                    <button className="btn primary full-width" type="submit" disabled={form.processing || form.data.items.length === 0}><Icon name="check" size={14} /> {submitLabel}</button>
                </aside>
            </div>
        </form>
    );
}
