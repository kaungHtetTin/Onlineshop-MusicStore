import { useMemo, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const emptyLocation = {
    code: '',
    name: '',
    type: 'warehouse',
    address: '',
    phone: '',
    timezone: 'Asia/Yangon',
    is_active: true,
    is_default_fulfillment: false,
    staff_ids: [],
};

export default function LocationsIndex({ locations, staff, canManage }) {
    const { app_base, flash } = usePage().props;
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const form = useForm({ ...emptyLocation });
    const activeCount = useMemo(() => locations.filter((location) => location.is_active).length, [locations]);

    const openCreate = () => {
        setEditing(null);
        form.setData({ ...emptyLocation });
        form.clearErrors();
        setOpen(true);
    };

    const openEdit = (location) => {
        setEditing(location);
        form.setData({
            code: location.code,
            name: location.name,
            type: location.type,
            address: location.address || '',
            phone: location.phone || '',
            timezone: location.timezone || 'Asia/Yangon',
            is_active: Boolean(location.is_active),
            is_default_fulfillment: Boolean(location.is_default_fulfillment),
            staff_ids: location.staff_ids || [],
        });
        form.clearErrors();
        setOpen(true);
    };

    const closeModal = () => {
        if (form.processing) return;
        setOpen(false);
        setEditing(null);
        form.reset();
    };

    const submit = (event) => {
        event.preventDefault();
        const options = { preserveScroll: true, onSuccess: closeModal };

        if (editing) {
            form.patch(routeWithBase(`/admin/locations/${editing.id}`, app_base), options);
            return;
        }

        form.post(routeWithBase('/admin/locations', app_base), options);
    };

    const removeLocation = (location) => {
        if (location.is_system || !confirm(`Delete ${location.name}?`)) return;
        router.delete(routeWithBase(`/admin/locations/${location.id}`, app_base), { preserveScroll: true });
    };

    const toggleStaff = (staffId) => {
        const selected = form.data.staff_ids || [];
        form.setData(
            'staff_ids',
            selected.includes(staffId) ? selected.filter((id) => id !== staffId) : [...selected, staffId],
        );
    };

    return (
        <AdminLayout
            title="Warehouses"
            eyebrow="Inventory"
            action={
                canManage ? (
                    <button type="button" className="btn primary" onClick={openCreate}>
                        <Icon name="plus" size={14} />
                        Add warehouse
                    </button>
                ) : null
            }
        >
            <Head title="Warehouses" />
            <AdminFlash flash={flash} errors={form.errors} />

            <section className="location-summary" aria-label="Warehouse summary">
                <div>
                    <span>Warehouses</span>
                    <strong>{locations.length}</strong>
                </div>
                <div>
                    <span>Active</span>
                    <strong>{activeCount}</strong>
                </div>
                <div>
                    <span>Total units</span>
                    <strong>{locations.reduce((sum, item) => sum + item.on_hand_total, 0)}</strong>
                </div>
                <div>
                    <span>Assigned staff</span>
                    <strong>{new Set(locations.flatMap((item) => item.staff_ids || [])).size}</strong>
                </div>
            </section>

            <section className="panel glass">
                <PanelHeading eyebrow="Warehouse management" title="Stock warehouses" />
                <div className="table-wrap">
                    <table className="data-table location-table">
                        <thead>
                            <tr>
                                <th>Warehouse</th>
                                <th>Inventory</th>
                                <th>Assigned staff</th>
                                <th>Status</th>
                                {canManage && <th aria-label="Actions" />}
                            </tr>
                        </thead>
                        <tbody>
                            {locations.map((location) => (
                                <tr key={location.id}>
                                    <td>
                                        <div className="location-name-cell">
                                            <span className="location-icon">
                                                <Icon name="box" size={17} />
                                            </span>
                                            <div>
                                                <strong>{location.name}</strong>
                                                <small>
                                                    {location.code}
                                                    {location.is_default_fulfillment ? ' / Default fulfillment' : ''}
                                                </small>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <strong>{location.on_hand_total.toLocaleString()}</strong>
                                        <small className="table-subline">{location.balances_count} SKUs</small>
                                    </td>
                                    <td>
                                        <div className="location-staff-stack">
                                            {location.staff.slice(0, 3).map((member) => (
                                                <span key={member.id} title={`${member.name} / ${member.role_label}`}>
                                                    {member.name.slice(0, 2).toUpperCase()}
                                                </span>
                                            ))}
                                            {location.staff.length > 3 && <small>+{location.staff.length - 3}</small>}
                                            {location.staff.length === 0 && <small className="muted">Unassigned</small>}
                                        </div>
                                    </td>
                                    <td>
                                        <StatusBadge
                                            status={location.is_active ? 'success' : 'inactive'}
                                            label={location.is_active ? 'Active' : 'Inactive'}
                                        />
                                    </td>
                                    {canManage && (
                                        <td>
                                            <div className="inline-actions">
                                                <button type="button" className="icon-btn small" onClick={() => openEdit(location)} aria-label={`Edit ${location.name}`}>
                                                    <Icon name="edit" size={13} />
                                                </button>
                                                {!location.is_system && (
                                                    <button type="button" className="icon-btn small danger" onClick={() => removeLocation(location)} aria-label={`Delete ${location.name}`}>
                                                        <Icon name="trash" size={13} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {open && (
                <div className="modal-backdrop" onClick={closeModal}>
                    <form className="operation-modal glass location-modal" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Inventory network</p>
                                <h2>{editing ? 'Edit warehouse' : 'New warehouse'}</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={closeModal} aria-label="Close">
                                <Icon name="close" size={14} />
                            </button>
                        </div>

                        <div className="location-form-section">
                            <div className="crud-grid">
                                <label className="form-field">
                                    <span>Name</span>
                                    <input value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} required />
                                </label>
                                <label className="form-field">
                                    <span>Code</span>
                                    <input
                                        value={form.data.code}
                                        onChange={(event) => form.setData('code', event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                                        disabled={Boolean(editing?.is_system)}
                                        required
                                    />
                                </label>
                                <label className="form-field">
                                    <span>Phone</span>
                                    <input value={form.data.phone} onChange={(event) => form.setData('phone', event.target.value)} />
                                </label>
                                <label className="form-field">
                                    <span>Timezone</span>
                                    <input value={form.data.timezone} onChange={(event) => form.setData('timezone', event.target.value)} required />
                                </label>
                                <label className="form-field span-2">
                                    <span>Address</span>
                                    <textarea rows="2" value={form.data.address} onChange={(event) => form.setData('address', event.target.value)} />
                                </label>
                            </div>
                            <div className="location-switches">
                                <label><input type="checkbox" checked={form.data.is_active} onChange={(event) => form.setData('is_active', event.target.checked)} /> Active</label>
                                <label><input type="checkbox" checked={form.data.is_default_fulfillment} onChange={(event) => form.setData('is_default_fulfillment', event.target.checked)} /> Default fulfillment warehouse</label>
                            </div>
                        </div>

                        <div className="location-form-section">
                            <div className="location-section-heading">
                                <strong>Assigned staff</strong>
                                <small>{form.data.staff_ids.length} selected</small>
                            </div>
                            <div className="location-staff-options">
                                {staff.map((member) => (
                                    <label key={member.id}>
                                        <input type="checkbox" checked={form.data.staff_ids.includes(member.id)} onChange={() => toggleStaff(member.id)} />
                                        <span>
                                            <strong>{member.name}</strong>
                                            <small>{member.role_label} / {member.email}</small>
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={closeModal}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={form.processing}>
                                <Icon name="check" size={14} />
                                {editing ? 'Save warehouse' : 'Create warehouse'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
