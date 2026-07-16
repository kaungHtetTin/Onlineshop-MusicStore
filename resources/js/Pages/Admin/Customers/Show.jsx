import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

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
    const t = usePhraseTranslation();

    return (
        <AdminLayout title={customer.name} eyebrow={t('Customer profile')}>
            <Head title={t('Customer :value', { value: customer.name })} />

            <Link href={routeWithBase('/admin/customers', app_base)} className="back-link">
                <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                {t('Back to customers')}
            </Link>

            <section className="panel glass" style={{ marginBottom: 14 }}>
                <div className="stack-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div className="rider-cell">
                        <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                        <div>
                            <p className="eyebrow">{t('Customer')}</p>
                            <h2 style={{ fontSize: 20, fontWeight: 900 }}>{customer.name}</h2>
                            <small>{customer.email || t('No email')}{customer.phone ? ` - ${customer.phone}` : ''}</small>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <StatusBadge status="info" label={customer.tier || t('Bronze')} />
                        <StatusBadge status={customer.status || 'active'} label={t(customer.status || 'active')} />
                    </div>
                </div>
                <div className="metrics-grid four" style={{ marginTop: 16 }}>
                    <StatCard label={t('Total spent')} value={money(stats.total_spent)} hint={t(':count paid orders', { count: stats.paid_orders })} />
                    <StatCard label={t('Average order')} value={money(stats.average_order_value)} hint={t('Paid orders only')} />
                    <StatCard label={t('Loyalty points')} value={customer.loyalty_points || 0} hint={customer.tier || t('Bronze')} />
                    <StatCard label={t('Reviews')} value={stats.reviews} hint={t('Product feedback')} />
                </div>
            </section>

            <div className="report-analysis-grid">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Order history')} title={t('Recent orders')} />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('Order')}</th>
                                    <th>{t('Items')}</th>
                                    <th>{t('Status')}</th>
                                    <th>{t('Total')}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr><td colSpan={5}><span className="muted">{t('No orders yet.')}</span></td></tr>
                                ) : recentOrders.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <strong>{order.order_number}</strong>
                                            <small>{order.created_at}</small>
                                        </td>
                                        <td>{order.items_count}</td>
                                        <td>
                                            <StatusBadge status={order.status} label={t(order.status)} />
                                            <small>{t(order.payment_status)}</small>
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
                    <PanelHeading eyebrow={t('Preference signals')} title={t('Top categories')} />
                    <div className="report-stack">
                        {topCategories.length === 0 ? (
                            <p className="muted">{t('No paid category history yet.')}</p>
                        ) : topCategories.map((category) => (
                            <article key={category.id} className="report-segment">
                                <div>
                                    <strong>{category.name}</strong>
                                    <small>{t(':count units purchased', { count: category.units })}</small>
                                </div>
                                <span>{money(category.revenue)}</span>
                            </article>
                        ))}
                    </div>
                </section>
            </div>

            <section className="panel glass" style={{ marginTop: 14 }}>
                <PanelHeading eyebrow={t('Feedback')} title={t('Recent reviews')} />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Product')}</th>
                                <th>{t('Rating')}</th>
                                <th>{t('Comment')}</th>
                                <th>{t('Status')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.length === 0 ? (
                                <tr><td colSpan={4}><span className="muted">{t('No reviews yet.')}</span></td></tr>
                            ) : reviews.map((review) => (
                                <tr key={review.id}>
                                    <td><strong>{review.product?.name || t('Product')}</strong></td>
                                    <td>{review.rating}/5</td>
                                    <td><small>{review.comment || '-'}</small></td>
                                    <td><StatusBadge status={review.is_approved ? 'approved' : 'pending'} label={review.is_approved ? t('approved') : t('pending')} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
