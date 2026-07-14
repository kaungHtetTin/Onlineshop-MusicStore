export const adminRoleLabels = {
    super_admin: 'Super Admin',
    manager: 'Manager',
    cashier: 'Cashier',
    support: 'Support',
};

export function roleStatusClass(role) {
    if (role === 'super_admin') return 'status-info';
    if (role === 'manager') return 'status-success';
    if (role === 'cashier') return 'status-warning';
    if (role === 'support') return 'status-neutral';
    return 'status-neutral';
}
