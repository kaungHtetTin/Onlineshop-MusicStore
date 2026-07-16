import { Head, Link, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import TransferDocumentForm from '@/Components/Admin/TransferDocumentForm';
import { routeWithBase } from '@/Utils/url';

export default function TransferCreate({ locations, categories = [] }) {
    const { app_base } = usePage().props;

    return (
        <AdminLayout title="New transfer" eyebrow="Inventory">
            <Head title="New Transfer" />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory/transfers', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> Back to transfers
                </Link>
            </div>
            <TransferDocumentForm locations={locations} categories={categories} />
        </AdminLayout>
    );
}
