import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import useInventoryRealtime from '@/Utils/useInventoryRealtime';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function TransferShow({ transfer, lastUpdated, pollIntervalMs = 20000 }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const { state: realtimeState, lastEventAt } = useInventoryRealtime({
        locationIds: [transfer.source_location_id, transfer.destination_location_id],
        transferId: transfer.id,
        only: ['transfer', 'lastUpdated'],
        pollIntervalMs,
        listenBalance: false,
        listenTransfers: true,
    });
    const totalUnits = transfer.items.reduce((sum, item) => sum + Number(item.requested_quantity || 0), 0);

    return (
        <AdminLayout title={transfer.transfer_number} eyebrow={t('Stock transfer')}>
            <Head title={transfer.transfer_number} />
            <AdminFlash flash={flash} />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory/transfers', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> {t('Back to transfers')}
                </Link>
            </div>

            <section className="receipt-detail-card panel glass">
                <PanelHeading
                    eyebrow={t('Transfer summary')}
                    title={t('Warehouse stock movement')}
                    action={<small className="muted">{t('Realtime')} {t(realtimeState)} - {t('Updated')} {new Date(lastEventAt || lastUpdated).toLocaleTimeString()}</small>}
                />
                <div className="receipt-detail-meta">
                    <div><span>{t('From')}</span><strong>{transfer.source_location.name}</strong><small>{transfer.source_location.code}</small></div>
                    <div><span>{t('To')}</span><strong>{transfer.destination_location.name}</strong><small>{transfer.destination_location.code}</small></div>
                    <div><span>{t('Moved')}</span><strong>{t(':count units', { count: totalUnits })}</strong><small>{new Date(transfer.created_at).toLocaleString()}</small></div>
                </div>

                <div className="receipt-lines-table table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>{t('Product / SKU')}</th>
                                <th>{t('Quantity moved')}</th>
                                <th>{t('Source change')}</th>
                                <th>{t('Destination change')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transfer.items.map((item) => (
                                <tr key={item.id}>
                                    <td><strong>{item.sku.product.name}</strong><small className="table-subline">{item.sku.sku_code}</small></td>
                                    <td className="quantity-cell strong">{item.requested_quantity}</td>
                                    <td className="quantity-cell quantity-negative">-{item.requested_quantity}</td>
                                    <td className="quantity-cell quantity-positive">+{item.requested_quantity}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </AdminLayout>
    );
}
