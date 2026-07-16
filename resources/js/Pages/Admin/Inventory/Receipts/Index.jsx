import { Head, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

export default function ReceiptsIndex({ receipts }) {
    const { app_base } = usePage().props;

    return (
        <AdminLayout
            title="Receiving"
            eyebrow="Inventory"
            action={<Link className="btn primary" href={routeWithBase('/admin/inventory/receipts/create', app_base)}><Icon name="plus" size={14} /> New receipt</Link>}
        >
            <Head title="Stock Receipts" />
            <section className="panel glass">
                <PanelHeading eyebrow="Inbound stock" title="Stock receipts" />
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Receipt</th>
                                <th>Warehouse</th>
                                <th>Reference</th>
                                <th>Lines</th>
                                <th>Units</th>
                                <th>Status</th>
                                <th>Date</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {receipts.data.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="empty-table-cell">No receipts yet.</td>
                                </tr>
                            ) : receipts.data.map((receipt) => (
                                <tr key={receipt.id}>
                                    <td><strong>{receipt.receipt_number}</strong></td>
                                    <td>{receipt.location.name}<small className="table-subline">{receipt.location.code}</small></td>
                                    <td>{receipt.supplier_reference || '-'}</td>
                                    <td>{receipt.items.length}</td>
                                    <td>{receipt.items.reduce((sum, item) => sum + item.received_quantity, 0)}</td>
                                    <td><StatusBadge status={receipt.status === 'posted' ? 'success' : 'warning'} label={receipt.status} /></td>
                                    <td>{new Date(receipt.created_at).toLocaleDateString()}</td>
                                    <td>
                                        <div className="inline-actions">
                                            {receipt.status === 'draft' && (
                                                <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}/edit`, app_base)} aria-label="Edit receipt">
                                                    <Icon name="edit" size={13} />
                                                </Link>
                                            )}
                                            <Link className="icon-btn small" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base)} aria-label="Open receipt">
                                                <Icon name="external" size={13} />
                                            </Link>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={receipts} label="receipts" />
            </section>
        </AdminLayout>
    );
}
