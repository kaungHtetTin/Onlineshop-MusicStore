import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

export default function CustomersIndex({ customers, filters, tiers }) {
    const { app_base } = usePage().props;
    const [search, setSearch] = useState(filters.q ?? '');
    const applyFilters = (patch) => router.get(routeWithBase('/admin/customers', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });

    return (
        <AdminLayout title="Customers" eyebrow="Shopper management">
            <Head title="Customers" />
            <section className="panel glass">
                <PanelHeading eyebrow="Customer base" title="Registered shoppers" />
                <form className="filter-toolbar compact" onSubmit={(e) => { e.preventDefault(); applyFilters({ q: search || undefined }); }}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." />
                    </div>
                    <select value={filters.tier || ''} onChange={(e) => applyFilters({ tier: e.target.value || undefined })}>
                        <option value="">All tiers</option>
                        {tiers.map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                    </select>
                    <button type="submit" className="btn primary">Search</button>
                </form>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Customer</th>
                                <th>Tier</th>
                                <th>Points</th>
                                <th>Orders</th>
                                <th>Paid revenue</th>
                                <th>Joined</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {customers.data.length === 0 ? (
                                <tr><td colSpan={7}><span className="muted">No customers found.</span></td></tr>
                            ) : customers.data.map((customer) => (
                                <tr key={customer.id}>
                                    <td>
                                        <div className="rider-cell">
                                            <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                                            <div>
                                                <strong>{customer.name}</strong>
                                                <small>{customer.email}{customer.phone ? ` · ${customer.phone}` : ''}</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td><StatusBadge status="info" label={customer.tier || 'Bronze'} /></td>
                                    <td>{customer.loyalty_points}</td>
                                    <td>{customer.orders_count}</td>
                                    <td>${Number(customer.paid_revenue || 0).toFixed(2)}</td>
                                    <td><small>{customer.created_at}</small></td>
                                    <td>
                                        <Link href={routeWithBase(`/admin/customers/${customer.id}`, app_base)} className="icon-btn small">
                                            <Icon name="external" size={13} />
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={customers} label="customers" />
            </section>
        </AdminLayout>
    );
}
