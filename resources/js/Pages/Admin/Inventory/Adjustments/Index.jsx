import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';

export default function AdjustmentsIndex({ adjustments }) {
    const rows = adjustments.data.flatMap((adjustment) =>
        adjustment.items.map((item) => ({
            adjustment,
            item,
        }))
    );

    return (
        <AdminLayout title="Adjustments" eyebrow="Inventory">
            <Head title="Stock Adjustments" />
            <section className="panel glass">
                <PanelHeading eyebrow="Counts & corrections" title="Stock adjustment records" />
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Adjustment</th>
                                <th>Warehouse</th>
                                <th>Product / SKU</th>
                                <th>Before</th>
                                <th>After</th>
                                <th>Variance</th>
                                <th>Reason</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.length === 0 ? (
                                <tr>
                                    <td colSpan="8" className="empty-table-cell">No adjustments yet.</td>
                                </tr>
                            ) : rows.map(({ adjustment, item }) => (
                                <tr key={`${adjustment.id}-${item.id}`}>
                                    <td>
                                        <strong>{adjustment.adjustment_number}</strong>
                                        <small className="table-subline">{new Date(adjustment.created_at).toLocaleString()}</small>
                                    </td>
                                    <td>{adjustment.location.name}</td>
                                    <td>
                                        <strong>{item.sku.product.name}</strong>
                                        <small className="table-subline">{item.sku.sku_code}</small>
                                    </td>
                                    <td>{item.system_quantity}</td>
                                    <td>{item.counted_quantity}</td>
                                    <td className={item.quantity_delta < 0 ? 'quantity-negative' : item.quantity_delta > 0 ? 'quantity-positive' : ''}>
                                        {item.quantity_delta > 0 ? '+' : ''}{item.quantity_delta}
                                    </td>
                                    <td>{adjustment.reason_code.replaceAll('_', ' ')}</td>
                                    <td><StatusBadge status="success" label="posted" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={adjustments} label="adjustments" />
            </section>
        </AdminLayout>
    );
}
