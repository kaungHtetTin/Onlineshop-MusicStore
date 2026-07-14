import { useState } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

export default function ReviewsIndex({ reviews, filters }) {
    const { app_base, flash } = usePage().props;
    const [search, setSearch] = useState(filters.q ?? '');
    const applyFilters = (patch) => router.get(routeWithBase('/admin/reviews', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const moderate = (review, isApproved) => {
        router.patch(routeWithBase(`/admin/reviews/${review.id}`, app_base), { is_approved: isApproved }, { preserveScroll: true });
    };

    const remove = (review) => {
        if (!confirm('Delete this review?')) return;
        router.delete(routeWithBase(`/admin/reviews/${review.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout title="Reviews" eyebrow="Moderation">
            <Head title="Review Moderation" />
            <AdminFlash flash={flash} />
            <section className="panel glass">
                <PanelHeading eyebrow="Product feedback" title="Customer reviews" />
                <form className="filter-toolbar" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder="Search review, product, customer..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                        <option value="">All statuses</option>
                        <option value="approved">Approved</option>
                        <option value="hidden">Hidden</option>
                    </select>
                    <button type="submit" className="btn primary">Search</button>
                </form>

                {(filters.q || filters.status) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => router.get(routeWithBase('/admin/reviews', app_base))}
                    >
                        Reset filters
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Review</th>
                                <th>Product</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {reviews.data.length === 0 ? (
                                <tr><td colSpan={5}><span className="muted">No reviews found.</span></td></tr>
                            ) : reviews.data.map((review) => (
                                <tr key={review.id}>
                                    <td>
                                        <strong>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</strong>
                                        <small style={{ display: 'block', maxWidth: 380 }}>{review.comment || 'No comment'}</small>
                                    </td>
                                    <td>{review.product?.name}</td>
                                    <td><small>{review.user?.name}<br />{review.user?.email}</small></td>
                                    <td><StatusBadge status={review.is_approved ? 'success' : 'neutral'} label={review.is_approved ? 'Approved' : 'Hidden'} /></td>
                                    <td>
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" onClick={() => moderate(review, !review.is_approved)} aria-label="Toggle review status">
                                                <Icon name={review.is_approved ? 'lock' : 'check'} size={13} />
                                            </button>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(review)} aria-label="Delete review">
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={reviews} label="reviews" />
            </section>
        </AdminLayout>
    );
}
