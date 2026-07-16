import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';

export default function SkuShow({ sku, balances, movements, locations, types, filters, realtime, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base } = usePage().props;
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({
        locationIds: realtime?.locationIds || balances.map((balance) => balance.location_id),
        includeAll: realtime?.canAll,
        skuId: sku.id,
        only: ['balances', 'movements', 'types', 'lastUpdated'],
        pollIntervalMs,
        listenBalance: true,
        listenTransfers: false,
    });
    const changeFilter = (key, value) => router.get(routeWithBase(`/admin/inventory/skus/${sku.id}`, app_base), { ...filters, [key]: value }, { preserveState: true, replace: true });

    return (
        <AdminLayout title={sku.sku_code} eyebrow="Inventory history" action={<a className="btn secondary" href={routeWithBase(`/admin/inventory/skus/${sku.id}/export`, app_base)}><Icon name="download" size={14} /> Export</a>}>
            <Head title={`${sku.sku_code} Inventory`} />
            <div className="sticky-toolbar"><Link className="back-link" href={routeWithBase('/admin/inventory', app_base)}><Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> Back to inventory</Link></div>
            <section className="sku-balance-strip">
                <div className="sku-identity"><span>{sku.product.name}</span><strong>{sku.sku_code}</strong><small>{sku.barcode || 'No barcode'}</small></div>
                {balances.map((balance) => <div key={balance.id}><span>{balance.location.name}</span><strong>{balance.available_qty}</strong><small>{balance.on_hand_qty} on hand / {balance.reserved_qty} reserved</small></div>)}
            </section>
            <section className="panel glass">
                <PanelHeading eyebrow="Ledger" title="Movement history" action={<small className="muted">Realtime {realtimeState} · Updated {new Date(lastEventAt || lastUpdated).toLocaleTimeString()}</small>} />
                <div className="inventory-filterbar">
                    <select value={filters.location || ''} onChange={(event) => changeFilter('location', event.target.value)}><option value="">All warehouses</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
                    <select value={filters.type || ''} onChange={(event) => changeFilter('type', event.target.value)}><option value="">All movement types</option>{types.map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select>
                    <input type="date" value={filters.from || ''} onChange={(event) => changeFilter('from', event.target.value)} aria-label="From date" />
                    <input type="date" value={filters.to || ''} onChange={(event) => changeFilter('to', event.target.value)} aria-label="To date" />
                </div>
                <div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Warehouse</th><th>Movement</th><th>Change</th><th>Before</th><th>After</th><th>User / reason</th></tr></thead><tbody>
                    {movements.data.length === 0 ? <tr><td colSpan="7" className="empty-table-cell">No movements found.</td></tr> : movements.data.map((movement) => <tr key={movement.id}>
                        <td><strong>{new Date(movement.occurred_at).toLocaleDateString()}</strong><small className="table-subline">{new Date(movement.occurred_at).toLocaleTimeString()}</small></td>
                        <td>{movement.location.code}</td><td>{movement.type.replaceAll('_', ' ')}</td>
                        <td className={movement.quantity_delta >= 0 ? 'quantity-positive' : 'quantity-negative'}>{movement.quantity_delta > 0 ? '+' : ''}{movement.quantity_delta}</td>
                        <td>{movement.on_hand_before}</td><td>{movement.on_hand_after}</td>
                        <td>{movement.creator?.name || 'System'}<small className="table-subline">{movement.reason_code || movement.notes || '-'}</small>{movement.document && <small className="table-subline"><Link href={movement.document.href}>{movement.document.label}</Link></small>}</td>
                    </tr>)}
                </tbody></table></div>
                <AdminPagination paginator={movements} label="movements" />
            </section>
        </AdminLayout>
    );
}
