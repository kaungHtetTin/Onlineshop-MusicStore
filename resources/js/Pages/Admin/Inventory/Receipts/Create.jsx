import { Head, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import InventoryDocumentForm from '@/Components/Admin/InventoryDocumentForm';
import { routeWithBase } from '@/Utils/url';

export default function ReceiptCreate({ locations, categories = [] }) {
    const { app_base } = usePage().props;
    return <AdminLayout title="Receive stock" eyebrow="Inventory"><Head title="Receive Stock" /><div className="sticky-toolbar"><Link className="back-link" href={routeWithBase('/admin/inventory/receipts', app_base)}><Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> Back to receipts</Link></div><InventoryDocumentForm type="receipt" locations={locations} categories={categories} /></AdminLayout>;
}
