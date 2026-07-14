import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { Head, Link, usePage } from '@inertiajs/react';
import { routeWithBase } from '@/Utils/url';
import { paymentLabels } from '@/constants/orderLabels';

function MetricCard({ label, value, hint, icon, href }) {
    const content = (
        <>
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{label}</small>
            <strong>{value}</strong>
            {hint && <p>{hint}</p>}
        </>
    );

    if (href) {
        return (
            <Link href={href} className="metric-card glass">
                {content}
            </Link>
        );
    }

    return <article className="metric-card glass">{content}</article>;
}

export default function Dashboard({ stats, recentOrders, productCount, customerCount }) {
    const { app_base } = usePage().props;

    return (
        <AdminLayout title="Dashboard" eyebrow="Operations overview">
            <Head title="Admin Dashboard" />

            <div className="metrics-grid">
                <MetricCard
                    label="Revenue (confirmed)"
                    value={`$${Number(stats.revenue_paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    hint="Paid orders total"
                    icon="wallet"
                />
                <MetricCard
                    label="Total orders"
                    value={stats.total}
                    hint="All time"
                    icon="receipt"
                    href={routeWithBase('/admin/orders', app_base)}
                />
                <MetricCard
                    label="Awaiting payment"
                    value={stats.pending_payment}
                    hint={stats.pending_payment > 0 ? 'Needs review' : 'Queue clear'}
                    icon="card"
                    href={routeWithBase('/admin/orders?tab=payments', app_base)}
                />
                <MetricCard label="Customers" value={customerCount} hint="Registered accounts" icon="user" />
                <MetricCard label="Products" value={productCount} hint="Active catalog" icon="box" />
            </div>

            <div className="admin-grid">
                <section className="panel wide glass">
                    <PanelHeading
                        eyebrow="Live queue"
                        title="Recent orders"
                        actionLabel="View all"
                        onAction={() => {
                            window.location.assign(routeWithBase('/admin/orders', app_base));
                        }}
                    />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Customer</th>
                                    <th>Amount</th>
                                    <th>Payment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>
                                            <span className="muted">No orders yet.</span>
                                        </td>
                                    </tr>
                                ) : (
                                    recentOrders.map((order) => (
                                        <tr
                                            key={order.id}
                                            className="clickable"
                                            onClick={() => {
                                                window.location.assign(routeWithBase(`/admin/orders/${order.id}`, app_base));
                                            }}
                                        >
                                            <td>
                                                <strong>{order.order_number}</strong>
                                                <small>{order.created_at}</small>
                                            </td>
                                            <td>
                                                <strong>{order.user?.name || 'Guest'}</strong>
                                                <small>{order.items_count ?? order.items?.length ?? 0} items</small>
                                            </td>
                                            <td>
                                                <strong>${Number(order.final_amount).toFixed(2)}</strong>
                                            </td>
                                            <td>
                                                <StatusBadge
                                                    status={order.payment_status}
                                                    label={paymentLabels[order.payment_status] || order.payment_status}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <div className="stack-sm">
                    <section className="panel glass">
                        <PanelHeading eyebrow="Fulfillment" title="Shipping queue" />
                        <div className="stack-sm">
                            <div className="stack-row">
                                <span>Processing</span>
                                <StatusBadge status="processing" label={String(stats.processing)} />
                            </div>
                            <div className="stack-row">
                                <span>Shipped</span>
                                <StatusBadge status="shipped" label={String(stats.shipped)} />
                            </div>
                            <div className="stack-row">
                                <span>Delivered</span>
                                <StatusBadge status="delivered" label={String(stats.delivered)} />
                            </div>
                            <Link
                                href={routeWithBase('/admin/orders?tab=fulfillment', app_base)}
                                className="btn secondary full"
                            >
                                Open fulfillment list
                            </Link>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow="Catalog" title="Inventory" />
                        <p>{productCount} products in inventory</p>
                        <Link href={routeWithBase('/admin/products', app_base)} className="btn primary full" style={{ marginTop: 12 }}>
                            Manage products
                        </Link>
                    </section>

                    {stats.pending_payment > 0 && (
                        <section className="panel glass">
                            <div className="alert-list">
                                <div>
                                    <span className="alert-icon warning">
                                        <Icon name="wallet" size={15} />
                                    </span>
                                    <p>
                                        <strong>{stats.pending_payment} payments awaiting review</strong>
                                        <small>Review pending payment proofs in the orders queue</small>
                                    </p>
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </AdminLayout>
    );
}
