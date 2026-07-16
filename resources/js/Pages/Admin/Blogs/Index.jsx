import { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const statusTone = {
    draft: 'neutral',
    published: 'success',
    archived: 'danger',
};

const formatDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

export default function BlogsIndex({ posts, filters, categories, statuses }) {
    const { app_base, flash } = usePage().props;
    const [search, setSearch] = useState(filters.q ?? '');

    const applyFilters = (patch) => {
        router.get(
            routeWithBase('/admin/blogs', app_base),
            { ...filters, ...patch },
            { preserveState: true, replace: true },
        );
    };

    const handleSearch = (event) => {
        event.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const remove = (post) => {
        if (!confirm(`Delete blog post "${post.title}"?`)) return;
        router.delete(routeWithBase(`/admin/blogs/${post.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout
            title="Blogs"
            eyebrow="Marketing"
            action={
                <Link className="btn primary" href={routeWithBase('/admin/blogs/create', app_base)}>
                    <Icon name="plus" size={14} />
                    New blog
                </Link>
            }
        >
            <Head title="Blogs" />
            <AdminFlash flash={flash} />

            <section className="panel glass">
                <PanelHeading eyebrow="Content marketing" title="Blog posts" />

                <form className="filter-toolbar blog-filter" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder="Search blogs..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <select value={filters.category || ''} onChange={(event) => applyFilters({ category: event.target.value || undefined })}>
                        <option value="">All categories</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.slug}>{category.name}</option>
                        ))}
                    </select>
                    <select value={filters.status || ''} onChange={(event) => applyFilters({ status: event.target.value || undefined })}>
                        <option value="">All statuses</option>
                        {(statuses || []).map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                    <button type="submit" className="btn primary">Search</button>
                </form>

                {(filters.q || filters.status || filters.category) && (
                    <button
                        type="button"
                        className="text-btn"
                        style={{ marginBottom: 10 }}
                        onClick={() => {
                            setSearch('');
                            router.get(routeWithBase('/admin/blogs', app_base));
                        }}
                    >
                        Reset filters
                    </button>
                )}

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Post</th>
                                <th>Category</th>
                                <th>Tags</th>
                                <th>Video</th>
                                <th>Status</th>
                                <th>Published</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {posts.data.length === 0 ? (
                                <tr><td colSpan={7}><span className="muted">No blog posts found.</span></td></tr>
                            ) : posts.data.map((post) => (
                                <tr key={post.id}>
                                    <td>
                                        <div className="blog-table-title">
                                            <span className="blog-table-cover">
                                                {post.cover_image_url ? <img src={post.cover_image_url} alt="" /> : <Icon name="book" size={15} />}
                                            </span>
                                            <span>
                                                <strong>{post.title}</strong>
                                                {post.excerpt && <small className="muted">{post.excerpt}</small>}
                                            </span>
                                        </div>
                                    </td>
                                    <td>{post.category?.name || '-'}</td>
                                    <td>
                                        <small>{(post.tags || []).slice(0, 3).map((tag) => tag.name).join(', ') || '-'}</small>
                                    </td>
                                    <td>{post.youtube_video_id ? 'YouTube' : '-'}</td>
                                    <td><StatusBadge status={statusTone[post.status] || 'neutral'} label={post.status} /></td>
                                    <td><small>{formatDate(post.published_at)}</small></td>
                                    <td>
                                        <div className="inline-actions">
                                            <Link className="icon-btn small" href={routeWithBase(`/admin/blogs/${post.id}/edit`, app_base)} aria-label="Edit blog">
                                                <Icon name="edit" size={13} />
                                            </Link>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(post)} aria-label="Delete blog">
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <AdminPagination paginator={posts} label="posts" />
            </section>
        </AdminLayout>
    );
}
