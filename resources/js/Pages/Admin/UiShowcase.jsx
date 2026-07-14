import { Head } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';

const metrics = [
    { label: 'Active users', value: '2,431', hint: '+8.3% this week', icon: 'user' },
    { label: 'Total orders', value: '1,240', hint: '+2.1% this week', icon: 'receipt' },
    { label: 'Server status', value: 'Healthy', hint: '100% uptime', icon: 'check' },
    { label: 'Revenue', value: '$12,480', hint: '+5.7% this week', icon: 'wallet' },
];

export default function UiShowcase() {
    return (
        <AdminLayout title="UI Showcase" eyebrow="Design system reference">
            <Head title="Admin UI Showcase" />

            <div className="metrics-grid four">
                {metrics.map((m) => (
                    <article key={m.label} className="metric-card glass">
                        <span className="icon-well">
                            <Icon name={m.icon} size={15} />
                        </span>
                        <small>{m.label}</small>
                        <strong>{m.value}</strong>
                        <p>{m.hint}</p>
                    </article>
                ))}
            </div>

            <div className="admin-grid">
                <section className="panel glass">
                    <PanelHeading eyebrow="Forms" title="Form elements" />
                    <div className="crud-grid" style={{ padding: 0 }}>
                        <label className="form-field">
                            <span>Project name</span>
                            <input defaultValue="LaLaPick Admin" />
                        </label>
                        <label className="form-field">
                            <span>Admin email</span>
                            <input defaultValue="admin@lalapick.com" />
                        </label>
                        <label className="form-field span-2">
                            <span>Notes</span>
                            <textarea defaultValue="Compact operational forms with focus rings." />
                        </label>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button type="button" className="btn primary grow">
                            Save changes
                        </button>
                        <button type="button" className="btn secondary grow">
                            Cancel
                        </button>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Status" title="Semantic badges" />
                    <div className="stack-sm">
                        <StatusBadge status="success" label="Completed" />
                        <StatusBadge status="warning" label="Pending approval" />
                        <StatusBadge status="danger" label="Rejected" />
                        <StatusBadge status="info" label="In progress" />
                        <StatusBadge status="neutral" label="Inactive" />
                    </div>
                    <div className="alert-list" style={{ marginTop: 14 }}>
                        <div>
                            <span className="alert-icon warning">
                                <Icon name="bell" size={15} />
                            </span>
                            <p>
                                <strong>Storage at 92%</strong>
                                <small>Review media uploads - 1m ago</small>
                            </p>
                        </div>
                        <div>
                            <span className="alert-icon info">
                                <Icon name="check" size={15} />
                            </span>
                            <p>
                                <strong>API gateway stable</strong>
                                <small>All services healthy - 1m ago</small>
                            </p>
                        </div>
                    </div>
                </section>
            </div>

            <section className="panel glass" style={{ marginTop: 14 }}>
                <PanelHeading eyebrow="Tables" title="Recent activity" />
                <div className="filter-toolbar compact">
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input placeholder="Search activity..." />
                    </div>
                    <select defaultValue="">
                        <option value="">All types</option>
                        <option value="order">Orders</option>
                        <option value="product">Products</option>
                    </select>
                </div>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Action</th>
                                <th>Date</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3].map((i) => (
                                <tr key={i}>
                                    <td>
                                        <div className="rider-cell">
                                            <span>U{i}</span>
                                            <div>
                                                <strong>User {i}</strong>
                                                <small>Admin session</small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <strong>Updated product pricing</strong>
                                        <small>Catalog change</small>
                                    </td>
                                    <td>
                                        <small>Jun 9, 2026</small>
                                    </td>
                                    <td>
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" aria-label="More actions">
                                                <Icon name="edit" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
