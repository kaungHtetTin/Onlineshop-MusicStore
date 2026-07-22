import { useEffect, useMemo, useState } from 'react';
import { Head, router } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const code128Patterns = [
    '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
    '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
    '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
    '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
    '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
    '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
    '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
    '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
    '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
    '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
    '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

const money = (value) =>
    Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

function code128Values(value) {
    const text = String(value || '');
    const values = [104];

    for (const char of text) {
        const code = char.charCodeAt(0);
        values.push(code >= 32 && code <= 127 ? code - 32 : 0);
    }

    const checksum = values.reduce((sum, code, index) => sum + (index === 0 ? code : code * index), 0) % 103;
    return [...values, checksum, 106];
}

function BarcodeSvg({ value }) {
    const bars = useMemo(() => {
        let x = 10;
        const rects = [];

        code128Values(value).forEach((code) => {
            const pattern = code128Patterns[code];
            [...pattern].forEach((width, index) => {
                const moduleWidth = Number(width);
                if (index % 2 === 0) {
                    rects.push({ x, width: moduleWidth });
                }
                x += moduleWidth;
            });
        });

        return { rects, width: x + 10 };
    }, [value]);

    return (
        <svg className="barcode-svg" viewBox={`0 0 ${bars.width} 42`} preserveAspectRatio="none" role="img" aria-label={value}>
            {bars.rects.map((rect, index) => (
                <rect key={`${rect.x}-${index}`} x={rect.x} y="0" width={rect.width} height="42" />
            ))}
        </svg>
    );
}

function skuVariantText(sku) {
    const values = Object.values(sku.attributes || {}).filter((value) => value != null && String(value).trim() !== '');
    return values.length > 0 ? values.join(' / ') : 'Default';
}

function BarcodeLabel({ sku }) {
    return (
        <div className="barcode-label">
            <div className="barcode-label-head">
                <strong>{sku.product?.name || '-'}</strong>
                <span>{money(sku.price)}</span>
            </div>
            <small>{sku.sku_code} / {skuVariantText(sku)}</small>
            <BarcodeSvg value={sku.barcode} />
            <b>{sku.barcode}</b>
        </div>
    );
}

export default function Barcodes({ skus, categories, filters, app_base }) {
    const t = usePhraseTranslation();
    const skuRows = skus.data || [];
    const [filterState, setFilterState] = useState({
        q: filters.q || '',
        category_id: filters.category_id || '',
        product_status: filters.product_status || 'all',
        sku_status: filters.sku_status || 'all',
        per_page: filters.per_page || 25,
    });
    const [selected, setSelected] = useState({});
    const [copies, setCopies] = useState({});

    useEffect(() => {
        document.body.classList.add('barcode-print-mode');
        return () => document.body.classList.remove('barcode-print-mode');
    }, []);

    const selectedSkus = useMemo(() => Object.values(selected), [selected]);
    const printItems = useMemo(() => selectedSkus.flatMap((sku) => {
        const count = Math.max(1, Number(copies[sku.id] || 1));
        return Array.from({ length: count }, (_, index) => ({ sku, key: `${sku.id}-${index}` }));
    }), [copies, selectedSkus]);

    const applyFilters = (event) => {
        event.preventDefault();
        router.get(routeWithBase('/admin/products/barcodes', app_base), filterState, { preserveState: true, replace: true });
    };

    const resetFilters = () => {
        router.get(routeWithBase('/admin/products/barcodes', app_base));
    };

    const toggleSku = (sku) => {
        setSelected((current) => {
            const next = { ...current };
            if (next[sku.id]) {
                delete next[sku.id];
            } else {
                next[sku.id] = sku;
            }
            return next;
        });
        setCopies((current) => ({ ...current, [sku.id]: current[sku.id] || 1 }));
    };

    const selectVisible = () => {
        setSelected((current) => ({
            ...current,
            ...Object.fromEntries(skuRows.map((sku) => [sku.id, sku])),
        }));
        setCopies((current) => ({
            ...current,
            ...Object.fromEntries(skuRows.map((sku) => [sku.id, current[sku.id] || 1])),
        }));
    };

    return (
        <AdminLayout
            title={t('Barcode printing')}
            eyebrow={t('Catalog')}
            contentClassName="barcode-print-page"
            action={
                <button type="button" className="btn primary no-print" onClick={() => window.print()} disabled={printItems.length === 0}>
                    <Icon name="download" size={14} />
                    {t('Print labels')}
                </button>
            }
        >
            <Head title={t('Barcode Printing')} />

            <section className="panel glass no-print">
                <PanelHeading eyebrow={t('SKU labels')} title={t('Filter barcode list')} />
                <form className="filter-toolbar barcode-filter" onSubmit={applyFilters}>
                    <div className="barcode-filter-search">
                        <label className="search-box">
                            <Icon name="search" size={14} />
                            <input
                                value={filterState.q}
                                onChange={(event) => setFilterState({ ...filterState, q: event.target.value })}
                                placeholder={t('Search product, SKU, or barcode...')}
                            />
                        </label>
                    </div>
                    <div className="barcode-filter-controls">
                        <select value={filterState.category_id} onChange={(event) => setFilterState({ ...filterState, category_id: event.target.value })}>
                            <option value="">{t('All categories')}</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                        </select>
                        <select value={filterState.product_status} onChange={(event) => setFilterState({ ...filterState, product_status: event.target.value })}>
                            <option value="all">{t('All products')}</option>
                            <option value="active">{t('Active products')}</option>
                            <option value="inactive">{t('Inactive products')}</option>
                            <option value="draft">{t('Draft products')}</option>
                        </select>
                        <select value={filterState.sku_status} onChange={(event) => setFilterState({ ...filterState, sku_status: event.target.value })}>
                            <option value="all">{t('All SKUs')}</option>
                            <option value="active">{t('Active SKUs')}</option>
                            <option value="inactive">{t('Inactive SKUs')}</option>
                        </select>
                        <select value={filterState.per_page} onChange={(event) => setFilterState({ ...filterState, per_page: Number(event.target.value) })}>
                            <option value="10">{t('10 per page')}</option>
                            <option value="25">{t('25 per page')}</option>
                            <option value="50">{t('50 per page')}</option>
                            <option value="100">{t('100 per page')}</option>
                        </select>
                        <button type="submit" className="btn primary">{t('Search')}</button>
                        <button type="button" className="btn secondary" onClick={resetFilters}>{t('Reset')}</button>
                    </div>
                </form>
            </section>

            <section className="panel glass no-print">
                <PanelHeading
                    eyebrow={`${selectedSkus.length} ${t('selected')}`}
                    title={t('SKU barcode list')}
                    action={
                        <div className="inline-actions">
                            <button type="button" className="btn secondary" onClick={selectVisible}>{t('Select visible')}</button>
                            <button type="button" className="btn secondary" onClick={() => setSelected({})}>{t('Clear')}</button>
                        </div>
                    }
                />
                <div className="table-wrap barcode-sku-table">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Print')}</th>
                                <th>{t('Product / SKU')}</th>
                                <th>{t('Category')}</th>
                                <th>{t('Barcode')}</th>
                                <th>{t('Retail price')}</th>
                                <th>{t('Copies')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {skuRows.length === 0 ? (
                                <tr><td colSpan={6}><span className="muted">{t('No SKUs match these filters.')}</span></td></tr>
                            ) : skuRows.map((sku) => (
                                <tr key={sku.id}>
                                    <td>
                                        <input type="checkbox" checked={!!selected[sku.id]} onChange={() => toggleSku(sku)} />
                                    </td>
                                    <td>
                                        <strong>{sku.product?.name || '-'}</strong>
                                        <small>{sku.sku_code} / {skuVariantText(sku)}</small>
                                    </td>
                                    <td>{sku.category?.name || '-'}</td>
                                    <td><strong>{sku.barcode}</strong></td>
                                    <td>{money(sku.price)}</td>
                                    <td>
                                        <input
                                            className="barcode-copy-input"
                                            type="number"
                                            min="1"
                                            value={copies[sku.id] || 1}
                                            onChange={(event) => setCopies({ ...copies, [sku.id]: event.target.value })}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={skus} label={t('SKUs')} />
            </section>

            <div className="barcode-print-sheet" aria-hidden={printItems.length === 0}>
                {printItems.map((item) => <BarcodeLabel key={item.key} sku={item.sku} />)}
            </div>
        </AdminLayout>
    );
}
