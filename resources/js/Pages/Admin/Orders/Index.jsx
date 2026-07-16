import { useState } from 'react';
import { Head, Link, router, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { orderStatusLabels, paymentLabels } from '@/constants/orderLabels';
import { usePhraseTranslation } from '@/Utils/i18n';

const tabs = [
    { key: '', label: 'All orders' },
    { key: 'payments', label: 'Awaiting payment' },
    { key: 'fulfillment', label: 'To ship' },
    { key: 'completed', label: 'Delivered' },
];

function MetricCard({ label, value, icon }) {
    const t = usePhraseTranslation();

    return (
        <article className="metric-card glass">
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{t(label)}</small>
            <strong>{value}</strong>
        </article>
    );
}

export default function OrdersIndex({ orders, stats, filters, canReviewPayments, canManageOrders }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const [search, setSearch] = useState(filters.q ?? '');
    const activeTab = filters.tab ?? '';

    const applyFilters = (patch) => {
        router.get(routeWithBase('/admin/orders', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    return (
        <AdminLayout title={t('Order management')} eyebrow={t('Sales operations')}>
            <Head title={t('Orders')} />

            <div className="metrics-grid six">
                <MetricCard label="Total orders" value={stats.total} icon="receipt" />
                <MetricCard label="Awaiting payment" value={stats.pending_payment} icon="wallet" />
                <MetricCard label="Processing" value={stats.processing} icon="box" />
                <MetricCard label="Shipped" value={stats.shipped} icon="navigation" />
                <MetricCard label="Delivered" value={stats.delivered} icon="check" />
                <MetricCard
                    label="Revenue (paid)"
                    value={`$${Number(stats.revenue_paid).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    icon="card"
                />
            </div>

            <section className="panel glass">
                <PanelHeading eyebrow={t('Order queue')} title={t('All customer orders')} />

                <div className="tab-bar">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key || 'all'}
                            type="button"
                            className={activeTab === tab.key ? 'active' : ''}
                            onClick={() => applyFilters({ tab: tab.key || undefined })}
                        >
                            {t(tab.label)}
                        </button>
                    ))}
                </div>

                <form className="filter-toolbar" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder={t('Search order #, name, email, phone...')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => applyFilters({ status: e.target.value || undefined })}
                    >
                        <option value="">{t('All statuses')}</option>
                        {Object.entries(orderStatusLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                                {t(v)}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filters.payment_status ?? ''}
                        onChange={(e) => applyFilters({ payment_status: e.target.value || undefined })}
                    >
                        <option value="">{t('All payments')}</option>
                        {Object.entries(paymentLabels).map(([k, v]) => (
                            <option key={k} value={k}>
                                {t(v)}
                            </option>
                        ))}
                    </select>
                    <button type="submit" className="btn primary">
                        {t('Search')}
                    </button>
                </form>

                {(filters.q || filters.status || filters.payment_status || filters.tab) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/orders', app_base))}
                    >
                        {t('Reset filters')}
                    </button>
                )}

                {!canManageOrders && (
                    <p style={{ marginBottom: 10 }}>
                        {t('View only - contact a manager to confirm payments or update fulfillment.')}
                    </p>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Order')}</th>
                                <th>{t('Customer')}</th>
                                <th>{t('Items')}</th>
                                <th>{t('Total')}</th>
                                <th>{t('Payment')}</th>
                                <th>{t('Fulfillment')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {orders.data.length === 0 ? (
                                <tr>
                                    <td colSpan={7}>
                                        <span className="muted">{t('No orders match your filters.')}</span>
                                    </td>
                                </tr>
                            ) : (
                                orders.data.map((order) => (
                                    <tr key={order.id}>
                                        <td>
                                            <strong>{order.order_number}</strong>
                                            <small>{order.created_at}</small>
                                        </td>
                                        <td>
                                            <strong>{order.user?.name}</strong>
                                            <small>{order.user?.phone || order.user?.email}</small>
                                        </td>
                                        <td>{order.items_count ?? order.items?.length ?? 0}</td>
                                        <td>
                                            <strong>${Number(order.final_amount).toFixed(2)}</strong>
                                        </td>
                                        <td>
                                            <StatusBadge
                                                status={order.payment_status}
                                                label={t(paymentLabels[order.payment_status] || order.payment_status)}
                                            />
                                        </td>
                                        <td>
                                            <StatusBadge
                                                status={order.status}
                                                label={t(orderStatusLabels[order.status] || order.status)}
                                            />
                                        </td>
                                        <td>
                                            <Link
                                                href={routeWithBase(`/admin/orders/${order.id}`, app_base)}
                                                className="icon-btn small"
                                                aria-label={
                                                    order.payment_status === 'pending_review' && canReviewPayments
                                                        ? `${t('Review order')} ${order.order_number}`
                                                        : `${t('Open order')} ${order.order_number}`
                                                }
                                                title={order.payment_status === 'pending_review' && canReviewPayments ? t('Review order') : t('Open order')}
                                            >
                                                <Icon name="external" size={13} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <AdminPagination paginator={orders} label={t('orders')} />
            </section>
        </AdminLayout>
    );
}
