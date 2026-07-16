import { useEffect, useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';

export default function InventoryIndex({ balances, locations, categories, filters, can, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base, app_url } = usePage().props;
    const [query, setQuery] = useState(filters.q || '');
    const [updatedAt, setUpdatedAt] = useState(lastUpdated);
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({
        locationIds: locations.map((location) => location.id),
        includeAll: can.realtimeAll,
        only: ['balances', 'lastUpdated'],
        pollIntervalMs,
        listenBalance: true,
        listenTransfers: true,
    });

    useEffect(() => {
        setUpdatedAt(lastUpdated);
    }, [lastUpdated]);

    const applyFilters = (patch = {}) => {
        router.get(routeWithBase('/admin/inventory', app_base), { ...filters, q: query, ...patch }, { preserveState: true, replace: true });
    };

    return (
        <AdminLayout
            title="Inventory"
            eyebrow="Stock control"
            action={
                <div className="inline-actions">
                    {can.transfer && <Link className="btn secondary" href={routeWithBase('/admin/inventory/transfers/create', app_base)}><Icon name="truck" size={14} /> Transfer</Link>}
                    {can.receive && <Link className="btn primary" href={routeWithBase('/admin/inventory/receipts/create', app_base)}><Icon name="plus" size={14} /> Receive</Link>}
                </div>
            }
        >
            <Head title="Inventory" />
            <section className="panel glass">
                <PanelHeading
                    eyebrow="Live balances"
                    title="Stock by warehouse"
                    action={<small className="muted">Realtime {realtimeState} · Updated {new Date(lastEventAt || updatedAt).toLocaleTimeString()}</small>}
                />
                <div className="inventory-filterbar">
                    <div className="search-box">
                        <Icon name="search" size={15} />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && applyFilters()} placeholder="Product, SKU, or barcode" />
                    </div>
                    <select value={filters.location} onChange={(event) => applyFilters({ location: event.target.value })}>
                        <option value="all">All warehouses</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                    </select>
                    <select value={filters.category} onChange={(event) => applyFilters({ category: event.target.value })}>
                        <option value="all">All categories</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                    <label><input type="checkbox" checked={filters.out_of_stock} onChange={(event) => applyFilters({ out_of_stock: event.target.checked })} /> Out of stock</label>
                    <button type="button" className="icon-btn" onClick={() => applyFilters()} aria-label="Search"><Icon name="search" size={15} /></button>
                    <a className="icon-btn" href={routeWithBase('/admin/inventory/export', app_base)} aria-label="Export balances" title="Export balances"><Icon name="download" size={15} /></a>
                </div>

                <div className="table-wrap">
                    <table className="data-table inventory-table">
                        <thead><tr><th>Image</th><th>Product / SKU</th><th>Warehouse</th><th>On hand</th><th>Reserved</th><th>Available</th><th>Reorder</th><th>Status</th><th /></tr></thead>
                        <tbody>
                            {balances.data.length === 0 ? (
                                <tr><td colSpan="9" className="empty-table-cell">No variants match these filters.</td></tr>
                            ) : balances.data.map((balance) => {
                                const available = balance.on_hand_qty - balance.reserved_qty;
                                const status = available <= 0 ? 'danger' : available <= balance.reorder_point ? 'warning' : 'success';
                                const imagePath = balance.sku?.image_path || balance.sku?.product?.primary_image_path;
                                return (
                                    <tr key={balance.id}>
                                        <td>
                                            <div className="inventory-image-cell">
                                                {imagePath ? (
                                                    <img src={storageUrl(imagePath, app_url)} alt="" />
                                                ) : (
                                                    <Icon name="box" size={17} />
                                                )}
                                            </div>
                                        </td>
                                        <td><strong>{balance.sku.product.name}</strong><small className="table-subline">{balance.sku.sku_code}</small></td>
                                        <td><strong>{balance.location.name}</strong><small className="table-subline">{balance.location.code}</small></td>
                                        <td className="quantity-cell">{balance.on_hand_qty}</td>
                                        <td className="quantity-cell">{balance.reserved_qty}</td>
                                        <td className="quantity-cell strong">{available}</td>
                                        <td>{balance.reorder_point}</td>
                                        <td><StatusBadge status={status} label={status === 'danger' ? 'Out' : status === 'warning' ? 'Low' : 'Healthy'} /></td>
                                        <td>
                                            <div className="inline-actions">
                                                {can.history && <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/skus/${balance.sku_id}`, app_base)} aria-label="View stock history"><Icon name="history" size={14} /></Link>}
                                                {can.adjust && (
                                                    <Link
                                                        className="icon-btn small"
                                                        href={routeWithBase(`/admin/inventory/adjustments/create?sku_id=${balance.sku_id}${balance.location_id ? `&location_id=${balance.location_id}` : ''}`, app_base)}
                                                        aria-label="Adjust stock"
                                                    >
                                                        <Icon name="edit" size={14} />
                                                    </Link>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={balances} label="variants" />
            </section>
        </AdminLayout>
    );
}
