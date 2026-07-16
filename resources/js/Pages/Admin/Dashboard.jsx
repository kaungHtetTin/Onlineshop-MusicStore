import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { Head, Link, usePage } from '@/spa/router';
import { routeWithBase } from '@/Utils/url';
import { paymentLabels } from '@/constants/orderLabels';
import { usePhraseTranslation } from '@/Utils/i18n';

function MetricCard({ label, value, hint, icon, href }) {
    const t = usePhraseTranslation();
    const content = (
        <>
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{t(label)}</small>
            <strong>{value}</strong>
            {hint && <p>{t(hint)}</p>}
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

export default function Dashboard({ stats = {}, recentOrders = [], productCount = 0, customerCount = 0 }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const dashboardStats = {
        revenue_paid: 0,
        total: 0,
        pending_payment: 0,
        processing: 0,
        shipped: 0,
        delivered: 0,
        ...stats,
    };

    return (
        <AdminLayout title={t('Dashboard')} eyebrow={t('Operations overview')}>
            <Head title={t('Admin Dashboard')} />

            <div className="metrics-grid">
                <MetricCard
                    label="Revenue (confirmed)"
                    value={`$${Number(dashboardStats.revenue_paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    hint="Paid orders total"
                    icon="wallet"
                />
                <MetricCard
                    label="Total orders"
                    value={dashboardStats.total}
                    hint="All time"
                    icon="receipt"
                    href={routeWithBase('/admin/orders', app_base)}
                />
                <MetricCard
                    label="Awaiting payment"
                    value={dashboardStats.pending_payment}
                    hint={dashboardStats.pending_payment > 0 ? 'Needs review' : 'Queue clear'}
                    icon="card"
                    href={routeWithBase('/admin/orders?tab=payments', app_base)}
                />
                <MetricCard label="Customers" value={customerCount} hint="Registered accounts" icon="user" />
                <MetricCard label="Products" value={productCount} hint="Active catalog" icon="box" />
            </div>

            <div className="admin-grid">
                <section className="panel wide glass">
                    <PanelHeading
                        eyebrow={t('Live queue')}
                        title={t('Recent orders')}
                        actionLabel={t('View all')}
                        onAction={() => {
                            window.location.assign(routeWithBase('/admin/orders', app_base));
                        }}
                    />
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>{t('Order')}</th>
                                    <th>{t('Customer')}</th>
                                    <th>{t('Amount')}</th>
                                    <th>{t('Payment')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentOrders.length === 0 ? (
                                    <tr>
                                        <td colSpan={4}>
                                            <span className="muted">{t('No orders yet.')}</span>
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
                                                <strong>{order.user?.name || t('Guest')}</strong>
                                                <small>{order.items_count ?? order.items?.length ?? 0} {t('items')}</small>
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
                        <PanelHeading eyebrow={t('Fulfillment')} title={t('Shipping queue')} />
                        <div className="stack-sm">
                            <div className="stack-row">
                                <span>{t('Processing')}</span>
                                <StatusBadge status="processing" label={String(dashboardStats.processing)} />
                            </div>
                            <div className="stack-row">
                                <span>{t('Shipped')}</span>
                                <StatusBadge status="shipped" label={String(dashboardStats.shipped)} />
                            </div>
                            <div className="stack-row">
                                <span>{t('Delivered')}</span>
                                <StatusBadge status="delivered" label={String(dashboardStats.delivered)} />
                            </div>
                            <Link
                                href={routeWithBase('/admin/orders?tab=fulfillment', app_base)}
                                className="btn secondary full"
                            >
                                {t('Open fulfillment list')}
                            </Link>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow={t('Catalog')} title={t('Inventory')} />
                        <p>{productCount} {t('products in inventory')}</p>
                        <Link href={routeWithBase('/admin/products', app_base)} className="btn primary full" style={{ marginTop: 12 }}>
                            {t('Manage products')}
                        </Link>
                    </section>

                    {dashboardStats.pending_payment > 0 && (
                        <section className="panel glass">
                            <div className="alert-list">
                                <div>
                                    <span className="alert-icon warning">
                                        <Icon name="wallet" size={15} />
                                    </span>
                                    <p>
                                        <strong>{dashboardStats.pending_payment} {t('payments awaiting review')}</strong>
                                        <small>{t('Review pending payment proofs in the orders queue')}</small>
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
