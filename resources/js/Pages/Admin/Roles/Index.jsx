import { useEffect, useMemo, useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';

const createDefaults = {
    name: '',
    display_name: '',
    description: '',
    permissions: [],
};

function PermissionGroups({ groups, selected, disabled, onChange }) {
    const toggleGroup = (items, checked) => {
        const names = items.map((item) => item.value);
        const next = checked
            ? [...new Set([...selected, ...names])]
            : selected.filter((name) => !names.includes(name));
        onChange(next);
    };

    return (
        <div className="permission-group-grid">
            {groups.map((group) => {
                const selectedCount = group.items.filter((item) => selected.includes(item.value)).length;
                const allSelected = selectedCount === group.items.length;

                return (
                    <fieldset key={group.group} className="permission-group" disabled={disabled}>
                        <legend>
                            <span>{group.group}</span>
                            <label className="permission-group-toggle">
                                <input
                                    type="checkbox"
                                    checked={allSelected}
                                    onChange={(event) => toggleGroup(group.items, event.target.checked)}
                                />
                                <small>{selectedCount}/{group.items.length}</small>
                            </label>
                        </legend>
                        <div className="permission-options">
                            {group.items.map((permission) => (
                                <label key={permission.value} className="permission-option">
                                    <input
                                        type="checkbox"
                                        checked={selected.includes(permission.value)}
                                        onChange={(event) => {
                                            onChange(
                                                event.target.checked
                                                    ? [...selected, permission.value]
                                                    : selected.filter((name) => name !== permission.value),
                                            );
                                        }}
                                    />
                                    <span>{permission.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>
                );
            })}
        </div>
    );
}

export default function RolesIndex({ roles, permissionGroups }) {
    const { app_base, flash } = usePage().props;
    const [selectedName, setSelectedName] = useState(roles[0]?.name || null);
    const [createOpen, setCreateOpen] = useState(false);
    const selectedRole = useMemo(
        () => roles.find((role) => role.name === selectedName) || roles[0] || null,
        [roles, selectedName],
    );
    const form = useForm({ display_name: '', description: '', permissions: [] });
    const createForm = useForm({ ...createDefaults });

    useEffect(() => {
        if (!selectedRole) return;
        form.setData({
            display_name: selectedRole.display_name,
            description: selectedRole.description || '',
            permissions: selectedRole.permissions || [],
        });
        form.clearErrors();
    }, [selectedRole?.id, selectedRole?.display_name, selectedRole?.description, selectedRole?.permissions]);

    const saveRole = (event) => {
        event.preventDefault();
        if (!selectedRole || selectedRole.is_locked) return;

        form.patch(routeWithBase(`/admin/roles/${selectedRole.id}`, app_base), {
            preserveScroll: true,
        });
    };

    const openCreate = () => {
        createForm.setData({ ...createDefaults });
        createForm.clearErrors();
        setCreateOpen(true);
    };

    const submitCreate = (event) => {
        event.preventDefault();
        createForm.post(routeWithBase('/admin/roles', app_base), {
            preserveScroll: true,
            onSuccess: () => setCreateOpen(false),
        });
    };

    const deleteRole = () => {
        if (!selectedRole || selectedRole.is_system || selectedRole.users_count > 0) return;
        if (!confirm(`Delete ${selectedRole.display_name}?`)) return;

        router.delete(routeWithBase(`/admin/roles/${selectedRole.id}`, app_base), {
            preserveScroll: true,
            onSuccess: () => setSelectedName(roles.find((role) => role.name !== selectedRole.name)?.name || null),
        });
    };

    return (
        <AdminLayout
            title="Roles & permissions"
            eyebrow="Access control"
            action={
                <button type="button" className="btn primary" onClick={openCreate}>
                    <Icon name="plus" size={14} />
                    Add role
                </button>
            }
        >
            <Head title="Roles & Permissions" />
            <AdminFlash flash={flash} errors={{ ...form.errors, ...createForm.errors }} />

            <section className="panel glass">
                <PanelHeading eyebrow="Team access" title="Roles & permissions" />

                <div className="role-permission-layout">
                    <aside className="role-list" aria-label="Admin roles">
                        {roles.map((role) => (
                            <button
                                key={role.name}
                                type="button"
                                className={`role-list-item ${selectedRole?.name === role.name ? 'active' : ''}`}
                                onClick={() => setSelectedName(role.name)}
                            >
                                <span>
                                    <strong>{role.display_name}</strong>
                                    <small>{role.users_count} staff</small>
                                </span>
                                <small>{role.permissions.length}</small>
                            </button>
                        ))}
                    </aside>

                    {selectedRole && (
                        <form className="role-editor" onSubmit={saveRole}>
                            <div className="role-editor-header">
                                <div>
                                    <div className="inline-actions">
                                        <h2>{selectedRole.display_name}</h2>
                                        {selectedRole.is_system && <StatusBadge status="info" label="System role" />}
                                    </div>
                                    <code>{selectedRole.name}</code>
                                </div>
                                <span className="role-staff-count">
                                    <Icon name="users" size={15} />
                                    {selectedRole.users_count}
                                </span>
                            </div>

                            <div className="crud-grid role-fields">
                                <label className="form-field">
                                    <span>Display name</span>
                                    <input
                                        value={form.data.display_name}
                                        onChange={(event) => form.setData('display_name', event.target.value)}
                                        disabled={selectedRole.is_locked}
                                        required
                                    />
                                </label>
                                <label className="form-field">
                                    <span>Description</span>
                                    <input
                                        value={form.data.description}
                                        onChange={(event) => form.setData('description', event.target.value)}
                                        disabled={selectedRole.is_locked}
                                    />
                                </label>
                            </div>

                            <PermissionGroups
                                groups={permissionGroups}
                                selected={form.data.permissions || []}
                                disabled={selectedRole.is_locked}
                                onChange={(permissions) => form.setData('permissions', permissions)}
                            />

                            <div className="modal-actions role-editor-actions">
                                {!selectedRole.is_system && (
                                    <button
                                        type="button"
                                        className="btn danger"
                                        onClick={deleteRole}
                                        disabled={selectedRole.users_count > 0}
                                        title={selectedRole.users_count > 0 ? 'Move assigned staff before deleting' : undefined}
                                    >
                                        <Icon name="trash" size={14} />
                                        Delete
                                    </button>
                                )}
                                <button type="submit" className="btn primary" disabled={form.processing || selectedRole.is_locked}>
                                    <Icon name="check" size={14} />
                                    Save permissions
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </section>

            {createOpen && (
                <div className="modal-backdrop" onClick={() => setCreateOpen(false)}>
                    <form className="operation-modal glass role-create-modal" onSubmit={submitCreate} onClick={(event) => event.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Access control</p>
                                <h2>New role</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={() => setCreateOpen(false)} aria-label="Close">
                                <Icon name="close" size={14} />
                            </button>
                        </div>
                        <div className="crud-grid">
                            <label className="form-field">
                                <span>Display name</span>
                                <input
                                    value={createForm.data.display_name}
                                    onChange={(event) => createForm.setData('display_name', event.target.value)}
                                    required
                                />
                            </label>
                            <label className="form-field">
                                <span>System key</span>
                                <input
                                    value={createForm.data.name}
                                    onChange={(event) => createForm.setData('name', event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                    placeholder="regional_manager"
                                    required
                                />
                            </label>
                            <label className="form-field span-2">
                                <span>Description</span>
                                <input
                                    value={createForm.data.description}
                                    onChange={(event) => createForm.setData('description', event.target.value)}
                                />
                            </label>
                        </div>
                        <PermissionGroups
                            groups={permissionGroups}
                            selected={createForm.data.permissions || []}
                            disabled={false}
                            onChange={(permissions) => createForm.setData('permissions', permissions)}
                        />
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={() => setCreateOpen(false)}>
                                Cancel
                            </button>
                            <button type="submit" className="btn primary" disabled={createForm.processing}>
                                Create role
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
