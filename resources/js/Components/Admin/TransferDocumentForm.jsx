import { useEffect, useState } from 'react';
import axios from 'axios';
import { useForm, usePage } from '@/spa/router';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const cleanPaginationLabel = (label = '') =>
    label.includes('&laquo;')
        ? 'Previous'
        : label.includes('&raquo;')
            ? 'Next'
            : label.replace(/&amp;/g, '&');

export default function TransferDocumentForm({ locations, categories = [] }) {
    const { app_base, app_url } = usePage().props;
    const t = usePhraseTranslation();
    const firstSource = locations[0]?.id || '';
    const firstDestination = locations.find((location) => String(location.id) !== String(firstSource))?.id || '';
    const [query, setQuery] = useState('');
    const [categoryId, setCategoryId] = useState('all');
    const [searching, setSearching] = useState(false);
    const [skuPage, setSkuPage] = useState({ data: [], current_page: 1, last_page: 1, total: 0, from: 0, to: 0, links: [] });
    const [step, setStep] = useState('route');
    const form = useForm({
        source_location_id: firstSource,
        destination_location_id: firstDestination,
        items: [],
    });

    const steps = [
        { key: 'route', title: 'Transfer route' },
        { key: 'products', title: 'Select products' },
        { key: 'details', title: 'Quantities & review' },
    ];
    const stepIndex = steps.findIndex((item) => item.key === step);
    const source = locations.find((location) => String(location.id) === String(form.data.source_location_id));
    const destination = locations.find((location) => String(location.id) === String(form.data.destination_location_id));
    const destinationOptions = locations.filter((location) => String(location.id) !== String(form.data.source_location_id));
    const selectedSkuIds = form.data.items.map((item) => item.sku_id);
    const catalogSkus = [
        ...form.data.items.map((item) => item.sku).filter(Boolean),
        ...skuPage.data.filter((sku) => !selectedSkuIds.includes(sku.id)),
    ];
    const lineCount = form.data.items.length;
    const totalUnits = form.data.items.reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0);
    const canContinue = step === 'route'
        ? form.data.source_location_id && form.data.destination_location_id
        : step === 'products'
            ? lineCount > 0
            : lineCount > 0 && form.data.destination_location_id;

    const search = async (page = 1) => {
        if (!form.data.source_location_id) return;
        setSearching(true);
        try {
            const params = {
                q: query,
                location_id: form.data.source_location_id,
                paginated: 1,
                page,
                per_page: 8,
            };
            if (categoryId !== 'all') params.category_id = categoryId;
            const response = await axios.get(routeWithBase('/admin/inventory/skus/search', app_base), { params });
            setSkuPage(response.data);
        } finally {
            setSearching(false);
        }
    };

    useEffect(() => {
        if (step === 'products') {
            search(1);
        }
    }, [step, categoryId, form.data.source_location_id]);

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

    const removeSku = (skuId) => {
        form.setData('items', form.data.items.filter((line) => line.sku_id !== skuId));
    };

    const setSource = (sourceId) => {
        const nextDestination = locations.find((location) => String(location.id) !== String(sourceId));
        form.setData({
            ...form.data,
            source_location_id: sourceId,
            destination_location_id: nextDestination?.id || '',
            items: [],
        });
        setSkuPage({ data: [], current_page: 1, last_page: 1, total: 0, from: 0, to: 0, links: [] });
    };

    const goStep = (offset) => {
        const next = steps[Math.min(Math.max(stepIndex + offset, 0), steps.length - 1)]?.key;
        if (next) setStep(next);
    };

    const submit = (event) => {
        event.preventDefault();
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
        submit(event);
    };

    const SkuThumbnail = ({ sku }) => {
        const imagePath = sku?.image_path || sku?.product_image_path;

        return (
            <span className="receipt-product-thumb" aria-hidden="true">
                {imagePath ? <img src={storageUrl(imagePath, app_url)} alt="" /> : <Icon name="box" size={16} />}
            </span>
        );
    };

    const ProductIdentity = ({ sku }) => (
        <div className="line-product-identity">
            <SkuThumbnail sku={sku} />
            <span>
                <strong>{sku.product_name}</strong>
                <small>{sku.sku_code}{sku.barcode ? ` / ${sku.barcode}` : ` / ${t('no barcode')}`}</small>
            </span>
        </div>
    );

    return (
        <form onSubmit={(event) => { event.preventDefault(); if (step === 'details') submit(event); }} className="receipt-wizard">
            {Object.keys(form.errors).length > 0 && (
                <div className="flash error">
                    {Object.values(form.errors).map((error) => <div key={error}>{error}</div>)}
                </div>
            )}

            <nav className="receipt-wizard-tabs" aria-label={t('Transfer form steps')}>
                {steps.map((item, index) => {
                    const active = step === item.key;
                    const complete = index < stepIndex;
                    return (
                        <button type="button" key={item.key} className={active ? 'active' : complete ? 'complete' : ''} onClick={() => setStep(item.key)}>
                            <span className="receipt-step-circle">{index + 1}</span>
                            <strong>{t(item.title)}</strong>
                        </button>
                    );
                })}
            </nav>

            <div className="receipt-wizard-topbar">
                <div className="receipt-summary-strip" aria-label={t('Transfer summary')}>
                    <span><small>{t('Source')}</small><strong>{source?.code || '-'}</strong></span>
                    <span><small>{t('Destination')}</small><strong>{destination?.code || '-'}</strong></span>
                    <span><small>{t('Lines')}</small><strong>{lineCount}</strong></span>
                    <span><small>{t('Units')}</small><strong>{totalUnits}</strong></span>
                </div>
                <div className="receipt-wizard-actions">
                    <button type="button" className="btn secondary" onClick={() => goStep(-1)} disabled={stepIndex === 0}>{t('Back')}</button>
                    <button type="button" className="btn primary" onClick={next} disabled={!canContinue || form.processing}>
                        {t(step === 'details' ? 'Transfer stock' : 'Next')}
                    </button>
                </div>
            </div>

            <div className="receipt-wizard-shell">
                <section className="panel glass receipt-wizard-panel">
                    {step === 'route' && (
                        <>
                                <PanelHeading eyebrow="Transfer route" title="Choose the warehouses" action={<small className="muted">{t('Stock moves immediately when submitted.')}</small>} />
                                <div className="receipt-basic-grid">
                                    <label className="form-field">
                                        <span>{t('Source warehouse')}</span>
                                    <select value={form.data.source_location_id} onChange={(event) => setSource(event.target.value)} required>
                                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                                    </select>
                                </label>
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
                            <PanelHeading eyebrow="Product selection" title="Select products from source" action={<small className="muted">{lineCount} {t('selected')}</small>} />
                            <div className="receipt-product-toolbar">
                                <div className="search-box">
                                    <Icon name="search" size={15} />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); search(1); } }}
                                        placeholder={t('Search product, SKU, or barcode')}
                                    />
                                </div>
                                <label className="receipt-category-select" aria-label={t('Category filter')}>
                                    <Icon name="tag" size={14} />
                                    <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                                        <option value="all">{t('All categories')}</option>
                                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                    </select>
                                </label>
                                <button className="btn secondary" type="button" onClick={() => search(1)} disabled={searching || !form.data.source_location_id}>
                                    {t(searching ? 'Searching...' : 'Search')}
                                </button>
                            </div>

                            <div className="receipt-product-catalog">
                                {catalogSkus.length === 0 ? <div className="empty-document-lines">{t('No products match these filters.')}</div> : catalogSkus.map((sku) => {
                                    const selected = selectedSkuIds.includes(sku.id);
                                    return (
                                        <div key={sku.id} className={selected ? 'receipt-product-row selected' : 'receipt-product-row'}>
                                            <ProductIdentity sku={sku} />
                                            <span><strong>{sku.on_hand_qty}</strong><small>{t('on hand')}</small></span>
                                            <span><strong>{sku.available_qty}</strong><small>{t('available')}</small></span>
                                            <button type="button" className={selected ? 'receipt-product-action remove' : 'receipt-product-action'} onClick={() => selected ? removeSku(sku.id) : addSku(sku)}>
                                                {selected ? <><Icon name="trash" size={13} /> {t('Remove')}</> : t('Add')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {skuPage.last_page > 1 && (
                                <div className="receipt-product-pagination">
                                    <small>{t('Showing')} {skuPage.from || 0}-{skuPage.to || 0} {t('of')} {skuPage.total || 0}</small>
                                    <div>
                                        {skuPage.links.map((link, index) => (
                                            <button
                                                type="button"
                                                key={`${link.label}-${index}`}
                                                className={link.active ? 'active' : ''}
                                                disabled={!link.url}
                                                onClick={() => link.url && search(Number(new URL(link.url, window.location.origin).searchParams.get('page') || 1))}
                                            >
                                                {t(cleanPaginationLabel(link.label))}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {step === 'details' && (
                        <>
                            <PanelHeading eyebrow="Transfer lines" title="Fill quantities and review" action={<small className="muted">{t('Requested quantity cannot exceed source availability.')}</small>} />
                            <div className="receipt-price-lines">
                                {lineCount === 0 ? <div className="empty-document-lines">{t('Select products before entering quantities.')}</div> : form.data.items.map((item, index) => (
                                    <div className="receipt-price-line transfer-price-line" key={item.sku_id}>
                                        <ProductIdentity sku={item.sku} />
                                        <div className="transfer-line-control transfer-available-pill">
                                            <span>{t('Available')}</span>
                                            <strong>{item.sku.available_qty}</strong>
                                        </div>
                                        <label className="transfer-line-control transfer-qty-control">
                                            <span>{t('Requested')}</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max={item.sku.available_qty}
                                                value={item.requested_quantity}
                                                onChange={(event) => updateItem(index, { requested_quantity: event.target.value })}
                                                required
                                            />
                                        </label>
                                        <button type="button" className="icon-btn small danger" onClick={() => removeSku(item.sku_id)} aria-label={t('Remove item')}>
                                            <Icon name="trash" size={13} />
                                        </button>
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
