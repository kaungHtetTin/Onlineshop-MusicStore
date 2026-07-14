import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const statusTone = {
    live: 'success',
    scheduled: 'info',
    ended: 'neutral',
    inactive: 'danger',
};

const formatDateTime = (value) => {
    if (!value) return '';
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function FlashSalesIndex({ flashSales, filters }) {
    const { app_base, flash } = usePage().props;
    const [search, setSearch] = useState(filters.q ?? '');

    const applyFilters = (patch) => {
        router.get(
            routeWithBase('/admin/flash-sales', app_base),
            { ...filters, ...patch },
            { preserveState: true, replace: true },
        );
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const remove = (sale) => {
        if (!confirm(`Delete flash sale "${sale.name}"?`)) return;
        router.delete(routeWithBase(`/admin/flash-sales/${sale.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout
            title="Flash sales"
            eyebrow="Marketing"
            action={
                <Link className="btn primary" href={routeWithBase('/admin/flash-sales/create', app_base)}>
                    <Icon name="plus" size={14} />
                    New flash sale
                </Link>
            }
        >
            <Head title="Flash Sales" />
            <AdminFlash flash={flash} />

            <section className="panel glass">
                <PanelHeading eyebrow="Limited-time offers" title="Campaigns" />

                <form className="filter-toolbar compact flash-sales-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder="Search flash sales..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                        <option value="">All statuses</option>
                        <option value="live">Live</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="ended">Ended</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button type="submit" className="btn primary">Search</button>
                </form>

                {(filters.q || filters.status) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/flash-sales', app_base))}
                    >
                        Reset filters
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Campaign</th>
                                <th>Window</th>
                                <th>Items</th>
                                <th>Status</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {flashSales.data.length === 0 ? (
                                <tr><td colSpan={5}><span className="muted">No flash sales found.</span></td></tr>
                            ) : flashSales.data.map((sale) => (
                                <tr key={sale.id}>
                                    <td>
                                        <strong>{sale.name}</strong>
                                        <small className="muted" style={{ display: 'block' }}>
                                            {sale.items.slice(0, 2).map((item) => item.sku?.product?.name).filter(Boolean).join(', ')}
                                            {sale.items.length > 2 ? ` +${sale.items.length - 2} more` : ''}
                                        </small>
                                    </td>
                                    <td>
                                        <small>
                                            {formatDateTime(sale.starts_at)}
                                            <br />
                                            {formatDateTime(sale.ends_at)}
                                        </small>
                                    </td>
                                    <td>
                                        {sale.items_count}
                                        <small className="muted" style={{ display: 'block' }}>
                                            Sold {sale.items.reduce((sum, item) => sum + Number(item.sold_count || 0), 0)}
                                        </small>
                                    </td>
                                    <td>
                                        <StatusBadge status={statusTone[sale.status] || 'neutral'} label={sale.status} />
                                    </td>
                                    <td>
                                        <div className="inline-actions">
                                            <Link
                                                className="icon-btn small"
                                                href={routeWithBase(`/admin/flash-sales/${sale.id}/edit`, app_base)}
                                                aria-label="Edit flash sale"
                                            >
                                                <Icon name="edit" size={13} />
                                            </Link>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(sale)} aria-label="Delete flash sale">
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={flashSales} label="campaigns" />
            </section>
        </AdminLayout>
    );
}
