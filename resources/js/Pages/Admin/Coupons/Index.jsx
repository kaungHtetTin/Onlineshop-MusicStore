import { useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const emptyCoupon = {
    code: '',
    type: 'percentage',
    value: '',
    min_order_amount: 0,
    starts_at: '',
    expires_at: '',
    usage_limit: '',
    is_active: true,
};

export default function CouponsIndex({ coupons, filters }) {
    const { app_base, flash } = usePage().props;
    const [search, setSearch] = useState(filters.q ?? '');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const form = useForm({ ...emptyCoupon });

    const applyFilters = (patch) => {
        router.get(routeWithBase('/admin/coupons', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const openModal = (coupon = null) => {
        setEditing(coupon);
        form.clearErrors();
        form.setData(
            coupon
                ? {
                      code: coupon.code,
                      type: coupon.type,
                      value: coupon.value,
                      min_order_amount: coupon.min_order_amount,
                      starts_at: coupon.starts_at ? coupon.starts_at.slice(0, 10) : '',
                      expires_at: coupon.expires_at ? coupon.expires_at.slice(0, 10) : '',
                      usage_limit: coupon.usage_limit ?? '',
                      is_active: !!coupon.is_active,
                  }
                : { ...emptyCoupon },
        );
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
        form.reset();
    };

    const submit = (e) => {
        e.preventDefault();
        const options = { preserveScroll: true, onSuccess: closeModal };
        if (editing) form.patch(routeWithBase(`/admin/coupons/${editing.id}`, app_base), options);
        else form.post(routeWithBase('/admin/coupons', app_base), options);
    };

    const remove = (coupon) => {
        if (!confirm(`Delete or deactivate ${coupon.code}?`)) return;
        router.delete(routeWithBase(`/admin/coupons/${coupon.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout
            title="Coupons"
            eyebrow="Promotions"
            action={
                <button type="button" className="btn primary" onClick={() => openModal()}>
                    <Icon name="plus" size={14} />
                    Add coupon
                </button>
            }
        >
            <Head title="Coupons" />
            <AdminFlash flash={flash} errors={form.errors} />

            <section className="panel glass">
                <PanelHeading eyebrow="Checkout discounts" title="Promo codes" />
                <form className="filter-toolbar" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder="Search coupon code..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                        <option value="">All statuses</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                    <button type="submit" className="btn primary">Search</button>
                </form>

                {(filters.q || filters.status) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/coupons', app_base))}
                    >
                        Reset filters
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Discount</th>
                                <th>Minimum</th>
                                <th>Usage</th>
                                <th>Status</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {coupons.data.length === 0 ? (
                                <tr><td colSpan={6}><span className="muted">No coupons found.</span></td></tr>
                            ) : coupons.data.map((coupon) => (
                                <tr key={coupon.id}>
                                    <td><strong>{coupon.code}</strong></td>
                                    <td>{coupon.type === 'percentage' ? `${Number(coupon.value).toFixed(0)}%` : `$${Number(coupon.value).toFixed(2)}`}</td>
                                    <td>${Number(coupon.min_order_amount).toFixed(2)}</td>
                                    <td>{coupon.used_count}{coupon.usage_limit ? ` / ${coupon.usage_limit}` : ''}</td>
                                    <td><StatusBadge status={coupon.is_active ? 'success' : 'neutral'} label={coupon.is_active ? 'Active' : 'Inactive'} /></td>
                                    <td>
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" onClick={() => openModal(coupon)} aria-label="Edit coupon">
                                                <Icon name="edit" size={13} />
                                            </button>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(coupon)} aria-label="Delete coupon">
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={coupons} label="coupons" />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form className="operation-modal compact glass" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Coupon</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{editing ? 'Edit coupon' : 'New coupon'}</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal}><Icon name="close" size={14} /></button>
                        </div>
                        <div className="crud-grid">
                            <label className="form-field">
                                <span>Code</span>
                                <input value={form.data.code} onChange={(e) => form.setData('code', e.target.value.toUpperCase())} required />
                            </label>
                            <label className="form-field">
                                <span>Type</span>
                                <select value={form.data.type} onChange={(e) => form.setData('type', e.target.value)}>
                                    <option value="percentage">Percentage</option>
                                    <option value="fixed">Fixed amount</option>
                                </select>
                            </label>
                            <label className="form-field">
                                <span>Value</span>
                                <input type="number" step="0.01" value={form.data.value} onChange={(e) => form.setData('value', e.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>Minimum order</span>
                                <input type="number" step="0.01" value={form.data.min_order_amount} onChange={(e) => form.setData('min_order_amount', e.target.value)} />
                            </label>
                            <label className="form-field">
                                <span>Starts</span>
                                <input type="date" value={form.data.starts_at} onChange={(e) => form.setData('starts_at', e.target.value)} />
                            </label>
                            <label className="form-field">
                                <span>Expires</span>
                                <input type="date" value={form.data.expires_at} onChange={(e) => form.setData('expires_at', e.target.value)} />
                            </label>
                            <label className="form-field">
                                <span>Usage limit</span>
                                <input type="number" value={form.data.usage_limit} onChange={(e) => form.setData('usage_limit', e.target.value)} />
                            </label>
                            <label className="form-field checkbox-row">
                                <input type="checkbox" checked={form.data.is_active} onChange={(e) => form.setData('is_active', e.target.checked)} />
                                <span>Active</span>
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>{editing ? 'Save changes' : 'Create coupon'}</button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
