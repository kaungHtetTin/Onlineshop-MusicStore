import { useRef, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const emptyMethod = {
    banking_service: '',
    account_name: '',
    account_no: '',
    icon: null,
    remove_icon: false,
    sort_order: 0,
    is_active: true,
};

export default function PaymentMethodsIndex({ methods, filters, activeCount = 0 }) {
    const { app_base, flash } = usePage().props;
    const [search, setSearch] = useState(filters.q ?? '');
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [iconPreview, setIconPreview] = useState(null);
    const [iconName, setIconName] = useState('');
    const iconInputRef = useRef(null);
    const form = useForm({ ...emptyMethod });

    const applyFilters = (patch) => {
        router.get(routeWithBase('/admin/payment-methods', app_base), { ...filters, ...patch }, { preserveState: true, replace: true });
    };

    const handleSearch = (e) => {
        e.preventDefault();
        applyFilters({ q: search.trim() || undefined });
    };

    const resetIconPreview = () => {
        if (iconPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(iconPreview);
        }
        setIconPreview(null);
        setIconName('');
    };

    const openModal = (method = null) => {
        resetIconPreview();
        setEditing(method);
        form.clearErrors();
        form.setData(
            method
                ? {
                      banking_service: method.banking_service || '',
                      account_name: method.account_name || '',
                      account_no: method.account_no || '',
                      icon: null,
                      remove_icon: false,
                      sort_order: method.sort_order ?? 0,
                      is_active: !!method.is_active,
                  }
                : { ...emptyMethod },
        );
        setIconPreview(method?.icon_url || null);
        setIconName(method?.icon_path ? 'Current icon' : '');
        setOpen(true);
    };

    const closeModal = () => {
        setOpen(false);
        setEditing(null);
        resetIconPreview();
        form.reset();
    };

    const handleIconChange = (e) => {
        const file = e.target.files?.[0] || null;
        if (iconPreview?.startsWith('blob:')) {
            URL.revokeObjectURL(iconPreview);
        }
        form.setData({ ...form.data, icon: file, remove_icon: false });
        setIconName(file?.name || (editing?.icon_url ? 'Current icon' : ''));
        setIconPreview(file ? URL.createObjectURL(file) : editing?.icon_url || null);
    };

    const removeIcon = () => {
        resetIconPreview();
        form.setData({ ...form.data, icon: null, remove_icon: true });
        if (iconInputRef.current) {
            iconInputRef.current.value = '';
        }
    };

    const submit = (e) => {
        e.preventDefault();
        const options = {
            preserveScroll: true,
            forceFormData: true,
            onSuccess: closeModal,
        };

        if (editing) {
            form.post(routeWithBase(`/admin/payment-methods/${editing.id}`, app_base), options);
        } else {
            form.post(routeWithBase('/admin/payment-methods', app_base), options);
        }
    };

    const remove = (method) => {
        if (!confirm(`Delete or deactivate ${method.banking_service}?`)) return;
        router.delete(routeWithBase(`/admin/payment-methods/${method.id}`, app_base), { preserveScroll: true });
    };

    return (
        <AdminLayout
            title="Payment methods"
            eyebrow="Checkout settings"
            action={
                <button type="button" className="btn primary" onClick={() => openModal()}>
                    <Icon name="plus" size={14} />
                    Add method
                </button>
            }
        >
            <Head title="Payment Methods" />
            <AdminFlash flash={flash} errors={form.errors} />

            <section className="panel glass">
                <PanelHeading eyebrow="Manual transfer accounts" title="Payment methods" />
                <form className="filter-toolbar" onSubmit={handleSearch}>
                    <div className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            placeholder="Search service, account name or number..."
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
                        onClick={() => router.get(routeWithBase('/admin/payment-methods', app_base))}
                    >
                        Reset filters
                    </button>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 160px))', gap: 10, marginBottom: 12 }}>
                    <div>
                        <span>Total methods</span>
                        <strong>{methods.total}</strong>
                    </div>
                    <div>
                        <span>Active on checkout</span>
                        <strong>{activeCount}</strong>
                    </div>
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Account name</th>
                                <th>Account no.</th>
                                <th>Sort</th>
                                <th>Status</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {methods.data.length === 0 ? (
                                <tr><td colSpan={6}><span className="muted">No payment methods found.</span></td></tr>
                            ) : methods.data.map((method) => (
                                <tr key={method.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            {method.icon_url ? (
                                                <img
                                                    src={method.icon_url}
                                                    alt=""
                                                    style={{ width: 30, height: 30, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }}
                                                />
                                            ) : (
                                                <span className="icon-btn small" style={{ pointerEvents: 'none' }}>
                                                    <Icon name="wallet" size={14} />
                                                </span>
                                            )}
                                            <strong>{method.banking_service}</strong>
                                        </div>
                                    </td>
                                    <td>{method.account_name}</td>
                                    <td><code>{method.account_no}</code></td>
                                    <td>{method.sort_order ?? 0}</td>
                                    <td>
                                        <StatusBadge
                                            status={method.is_active ? 'success' : 'neutral'}
                                            label={method.is_active ? 'Active' : 'Inactive'}
                                        />
                                    </td>
                                    <td>
                                        <div className="inline-actions">
                                            <button type="button" className="icon-btn small" onClick={() => openModal(method)} aria-label="Edit payment method">
                                                <Icon name="edit" size={13} />
                                            </button>
                                            <button type="button" className="icon-btn small danger" onClick={() => remove(method)} aria-label="Delete payment method">
                                                <Icon name="trash" size={13} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={methods} label="payment methods" />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form className="operation-modal compact glass" onSubmit={submit} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Payment method</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>{editing ? 'Edit method' : 'New method'}</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>

                        <div className="crud-grid">
                            <label className="form-field">
                                <span>Banking service</span>
                                <input
                                    value={form.data.banking_service}
                                    onChange={(e) => form.setData('banking_service', e.target.value)}
                                    placeholder="KBZ Pay, AYA Bank, WavePay..."
                                    required
                                />
                                {form.errors.banking_service && <small className="field-error">{form.errors.banking_service}</small>}
                            </label>
                            <label className="form-field">
                                <span>Account name</span>
                                <input
                                    value={form.data.account_name}
                                    onChange={(e) => form.setData('account_name', e.target.value)}
                                    required
                                />
                                {form.errors.account_name && <small className="field-error">{form.errors.account_name}</small>}
                            </label>
                            <label className="form-field">
                                <span>Account no.</span>
                                <input
                                    value={form.data.account_no}
                                    onChange={(e) => form.setData('account_no', e.target.value)}
                                    required
                                />
                                {form.errors.account_no && <small className="field-error">{form.errors.account_no}</small>}
                            </label>
                            <label className="form-field">
                                <span>Sort order</span>
                                <input
                                    type="number"
                                    min="0"
                                    value={form.data.sort_order}
                                    onChange={(e) => form.setData('sort_order', e.target.value)}
                                />
                                {form.errors.sort_order && <small className="field-error">{form.errors.sort_order}</small>}
                            </label>
                            <label className="form-field span-2">
                                <span>Icon (optional)</span>
                                <input
                                    ref={iconInputRef}
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                    onChange={handleIconChange}
                                    style={{ display: 'none' }}
                                />
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '52px 1fr auto',
                                        gap: 12,
                                        alignItems: 'center',
                                        minHeight: 72,
                                        padding: 10,
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 8,
                                        background: 'rgba(255,255,255,0.72)',
                                    }}
                                >
                                    <button
                                        type="button"
                                        onClick={() => iconInputRef.current?.click()}
                                        aria-label="Choose payment method icon"
                                        style={{
                                            width: 52,
                                            height: 52,
                                            borderRadius: 8,
                                            border: '1px solid var(--color-border)',
                                            background: iconPreview ? '#fff' : 'rgba(8, 127, 116, 0.08)',
                                            display: 'grid',
                                            placeItems: 'center',
                                            overflow: 'hidden',
                                            color: 'var(--color-primary)',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {iconPreview ? (
                                            <img
                                                src={iconPreview}
                                                alt=""
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <Icon name="image" size={20} />
                                        )}
                                    </button>
                                    <div style={{ minWidth: 0 }}>
                                        <strong style={{ display: 'block', fontSize: 13 }}>
                                            {iconName || 'No icon selected'}
                                        </strong>
                                        <small className="muted">
                                            JPG, PNG, WebP or SVG. Square icon works best.
                                        </small>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        <button type="button" className="btn secondary" onClick={() => iconInputRef.current?.click()}>
                                            <Icon name="image" size={13} />
                                            Upload
                                        </button>
                                        {iconPreview && (
                                            <button type="button" className="btn secondary" onClick={removeIcon}>
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {form.errors.icon && <small className="field-error">{form.errors.icon}</small>}
                            </label>
                            <label className="form-field checkbox-row">
                                <input
                                    type="checkbox"
                                    checked={form.data.is_active}
                                    onChange={(e) => form.setData('is_active', e.target.checked)}
                                />
                                <span>Active on checkout</span>
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>
                                {editing ? 'Save changes' : 'Create method'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
