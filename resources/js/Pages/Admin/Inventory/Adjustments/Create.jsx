import { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';

export default function AdjustmentCreate({ locations, reasons, selectedSku, selectedLocationId }) {
    const { app_base, app_url } = usePage().props;
    const [processing, setProcessing] = useState(false);
    const form = useForm({
        location_id: selectedLocationId || locations[0]?.id || '',
        reason_code: reasons[0]?.value || 'physical_count',
        counted_quantity: selectedSku?.balances?.[selectedLocationId] ?? 0,
        notes: '',
    });
    const systemQuantity = Number(selectedSku?.balances?.[form.data.location_id] ?? 0);
    const countedQuantity = Number(form.data.counted_quantity || 0);
    const variance = countedQuantity - systemQuantity;
    const imagePath = selectedSku?.image_path;

    const setLocation = (locationId) => {
        const nextSystemQuantity = selectedSku?.balances?.[locationId] ?? 0;
        form.setData({
            ...form.data,
            location_id: locationId,
            counted_quantity: nextSystemQuantity,
            notes: '',
        });
    };

    const submit = (event) => {
        event.preventDefault();
        form.clearErrors();
        router.post(routeWithBase('/admin/inventory/adjustments', app_base), {
            location_id: form.data.location_id,
            reason_code: form.data.reason_code,
            notes: form.data.notes,
            items: [{
                sku_id: selectedSku.id,
                counted_quantity: form.data.counted_quantity,
                notes: form.data.notes,
            }],
        }, {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onError: (errors) => form.setError(errors),
        });
    };

    return (
        <AdminLayout title="Adjust stock" eyebrow="Inventory">
            <Head title="Adjust Stock" />
            <div className="sticky-toolbar">
                <Link className="back-link" href={routeWithBase('/admin/inventory', app_base)}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} /> Back to stock overview
                </Link>
            </div>

            <form onSubmit={submit} className="panel glass adjustment-simple-form">
                <PanelHeading eyebrow="Stock correction" title="Update counted quantity" action={<small className="muted">Product is selected from stock overview.</small>} />

                {Object.keys(form.errors).length > 0 && (
                    <div className="flash error">
                        {Object.values(form.errors).map((error) => <div key={error}>{error}</div>)}
                    </div>
                )}

                <div className="adjustment-product-card">
                    <span className="receipt-product-thumb" aria-hidden="true">
                        {imagePath ? <img src={storageUrl(imagePath, app_url)} alt="" /> : <Icon name="box" size={16} />}
                    </span>
                    <div>
                        <strong>{selectedSku.product_name}</strong>
                        <small>{selectedSku.sku_code}{selectedSku.barcode ? ` / ${selectedSku.barcode}` : ''}</small>
                    </div>
                </div>

                <div className="adjustment-simple-grid">
                    <label className="form-field">
                        <span>Warehouse</span>
                        <select value={form.data.location_id} onChange={(event) => setLocation(event.target.value)} required>
                            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                        </select>
                    </label>
                    <label className="form-field">
                        <span>Reason</span>
                        <select value={form.data.reason_code} onChange={(event) => form.setData('reason_code', event.target.value)} required>
                            {reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                        </select>
                    </label>
                    <div className="adjustment-quantity-card">
                        <div className="adjustment-quantity-card-inner">
                            <span>System</span>
                            <strong>{systemQuantity}</strong>
                        </div>
                    </div>
                    <label className="form-field">
                        <span>Counted</span>
                        <input
                            type="number"
                            min="0"
                            value={form.data.counted_quantity}
                            onChange={(event) => form.setData('counted_quantity', event.target.value)}
                            required
                        />
                    </label>
                    <div className={variance < 0 ? 'adjustment-quantity-card negative' : variance > 0 ? 'adjustment-quantity-card positive' : 'adjustment-quantity-card'}>
                        <div className="adjustment-quantity-card-inner">
                            <span>Variance</span>
                            <strong>{variance > 0 ? '+' : ''}{variance}</strong>
                        </div>
                    </div>
                    <label className="form-field adjustment-note-field">
                        <span>{variance < 0 ? 'Loss note' : 'Adjustment note'}</span>
                        <input
                            value={form.data.notes}
                            onChange={(event) => form.setData('notes', event.target.value)}
                            placeholder={variance < 0 ? 'Required for stock loss' : 'Optional note'}
                            required={variance < 0}
                        />
                    </label>
                </div>

                <div className="receipt-wizard-actions">
                    <Link className="btn secondary" href={routeWithBase('/admin/inventory', app_base)}>Cancel</Link>
                    <button className="btn primary" type="submit" disabled={processing}>
                        <Icon name="check" size={14} /> Create adjustment
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
}
