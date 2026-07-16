export const adminRoleLabels = {
    super_admin: 'Admin',
    manager: 'Manager',
    inventory_staff: 'Inventory Staff',
    sales: 'Sales',
    support: 'Support',
};

export function roleStatusClass(role) {
    if (role === 'super_admin') return 'status-info';
    if (role === 'manager') return 'status-success';
    if (role === 'inventory_staff') return 'status-warning';
    if (role === 'sales') return 'status-warning';
    if (role === 'support') return 'status-neutral';
    return 'status-neutral';
}
