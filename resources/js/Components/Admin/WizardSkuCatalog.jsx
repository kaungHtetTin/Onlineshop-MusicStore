import { useCallback, useEffect, useRef, useState } from 'react';
import { usePage } from '@/spa/router';
import Icon from '@/Components/Admin/icons';
import { storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export function SkuThumbnail({ sku }) {
    const { app_url } = usePage().props;
    const imagePath = sku?.image_path || sku?.product_image_path;

    return (
        <span className="receipt-product-thumb" aria-hidden="true">
            {imagePath ? <img src={storageUrl(imagePath, app_url)} alt="" /> : <Icon name="box" size={16} />}
        </span>
    );
}

export function ProductIdentity({ sku, showBarcode = true }) {
    const t = usePhraseTranslation();

    return (
        <div className="line-product-identity">
            <SkuThumbnail sku={sku} />
            <span>
                <strong>{sku.product_name}</strong>
                <small>
                    {sku.sku_code}
                    {showBarcode ? ` / ${sku.barcode || t('no barcode')}` : ''}
                </small>
            </span>
        </div>
    );
}

/**
 * Shared wizard SKU picker: search + category + checkbox rows + endless scroll.
 *
 * fetchPage({ q, categoryId, page, perPage }) =>
 *   Promise<{ data, current_page, last_page, total }>
 */
export default function WizardSkuCatalog({
    categories = [],
    selectedSkus = [],
    selectedSkuIds = [],
    onToggle,
    isDisabled = () => false,
    columns = [],
    fetchPage,
    enabled = true,
    resetKey = '',
    searchPlaceholder = 'Search product, SKU, or barcode',
    emptyLabel = 'No products match these filters.',
    perPage = 12,
    showListHead = true,
    searchDisabled = false,
    className = '',
}) {
    const t = usePhraseTranslation();
    const [query, setQuery] = useState('');
    const [categoryId, setCategoryId] = useState('all');
    const [catalog, setCatalog] = useState([]);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);
    const [searching, setSearching] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const loadLockRef = useRef(false);
    const sentinelRef = useRef(null);
    const appliedRef = useRef({ q: '', categoryId: 'all' });

    const selectedIdSet = new Set(selectedSkuIds.map(Number));
    const pinnedSkus = selectedSkus.filter(Boolean);
    const catalogIdSet = new Set(catalog.map((sku) => Number(sku.id)));
    const pinnedSkusOutsideCatalog = pinnedSkus.filter((sku) => !catalogIdSet.has(Number(sku.id)));
    const visibleSkus = [...pinnedSkusOutsideCatalog, ...catalog];
    const hasMore = page < lastPage;

    const runFetch = useCallback(async (nextPage, { append, q, categoryId: cat }) => {
        if (!fetchPage || loadLockRef.current) return;
        loadLockRef.current = true;
        if (append) setLoadingMore(true);
        else setSearching(true);

        try {
            const response = await fetchPage({
                q,
                categoryId: cat,
                page: nextPage,
                perPage,
            });
            const rows = Array.isArray(response?.data) ? response.data : [];
            setCatalog((prev) => (append ? [...prev, ...rows] : rows));
            setPage(Number(response?.current_page || nextPage));
            setLastPage(Number(response?.last_page || 1));
            setTotal(Number(response?.total || rows.length));
        } finally {
            loadLockRef.current = false;
            setSearching(false);
            setLoadingMore(false);
        }
    }, [fetchPage, perPage]);

    const search = useCallback((nextPage = 1) => {
        const q = query;
        const cat = categoryId;
        appliedRef.current = { q, categoryId: cat };
        return runFetch(nextPage, { append: false, q, categoryId: cat });
    }, [query, categoryId, runFetch]);

    const loadMore = useCallback(() => {
        if (!hasMore || searching || loadingMore || loadLockRef.current) return;
        const { q, categoryId: cat } = appliedRef.current;
        return runFetch(page + 1, { append: true, q, categoryId: cat });
    }, [hasMore, searching, loadingMore, page, runFetch]);

    useEffect(() => {
        if (!enabled) return;
        setQuery('');
        setCategoryId('all');
        appliedRef.current = { q: '', categoryId: 'all' };
        runFetch(1, { append: false, q: '', categoryId: 'all' });
    }, [enabled, resetKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const node = sentinelRef.current;
        if (!node || !enabled || !hasMore) return undefined;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    loadMore();
                }
            },
            { root: node.parentElement, rootMargin: '120px', threshold: 0 },
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, [enabled, hasMore, loadMore, visibleSkus.length, searching]);

    const columnCount = 1 + columns.length + 1;

    return (
        <div className={`wizard-sku-catalog ${className}`.trim()} style={{ '--wizard-sku-columns': columnCount }}>
            <div className="receipt-product-toolbar">
                <div className="search-box">
                    <Icon name="search" size={15} />
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                search(1);
                            }
                        }}
                        placeholder={t(searchPlaceholder)}
                        disabled={searchDisabled}
                    />
                </div>
                <label className="receipt-category-select" aria-label={t('Category filter')}>
                    <Icon name="tag" size={14} />
                    <select
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        disabled={searchDisabled}
                    >
                        <option value="all">{t('All categories')}</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.name}</option>
                        ))}
                    </select>
                </label>
                <button
                    className="btn secondary"
                    type="button"
                    onClick={() => search(1)}
                    disabled={searching || searchDisabled}
                >
                    {t(searching && catalog.length === 0 ? 'Searching...' : 'Search')}
                </button>
            </div>

            {showListHead && !searching && visibleSkus.length > 0 && (
                <div className="wizard-sku-list-head" aria-hidden="true">
                    <span>{t('Product / SKU')}</span>
                    {columns.map((column) => (
                        <span key={column.key}>{t(column.label || column.key)}</span>
                    ))}
                    <span>{t('Select')}</span>
                </div>
            )}

            <div
                className="receipt-product-catalog wizard-sku-catalog-scroll wizard-console-frame"
                aria-busy={searching}
            >
                {searching && catalog.length === 0 ? (
                    <div className="spa-inline-list-skeleton" role="status" aria-label={t('Loading products')}>
                        {Array.from({ length: 6 }, (_, index) => (
                            <div className="spa-inline-list-skeleton-row" key={index}>
                                <span className="spa-skeleton-block media" />
                                <span className="spa-skeleton-block line" />
                                <span className="spa-skeleton-block line short" />
                                <span className="spa-skeleton-block button" />
                            </div>
                        ))}
                    </div>
                ) : visibleSkus.length === 0 ? (
                    <div className="empty-document-lines">{t(emptyLabel)}</div>
                ) : (
                    visibleSkus.map((sku) => {
                        const selected = selectedIdSet.has(Number(sku.id));
                        const disabled = isDisabled(sku);
                        return (
                            <label
                                key={sku.id}
                                className={selected ? 'receipt-product-row selected wizard-sku-row' : 'receipt-product-row wizard-sku-row'}
                            >
                                <ProductIdentity sku={sku} />
                                {columns.map((column) => (
                                    <span key={column.key}>{column.render(sku)}</span>
                                ))}
                                <span className="wizard-sku-check">
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        disabled={disabled}
                                        onChange={() => {
                                            if (disabled) return;
                                            onToggle(sku, !selected);
                                        }}
                                    />
                                </span>
                            </label>
                        );
                    })
                )}

                {hasMore && (
                    <div ref={sentinelRef} className="wizard-sku-load-sentinel" aria-hidden="true" />
                )}
                {loadingMore && (
                    <div className="wizard-sku-loading-more muted" role="status">{t('Loading more...')}</div>
                )}
                {!searching && !loadingMore && total > 0 && (
                    <small className="wizard-sku-count muted">
                        {t('Showing')} {Math.min(catalog.length, total)} {t('of')} {total}
                    </small>
                )}
            </div>
        </div>
    );
}
