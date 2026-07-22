import { useEffect } from 'react';
import { Head, Link, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

export default function PosReceipt({ order }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('print') === '1') {
            window.setTimeout(() => window.print(), 250);
        }
    }, []);

    return (
        <AdminLayout title={order.receipt_number} eyebrow={t('POS receipt')} action={<button className="btn primary no-print" type="button" onClick={() => window.print()}><Icon name="receipt" size={14} /> {t('Print')}</button>}>
            <Head title={order.receipt_number} />
            <div className="sticky-toolbar no-print">
                <Link className="back-link" href={routeWithBase('/admin/pos', app_base)}><Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> {t('Back to POS')}</Link>
            </div>
            <section className="pos-receipt-paper">
                <header>
                    <h2>LaLaPick</h2>
                    <p>{[order.location?.name, order.register?.code].filter(Boolean).join(' / ') || t('Warehouse sale')}</p>
                    <strong>{order.receipt_number}</strong>
                    <span>{new Date(order.created_at).toLocaleString()}</span>
                </header>
                <table>
                    <tbody>
                        {order.items.map((item) => (
                            <tr key={item.id}>
                                <td><strong>{item.product.name}</strong><span>{item.sku?.sku_code} x {item.quantity}</span></td>
                                <td>{formatMoney(item.total_price)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="receipt-totals">
                    <span>{t('Subtotal')}</span><strong>{formatMoney(order.total_amount)}</strong>
                    <span>{t('Discount')}</span><strong>-{formatMoney(order.discount_amount || 0)}</strong>
                    <span>{t('Total')}</span><strong>{formatMoney(order.final_amount)}</strong>
                    <span>{t('Tender')}</span><strong>{t(order.pos_tender_summary?.tender_type || order.payment_method)}</strong>
                </div>
                <footer>
                    {t('Served by')} {order.server?.name || order.shift?.cashier?.name || t('Staff')}
                </footer>
            </section>
        </AdminLayout>
    );
}
