import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import TransferDocumentForm from '@/Components/Admin/TransferDocumentForm';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function TransferCreate({ locations, categories = [] }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();

    return (
        <AdminLayout title={t('New transfer')} eyebrow={t('Inventory')}>
            <Head title={t('New Transfer')} />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory/transfers', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> {t('Back to transfers')}
                </Link>
            </div>
            <TransferDocumentForm locations={locations} categories={categories} />
        </AdminLayout>
    );
}
