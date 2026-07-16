import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

export default function ReceiptShow({ receipt, canEdit, canPost, canDelete }) {
    const { app_base, flash } = usePage().props;
    const post = () => confirm(`Post ${receipt.receipt_number}?`) && router.post(routeWithBase(`/admin/inventory/receipts/${receipt.id}/post`, app_base));
    const destroy = () => {
        const message = receipt.status === 'posted'
            ? `Delete ${receipt.receipt_number}? This will reduce stock quantities and delete the financial ledger entry.`
            : `Delete draft ${receipt.receipt_number}?`;
        if (confirm(message)) {
            router.delete(routeWithBase(`/admin/inventory/receipts/${receipt.id}`, app_base));
        }
    };
    const headerAction = canEdit || canPost || canDelete ? (
        <div className="inline-actions">
            {canEdit && <Link className="btn secondary" href={routeWithBase(`/admin/inventory/receipts/${receipt.id}/edit`, app_base)}><Icon name="edit" size={14} /> Edit</Link>}
            {canPost && <button className="btn primary" type="button" onClick={post}><Icon name="check" size={14} /> Post receipt</button>}
            {canDelete && <button className="btn danger" type="button" onClick={destroy}><Icon name="trash" size={14} /> Delete</button>}
        </div>
    ) : null;

    return (
        <AdminLayout title={receipt.receipt_number} eyebrow="Stock receipt" action={headerAction}>
            <Head title={receipt.receipt_number} />
            <AdminFlash flash={flash} />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory/receipts', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> Back to receipts
                </Link>
                <StatusBadge status={receipt.status === 'posted' ? 'success' : receipt.status === 'reversed' ? 'neutral' : 'warning'} label={receipt.status} />
            </div>

            <section className="panel glass receipt-detail-card">
                <div className="receipt-detail-meta">
                    <div>
                        <span>Warehouse</span>
                        <strong>{receipt.location.name}</strong>
                        <small>{receipt.location.code}</small>
                    </div>
                    <div>
                        <span>Supplier / reference</span>
                        <strong>{receipt.supplier_reference || '-'}</strong>
                        <small>{receipt.notes || 'No note'}</small>
                    </div>
                    <div>
                        <span>Received</span>
                        <strong>{receipt.received_at ? new Date(receipt.received_at).toLocaleString() : 'Not posted'}</strong>
                    </div>
                </div>

                <PanelHeading eyebrow="Receipt lines" title={`${receipt.items.length} SKUs`} />
                <div className="table-wrap receipt-lines-table">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Product / SKU</th>
                                <th>Received</th>
                                <th>Original</th>
                                <th>Movement</th>
                            </tr>
                        </thead>
                        <tbody>
                            {receipt.items.map((item) => (
                                <tr key={item.id}>
                                    <td>
                                        <strong>{item.sku.product.name}</strong>
                                        <small className="table-subline">{item.sku.sku_code}</small>
                                    </td>
                                    <td className="quantity-positive">+{item.received_quantity}</td>
                                    <td>{item.unit_cost === null ? '-' : Number(item.unit_cost).toFixed(2)}</td>
                                    <td>{item.movement_id || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
