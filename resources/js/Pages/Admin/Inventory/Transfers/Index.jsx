import { Head, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';

export default function TransfersIndex({ transfers, canCreate, realtime, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base } = usePage().props;
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({
        locationIds: realtime?.locationIds || [],
        includeAll: realtime?.canAll,
        only: ['transfers', 'lastUpdated'],
        pollIntervalMs,
        listenBalance: false,
        listenTransfers: true,
    });

    return (
        <AdminLayout
            title="Transfers"
            eyebrow="Inventory"
            action={canCreate ? <Link className="btn primary" href={routeWithBase('/admin/inventory/transfers/create', app_base)}><Icon name="plus" size={14} /> New transfer</Link> : null}
        >
            <Head title="Stock Transfers" />
            <section className="panel glass">
                <PanelHeading eyebrow="Inter-location" title="Stock transfers" action={<small className="muted">Realtime {realtimeState} · Updated {new Date(lastEventAt || lastUpdated).toLocaleTimeString()}</small>} />
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Transfer</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Lines</th>
                                <th>Units</th>
                                <th>Date</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {transfers.data.length === 0 ? (
                                <tr><td colSpan="7" className="empty-table-cell">No transfers yet.</td></tr>
                        ) : transfers.data.map((transfer) => (
                                <tr key={transfer.id}>
                                    <td><strong>{transfer.transfer_number}</strong></td>
                                    <td>{transfer.source_location.name}<small className="table-subline">{transfer.source_location.code}</small></td>
                                    <td>{transfer.destination_location.name}<small className="table-subline">{transfer.destination_location.code}</small></td>
                                    <td>{transfer.items.length}</td>
                                    <td>{transfer.items.reduce((sum, item) => sum + item.requested_quantity, 0)}</td>
                                    <td>{new Date(transfer.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/transfers/${transfer.id}`, app_base)} aria-label="Open transfer">
                                            <Icon name="external" size={13} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={transfers} label="transfers" />
            </section>
        </AdminLayout>
    );
}
