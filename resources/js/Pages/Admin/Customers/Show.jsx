import { Head, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const money = (value) => `$${Number(value || 0).toFixed(2)}`;

function StatCard({ label, value, hint }) {
    return (
        <article className="metric-card glass">
            <small>{label}</small>
            <strong>{value}</strong>
            {hint && <p>{hint}</p>}
        </article>
    );
}

export default function CustomerShow({ customer, stats, recentOrders, topCategories, reviews }) {
    const { app_base } = usePage().props;

    return (
        <AdminLayout title={customer.name} eyebrow="Customer profile">
            <Head title={`Customer ${customer.name}`} />

            <Link href={routeWithBase('/admin/customers', app_base)} className="back-link">
                <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                Back to customers
            </Link>

            <section className="panel glass" style={{ marginBottom: 14 }}>
                <div className="stack-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div className="rider-cell">
                        <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                        <div>
                            <p className="eyebrow">Customer</p>
                            <h2 style={{ fontSize: 20, fontWeight: 900 }}>{customer.name}</h2>
                            <small>{customer.email || 'No email'}{customer.phone ? ` · ${customer.phone}` : ''}</small>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <StatusBadge status="info" label={customer.tier || 'Bronze'} />
                        <StatusBadge status={customer.status || 'active'} label={customer.status || 'active'} />
                    </div>
                </div>
                <div className="metrics-grid four" style={{ marginTop: 16 }}>
                    <StatCard label="Total spent" value={money(stats.total_spent)} hint={`${stats.paid_orders} paid orders`} />
                    <StatCard label="Average order" value={money(stats.average_order_value)} hint="Paid orders only" />
                    <StatCard label="Loyalty points" value={customer.loyalty_points || 0} hint={customer.tier || 'Bronze'} />
                    <StatCard label="Reviews" value={stats.reviews} hint="Product feedback" />
                </div>
            </section>

            <div className="report-analysis-grid">
                <section className="panel glass">
                    <PanelHeading eyebrow="Order history" title="Recent orders" />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Items</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr><td colSpan={5}><span className="muted">No orders yet.</span></td></tr>
                                ) : recentOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <strong>{order.order_number}</strong>
                                            <small>{order.created_at}</small>
                                        </td>
                                        <td>{order.items_count}</td>
                                        <td>
                                            <StatusBadge status={order.status} label={order.status} />
                                            <small>{order.payment_status}</small>
                                        </td>
                                        <td><strong>{money(order.final_amount)}</strong></td>
                                        <td>
                                            <Link href={routeWithBase(`/admin/orders/${order.id}`, app_base)} className="icon-btn small">
                                                <Icon name="external" size={13} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Preference signals" title="Top categories" />
                    <div className="report-stack">
                        {topCategories.length === 0 ? (
                            <p className="muted">No paid category history yet.</p>
                        ) : topCategories.map((category) => (
                            <article key={category.id} className="report-segment">
                                <div>
                                    <strong>{category.name}</strong>
                                    <small>{category.units} units purchased</small>
                                </div>
                                <span>{money(category.revenue)}</span>
                            </article>
                        ))}
                    </div>
                </section>
            </div>

            <section className="panel glass" style={{ marginTop: 14 }}>
                <PanelHeading eyebrow="Feedback" title="Recent reviews" />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Rating</th>
                                <th>Comment</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.length === 0 ? (
                                <tr><td colSpan={4}><span className="muted">No reviews yet.</span></td></tr>
                            ) : reviews.map((review) => (
                                <tr key={review.id}>
                                    <td><strong>{review.product?.name || 'Product'}</strong></td>
                                    <td>{review.rating}/5</td>
                                    <td><small>{review.comment || '-'}</small></td>
                                    <td><StatusBadge status={review.is_approved ? 'approved' : 'pending'} label={review.is_approved ? 'approved' : 'pending'} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
