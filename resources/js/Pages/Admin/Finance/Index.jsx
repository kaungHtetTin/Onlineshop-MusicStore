import { useMemo, useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const money = (value) =>
    `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const emptyEntry = {
    type: 'expense',
    category: 'inventory',
    title: '',
    amount: '',
    entry_date: new Date().toISOString().slice(0, 10),
    payment_method: '',
    reference: '',
    status: 'approved',
    notes: '',
};

function MetricCard({ label, value, icon, tone }) {
    return (
        <article className={`metric-card glass ${tone ? `tone-${tone}` : ''}`}>
            <span className="icon-well">
                <Icon name={icon} size={15} />
            </span>
            <small>{label}</small>
            <strong>{value}</strong>
        </article>
    );
}

function categoryLabel(options, type, value) {
    return (options.categories?.[type] || []).find((item) => item.value === value)?.label || value;
}

function DailyFinanceChart({ trend }) {
    const chart = useMemo(() => {
        const rows = trend.map((row) => ({
            day: row.day,
            income: Number(row.income || 0),
            expenses: Number(row.expenses || 0),
            net: Number(row.net || 0),
        }));

        if (rows.length === 0) {
            return null;
        }

        const values = rows.flatMap((row) => [row.income, row.expenses, row.net, 0]);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const range = max - min || 1;
        const width = 720;
        const height = 260;
        const padding = { top: 18, right: 18, bottom: 34, left: 64 };
        const innerWidth = width - padding.left - padding.right;
        const innerHeight = height - padding.top - padding.bottom;
        const xFor = (index) => padding.left + (rows.length === 1 ? innerWidth / 2 : (index / (rows.length - 1)) * innerWidth);
        const yFor = (value) => padding.top + ((max - value) / range) * innerHeight;
        const lineFor = (key) => rows.map((row, index) => `${xFor(index)},${yFor(row[key])}`).join(' ');
        const ticks = Array.from({ length: 5 }, (_, index) => min + (range / 4) * index).reverse();
        const labelStep = Math.max(1, Math.ceil(rows.length / 5));

        return {
            rows,
            width,
            height,
            padding,
            innerWidth,
            xFor,
            yFor,
            lineFor,
            ticks,
            labelStep,
            zeroY: yFor(0),
            latest: rows[rows.length - 1],
        };
    }, [trend]);

    if (!chart) {
        return (
            <div className="finance-chart-empty">
                <span className="muted">No finance data in this period.</span>
            </div>
        );
    }

    const series = [
        { key: 'income', label: 'Income', className: 'income' },
        { key: 'expenses', label: 'Expenses', className: 'expenses' },
        { key: 'net', label: 'Net', className: 'net' },
    ];

    return (
        <div className="finance-chart">
            <div className="finance-chart-summary">
                {series.map((item) => (
                    <div key={item.key}>
                        <span className={`chart-dot ${item.className}`} />
                        <small>{item.label}</small>
                        <strong>{money(chart.latest[item.key])}</strong>
                    </div>
                ))}
            </div>
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Daily finance trend line chart">
                {chart.ticks.map((tick) => (
                    <g key={tick}>
                        <line
                            className="chart-grid-line"
                            x1={chart.padding.left}
                            x2={chart.width - chart.padding.right}
                            y1={chart.yFor(tick)}
                            y2={chart.yFor(tick)}
                        />
                        <text className="chart-y-label" x={chart.padding.left - 10} y={chart.yFor(tick) + 4}>
                            {money(tick)}
                        </text>
                    </g>
                ))}
                <line
                    className="chart-zero-line"
                    x1={chart.padding.left}
                    x2={chart.width - chart.padding.right}
                    y1={chart.zeroY}
                    y2={chart.zeroY}
                />
                {series.map((item) => (
                    <polyline
                        key={item.key}
                        className={`chart-line ${item.className}`}
                        points={chart.lineFor(item.key)}
                    />
                ))}
                {series.map((item) => chart.rows.map((row, index) => (
                    <circle
                        key={`${item.key}-${row.day}`}
                        className={`chart-point ${item.className}`}
                        cx={chart.xFor(index)}
                        cy={chart.yFor(row[item.key])}
                        r="3.5"
                    >
                        <title>{`${row.day} ${item.label}: ${money(row[item.key])}`}</title>
                    </circle>
                )))}
                {chart.rows.map((row, index) => (
                    (index % chart.labelStep === 0 || index === chart.rows.length - 1) && (
                        <text key={row.day} className="chart-x-label" x={chart.xFor(index)} y={chart.height - 10}>
                            {row.day.slice(5)}
                        </text>
                    )
                ))}
            </svg>
        </div>
    );
}

function LedgerPagination({ paginator }) {
    if (!paginator || paginator.last_page <= 1) {
        return null;
    }

    return (
        <div className="ledger-pagination">
            <small>
                Showing {paginator.from || 0}-{paginator.to || 0} of {paginator.total} entries
            </small>
            <div className="pagination-links">
                {paginator.links.map((link, index) => {
                    const label = link.label
                        .replace('&laquo;', 'Previous')
                        .replace('&raquo;', 'Next');

                    if (!link.url) {
                        return (
                            <span
                                key={`${label}-${index}`}
                                className={`pagination-link disabled ${link.active ? 'active' : ''}`}
                            >
                                {label}
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={`${label}-${index}`}
                            href={link.url}
                            className={`pagination-link ${link.active ? 'active' : ''}`}
                            preserveScroll
                        >
                            {label}
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export default function FinanceIndex({ entries, summary, trend, filters, options }) {
    const { app_base, flash } = usePage().props;
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [search, setSearch] = useState(filters.q ?? '');
    const form = useForm({ ...emptyEntry });

    const categoryOptions = useMemo(() => {
        if (filters.type && options.categories?.[filters.type]) return options.categories[filters.type];
        return [...(options.categories?.income || []), ...(options.categories?.expense || [])];
    }, [filters.type, options.categories]);

    const formCategoryOptions = options.categories?.[form.data.type] || [];

    const applyFilters = (patch) => {
        router.get(
            routeWithBase('/admin/finance', app_base),
            { ...filters, ...patch },
            { preserveState: true, replace: true },
        );
    };

    const submitSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const openModal = (entry = null) => {
        setEditing(entry);
        form.clearErrors();
        form.setData(
            entry
                ? {
                      type: entry.type,
                      category: entry.category,
                      title: entry.title,
                      amount: entry.amount,
                      entry_date: entry.entry_date ? entry.entry_date.slice(0, 10) : emptyEntry.entry_date,
                      payment_method: entry.payment_method || '',
                      reference: entry.reference || '',
                      status: entry.status,
                      notes: entry.notes || '',
                  }
                : { ...emptyEntry },
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
        if (editing) {
            form.patch(routeWithBase(`/admin/finance/entries/${editing.id}`, app_base), options);
        } else {
            form.post(routeWithBase('/admin/finance/entries', app_base), options);
        }
    };

    const remove = (entry) => {
        if (!confirm(`Delete "${entry.title}"?`)) return;
        router.delete(routeWithBase(`/admin/finance/entries/${entry.id}`, app_base), { preserveScroll: true });
    };

    const resetFilters = () => router.get(routeWithBase('/admin/finance', app_base));

    return (
        <AdminLayout
            title="Finance"
            eyebrow="Financial control"
            action={
                <button type="button" className="btn primary" onClick={() => openModal()}>
                    <Icon name="plus" size={14} />
                    Add entry
                </button>
            }
        >
            <Head title="Finance" />
            <AdminFlash flash={flash} errors={form.errors} />

            <div className="metrics-grid six">
                <MetricCard label="Order revenue" value={money(summary.order_revenue)} icon="receipt" />
                <MetricCard label="Manual income" value={money(summary.manual_income)} icon="wallet" />
                <MetricCard label="Expenses" value={money(summary.expenses)} icon="card" tone="danger" />
                <MetricCard label="Net profit" value={money(summary.net_profit)} icon="chart" tone={summary.net_profit < 0 ? 'danger' : 'success'} />
                <MetricCard label="Paid orders" value={summary.paid_orders} icon="check" />
                <MetricCard label="Pending review" value={money(Number(summary.pending_income) + Number(summary.pending_expenses))} icon="bell" />
            </div>

            <section className="panel glass" style={{ marginBottom: 14 }}>
                <PanelHeading eyebrow="Period controls" title="Finance filters" />
                <form className="finance-filter" onSubmit={submitSearch}>
                    <div className="finance-filter-row search-row">
                        <div className="search-box">
                            <Icon name="search" size={16} />
                            <input placeholder="Search title, reference, notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <button type="submit" className="btn primary">Search</button>
                    </div>
                    <div className="finance-filter-row controls-row">
                        <label className="form-field inline">
                            <span>From</span>
                            <input type="date" value={filters.from || ''} onChange={(e) => applyFilters({ from: e.target.value || undefined })} />
                        </label>
                        <label className="form-field inline">
                            <span>To</span>
                            <input type="date" value={filters.to || ''} onChange={(e) => applyFilters({ to: e.target.value || undefined })} />
                        </label>
                        <select value={filters.type || ''} onChange={(e) => applyFilters({ type: e.target.value || undefined, category: undefined })}>
                            <option value="">All types</option>
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                        </select>
                        <select value={filters.status || ''} onChange={(e) => applyFilters({ status: e.target.value || undefined })}>
                            <option value="">All statuses</option>
                            {options.statuses.map((status) => (
                                <option key={status} value={status}>
                                    {status}
                                </option>
                            ))}
                        </select>
                        <select value={filters.category || ''} onChange={(e) => applyFilters({ category: e.target.value || undefined })}>
                            <option value="">All categories</option>
                            {categoryOptions.map((category) => (
                                <option key={`${category.value}-${category.label}`} value={category.value}>
                                    {category.label}
                                </option>
                            ))}
                        </select>
                        <button type="button" className="btn secondary" onClick={resetFilters}>Reset</button>
                    </div>
                </form>
            </section>

            <div className="finance-grid finance-grid-full">
                <section className="panel glass">
                    <PanelHeading eyebrow={`${summary.from} to ${summary.to}`} title="Daily finance trend" />
                    <DailyFinanceChart trend={trend} />
                </section>
            </div>

            <section className="panel glass" style={{ marginTop: 14 }}>
                <PanelHeading eyebrow="Manual ledger" title="Income and expense entries" />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Entry</th>
                                <th>Type</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Recorded by</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {entries.data.length === 0 ? (
                                <tr><td colSpan={7}><span className="muted">No manual finance entries match your filters.</span></td></tr>
                            ) : entries.data.map((entry) => {
                                const isStockReceiptEntry = entry.is_stock_receipt_entry || entry.category === 'stock_receipt';

                                return (
                                    <tr key={entry.id}>
                                        <td>{entry.entry_date?.slice(0, 10)}</td>
                                        <td>
                                            <strong>{entry.title}</strong>
                                            <small>
                                                {categoryLabel(options, entry.type, entry.category)}
                                                {entry.reference ? ` / ${entry.reference}` : ''}
                                            </small>
                                        </td>
                                        <td><StatusBadge status={entry.type === 'income' ? 'success' : 'warning'} label={entry.type} /></td>
                                        <td><strong>{money(entry.amount)}</strong></td>
                                        <td><StatusBadge status={entry.status} label={entry.status} /></td>
                                        <td>{entry.recorder?.name || 'System'}</td>
                                        <td>
                                            {isStockReceiptEntry ? (
                                                <span className="muted">Managed by receipt</span>
                                            ) : (
                                                <div className="inline-actions">
                                                    <button type="button" className="icon-btn small" onClick={() => openModal(entry)} aria-label="Edit entry">
                                                        <Icon name="edit" size={13} />
                                                    </button>
                                                    <button type="button" className="icon-btn small danger" onClick={() => remove(entry)} aria-label="Delete entry">
                                                        <Icon name="trash" size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <LedgerPagination paginator={entries} />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form className="operation-modal compact glass" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Finance entry</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{editing ? 'Edit entry' : 'New entry'}</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>

                        <div className="crud-grid">
                            <label className="form-field">
                                <span>Type</span>
                                <select
                                    value={form.data.type}
                                    onChange={(e) => {
                                        const type = e.target.value;
                                        form.setData({
                                            ...form.data,
                                            type,
                                            category: options.categories?.[type]?.[0]?.value || '',
                                        });
                                    }}
                                >
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                </select>
                            </label>
                            <label className="form-field">
                                <span>Category</span>
                                <select value={form.data.category} onChange={(e) => form.setData('category', e.target.value)}>
                                    {formCategoryOptions.map((category) => (
                                        <option key={category.value} value={category.value}>{category.label}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="form-field">
                                <span>Title</span>
                                <input value={form.data.title} onChange={(e) => form.setData('title', e.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>Amount</span>
                                <input type="number" step="0.01" min="0.01" value={form.data.amount} onChange={(e) => form.setData('amount', e.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>Date</span>
                                <input type="date" value={form.data.entry_date} onChange={(e) => form.setData('entry_date', e.target.value)} required />
                            </label>
                            <label className="form-field">
                                <span>Status</span>
                                <select value={form.data.status} onChange={(e) => form.setData('status', e.target.value)}>
                                    <option value="approved">Approved</option>
                                    <option value="pending">Pending</option>
                                    <option value="void">Void</option>
                                </select>
                            </label>
                            <label className="form-field">
                                <span>Payment method</span>
                                <input value={form.data.payment_method} onChange={(e) => form.setData('payment_method', e.target.value)} placeholder="Cash, bank, wallet..." />
                            </label>
                            <label className="form-field">
                                <span>Reference</span>
                                <input value={form.data.reference} onChange={(e) => form.setData('reference', e.target.value)} placeholder="Receipt or transaction ID" />
                            </label>
                            <label className="form-field full">
                                <span>Notes</span>
                                <textarea value={form.data.notes} onChange={(e) => form.setData('notes', e.target.value)} rows={3} />
                            </label>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>{editing ? 'Save changes' : 'Create entry'}</button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
