import { useState } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { fulfillmentSteps, orderStatusLabels, paymentLabels } from '@/constants/orderLabels';

const stepLabels = {
    pending: 'Order placed',
    processing: 'Processing',
    shipped: 'Shipped',
    delivered: 'Delivered',
};

function activeStepIndex(status, paymentStatus) {
    if (status === 'cancelled') return -1;
    if (paymentStatus === 'pending_review') return 0;
    const idx = fulfillmentSteps.indexOf(status);
    return idx >= 0 ? idx : 0;
}

export default function OrdersShow({ order, voucherLinks = {}, canReviewPayments, canManageOrders, canCancelOrders }) {
    const { app_base, app_url, flash } = usePage().props;
    const [rejectOpen, setRejectOpen] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [linkCopied, setLinkCopied] = useState(false);

    const rejectForm = useForm({ reason: '' });
    const confirmForm = useForm({
        discount_type: order.admin_discount_type || 'percent',
        discount_value: order.admin_discount_value > 0 ? order.admin_discount_value : '',
    });
    const statusForm = useForm({ status: '' });
    const notesForm = useForm({ admin_notes: order.admin_notes ?? '' });
    const cancelForm = useForm({ reason: '' });
    const deleteForm = useForm({ reason: '' });

    const proofUrl = order.payment_proof_url || storageUrl(order.payment_proof_path, app_url);
    const paymentAccount = order.payment_method_snapshot || order.selected_payment_method || (order.payment_method ? { banking_service: order.payment_method } : null);
    const awaitingReview = order.payment_status === 'pending_review' && order.status !== 'cancelled';
    const isCancelled = order.status === 'cancelled';
    const isDelivered = order.status === 'delivered';
    const stepActive = activeStepIndex(order.status, order.payment_status);
    const adminDiscountAmount = Number(order.admin_discount_amount || 0);
    const checkoutDiscountAmount = Math.max(0, Number(order.discount_amount || 0) - adminDiscountAmount);
    const orderPayableAmount = Number(order.final_amount || 0);
    const approvalDiscountValue = Number(confirmForm.data.discount_value || 0);
    const approvalDiscountAmount = Math.max(0, Math.min(
        orderPayableAmount,
        confirmForm.data.discount_type === 'percent'
            ? orderPayableAmount * (approvalDiscountValue / 100)
            : approvalDiscountValue,
    ));
    const approvalFinalAmount = Math.max(0, orderPayableAmount - approvalDiscountAmount);
    const discountTooHigh = confirmForm.data.discount_type === 'percent'
        ? approvalDiscountValue > 100
        : approvalDiscountValue > orderPayableAmount;

    const handleConfirm = () => {
        const message = approvalDiscountAmount > 0
            ? `Confirm payment and apply $${approvalDiscountAmount.toFixed(2)} discount? Stock will be deducted and fulfillment begins.`
            : 'Confirm payment? Stock will be deducted and fulfillment begins.';
        if (!confirm(message)) return;
        confirmForm.post(routeWithBase(`/admin/orders/${order.id}/confirm-payment`, app_base), { preserveScroll: true });
    };

    const handleReject = (e) => {
        e.preventDefault();
        rejectForm.post(routeWithBase(`/admin/orders/${order.id}/reject-payment`, app_base), {
            preserveScroll: true,
            onSuccess: () => setRejectOpen(false),
        });
    };

    const advanceStatus = (status) => {
        statusForm.clearErrors();
        statusForm.transform(() => ({ status }));
        statusForm.patch(routeWithBase(`/admin/orders/${order.id}/status`, app_base), {
            preserveScroll: true,
            onFinish: () => statusForm.transform((data) => data),
        });
    };

    const saveNotes = (e) => {
        e.preventDefault();
        notesForm.patch(routeWithBase(`/admin/orders/${order.id}/notes`, app_base), { preserveScroll: true });
    };

    const handleCancel = (e) => {
        e.preventDefault();
        cancelForm.post(routeWithBase(`/admin/orders/${order.id}/cancel`, app_base), {
            preserveScroll: true,
            onSuccess: () => setCancelOpen(false),
        });
    };

    const handleDelete = (e) => {
        e.preventDefault();
        deleteForm.delete(routeWithBase(`/admin/orders/${order.id}`, app_base), {
            preserveScroll: true,
            onSuccess: () => setDeleteOpen(false),
        });
    };

    const copyPublicLink = async () => {
        if (!voucherLinks.public) return;
        try {
            if (!navigator.clipboard) throw new Error('Clipboard unavailable');
            await navigator.clipboard.writeText(voucherLinks.public);
        } catch (error) {
            window.prompt('Public invoice link', voucherLinks.public);
        }
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 1800);
    };

    return (
        <AdminLayout title={order.order_number} eyebrow="Order detail">
            <Head title={`Order ${order.order_number}`} />

            <Link href={routeWithBase('/admin/orders', app_base)} className="back-link">
                <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                Back to orders
            </Link>

            <AdminFlash
                flash={flash}
                errors={{
                    order: confirmForm.errors.order || cancelForm.errors.order || deleteForm.errors.order,
                    status: statusForm.errors.status,
                }}
            />

            <section className="panel glass" style={{ marginBottom: 14 }}>
                <div className="stack-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div>
                        <p className="eyebrow">Order</p>
                        <h2 style={{ fontSize: 18, fontWeight: 800 }}>{order.order_number}</h2>
                        <small>
                            Placed {order.created_at}
                            {order.status_updated_at ? ` · Updated ${order.status_updated_at}` : ''}
                        </small>
                    </div>
                    <div style={{ display: 'grid', gap: 8, justifyItems: 'end' }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <StatusBadge status={order.status} label={orderStatusLabels[order.status] || order.status} />
                            <StatusBadge
                                status={order.payment_status}
                                label={paymentLabels[order.payment_status] || order.payment_status}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <a href={voucherLinks.print} target="_blank" rel="noopener noreferrer" className="btn secondary" style={{ minHeight: 32, fontSize: 11 }}>
                                <Icon name="receipt" size={13} />
                                Print voucher
                            </a>
                            <a href={voucherLinks.pdf} className="btn primary" style={{ minHeight: 32, fontSize: 11 }}>
                                <Icon name="external" size={13} />
                                PDF
                            </a>
                            <button type="button" className="btn secondary" style={{ minHeight: 32, fontSize: 11 }} onClick={copyPublicLink}>
                                <Icon name="external" size={13} />
                                {linkCopied ? 'Copied' : 'Public link'}
                            </button>
                        </div>
                    </div>
                </div>

                {!isCancelled && order.payment_status === 'paid' && (
                    <div className="stepper">
                        {fulfillmentSteps.map((s, idx) => (
                            <div
                                key={s}
                                className={`step ${idx < stepActive ? 'done' : ''} ${idx === stepActive ? 'active' : ''}`}
                            >
                                <small>Step {idx + 1}</small>
                                <strong>{stepLabels[s]}</strong>
                            </div>
                        ))}
                    </div>
                )}

                {isCancelled && (
                    <div className="flash warning" style={{ marginTop: 12, marginBottom: 0 }}>
                        This order was cancelled.
                        {order.payment_rejection_reason && ` ${order.payment_rejection_reason}`}
                    </div>
                )}
            </section>

            <div className="detail-layout">
                <div className="stack-sm">
                    <section className="panel glass">
                        <PanelHeading
                            eyebrow="Customer"
                            title={order.user?.name || 'Guest'}
                            action={
                                order.user ? (
                                    <Link
                                        href={routeWithBase(`/admin/chats/${order.user.id}`, app_base)}
                                        className="btn secondary"
                                        style={{ minHeight: 32, fontSize: 11 }}
                                    >
                                        <Icon name="chat" size={13} />
                                        Open chat
                                    </Link>
                                ) : null
                            }
                        />
                        <p>
                            {order.user?.phone || '—'} · {order.user?.email}
                        </p>

                        <div className="route" style={{ marginTop: 14 }}>
                            <span className="route-line" />
                            <div>
                                <span className="route-marker pickup" />
                                <small>Ship to</small>
                                <strong>
                                    {order.receiver_name} · {order.receiver_phone}
                                </strong>
                                <p style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{order.shipping_address}</p>
                            </div>
                        </div>

                        {order.order_notes && (
                            <div style={{ marginTop: 14 }}>
                                <p className="eyebrow">Customer notes</p>
                                <p>{order.order_notes}</p>
                            </div>
                        )}
                    </section>
                    <section className="panel glass">
                        <PanelHeading eyebrow="Items" title="Line items" />
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>SKU</th>
                                        <th style={{ textAlign: 'right' }}>Qty</th>
                                        <th style={{ textAlign: 'right' }}>Unit price</th>
                                        <th style={{ textAlign: 'right' }}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.items.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <strong>{item.product?.name || 'Product'}</strong>
                                                {item.variants?.__preorder && (
                                                    <div style={{ marginTop: 4 }}>
                                                        <StatusBadge status="warning" label="Pre-order" />
                                                    </div>
                                                )}
                                            </td>
                                            <td>
                                                <small>{item.sku?.sku_code || '-'}</small>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <strong>{item.quantity}</strong>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                ${Number(item.unit_price).toFixed(2)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <strong>${Number(item.total_price).toFixed(2)}</strong>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
                            <div className="detail-row">
                                <span>Subtotal</span>
                                <strong>${Number(order.total_amount).toFixed(2)}</strong>
                            </div>
                            <div className="detail-row">
                                <span>Tax</span>
                                <strong>${Number(order.tax_amount ?? 0).toFixed(2)}</strong>
                            </div>
                            <div className="detail-row">
                                <span>Shipping</span>
                                <strong>${Number(order.shipping_fee).toFixed(2)}</strong>
                            </div>
                            {checkoutDiscountAmount > 0 && (
                                <div className="detail-row">
                                    <span>
                                        Checkout discount
                                        {order.coupon_code ? ` (${order.coupon_code})` : ''}
                                        {order.redeemed_points > 0 ? ` · ${order.redeemed_points} pts` : ''}
                                    </span>
                                    <strong>-${checkoutDiscountAmount.toFixed(2)}</strong>
                                </div>
                            )}
                            {adminDiscountAmount > 0 && (
                                <div className="detail-row">
                                    <span>
                                        Approval discount
                                        {order.admin_discount_type === 'percent'
                                            ? ` (${Number(order.admin_discount_value || 0).toFixed(2)}%)`
                                            : ''}
                                    </span>
                                    <strong>-${adminDiscountAmount.toFixed(2)}</strong>
                                </div>
                            )}
                            <div className="detail-row">
                                <span>Total</span>
                                <strong style={{ fontSize: 15 }}>${Number(order.final_amount).toFixed(2)}</strong>
                            </div>
                        </div>
                    </section>

                    <section className="panel glass">
                        <PanelHeading eyebrow="Internal" title="Admin notes" />
                        <form onSubmit={saveNotes}>
                            <label className="form-field">
                                <span>Private staff notes</span>
                                <textarea
                                    value={notesForm.data.admin_notes}
                                    onChange={(e) => notesForm.setData('admin_notes', e.target.value)}
                                    placeholder="Not visible to customer"
                                    disabled={!canManageOrders}
                                />
                            </label>
                            {canManageOrders && (
                                <button type="submit" className="btn secondary" disabled={notesForm.processing} style={{ marginTop: 10 }}>
                                    <Icon name="check" size={13} />
                                    Save notes
                                </button>
                            )}
                        </form>
                    </section>
                </div>

                <div className="side-stack">
                    <section className="panel glass">
                        <PanelHeading eyebrow="Payment" title={awaitingReview && canReviewPayments ? 'Screenshot & decision' : 'Screenshot'} />
                        <div className="stack-sm">
                            {paymentAccount && (
                                <div
                                    style={{
                                        border: '1px solid var(--color-border)',
                                        borderRadius: 6,
                                        padding: 10,
                                        display: 'grid',
                                        gap: 4,
                                    }}
                                >
                                    <p className="eyebrow" style={{ margin: 0 }}>Transfer account</p>
                                    <strong>{paymentAccount.banking_service || order.payment_method || 'Manual transfer'}</strong>
                                    {paymentAccount.account_name && <span>{paymentAccount.account_name}</span>}
                                    {paymentAccount.account_no && <code>{paymentAccount.account_no}</code>}
                                </div>
                            )}
                            {proofUrl ? (
                                <a href={proofUrl} target="_blank" rel="noopener noreferrer">
                                    <img
                                        src={proofUrl}
                                        alt="Payment proof"
                                        style={{
                                            width: '100%',
                                            maxHeight: 360,
                                            objectFit: 'contain',
                                            borderRadius: 6,
                                            border: '1px solid var(--color-border)',
                                        }}
                                    />
                                </a>
                            ) : (
                                <p>No screenshot uploaded.</p>
                            )}

                            {awaitingReview && canReviewPayments && (
                                <div
                                    className="stack-sm"
                                    style={{
                                        paddingTop: 12,
                                        borderTop: '1px solid var(--color-border)',
                                    }}
                                >
                                    <p className="eyebrow" style={{ marginBottom: -2 }}>
                                        Decision
                                    </p>
                                    <div className="approval-discount">
                                        <div className="approval-discount-grid">
                                            <label className="form-field">
                                                <span>Discount mode</span>
                                                <select
                                                    value={confirmForm.data.discount_type}
                                                    onChange={(e) => confirmForm.setData('discount_type', e.target.value)}
                                                    disabled={confirmForm.processing}
                                                >
                                                    <option value="percent">Percent</option>
                                                    <option value="amount">Amount</option>
                                                </select>
                                            </label>
                                            <label className="form-field">
                                                <span>
                                                    {confirmForm.data.discount_type === 'percent'
                                                        ? 'Discount percent'
                                                        : 'Discount amount'}
                                                </span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max={confirmForm.data.discount_type === 'percent' ? 100 : orderPayableAmount}
                                                    step="0.01"
                                                    value={confirmForm.data.discount_value}
                                                    onChange={(e) => confirmForm.setData('discount_value', e.target.value)}
                                                    placeholder={confirmForm.data.discount_type === 'percent' ? '0%' : '0.00'}
                                                    disabled={confirmForm.processing}
                                                />
                                            </label>
                                        </div>
                                        {(confirmForm.errors.discount_type || confirmForm.errors.discount_value) && (
                                            <small className="field-error">
                                                {confirmForm.errors.discount_type || confirmForm.errors.discount_value}
                                            </small>
                                        )}
                                        <div className="approval-discount-summary">
                                            <div>
                                                <span>Current total</span>
                                                <strong>${orderPayableAmount.toFixed(2)}</strong>
                                            </div>
                                            <div>
                                                <span>Approval discount</span>
                                                <strong>-${approvalDiscountAmount.toFixed(2)}</strong>
                                            </div>
                                            <div>
                                                <span>Customer pays</span>
                                                <strong>${approvalFinalAmount.toFixed(2)}</strong>
                                            </div>
                                        </div>
                                        {discountTooHigh && (
                                            <small className="field-error">
                                                Discount cannot be greater than the current order total.
                                            </small>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            className="btn success grow"
                                            onClick={handleConfirm}
                                            disabled={confirmForm.processing || discountTooHigh}
                                            style={{ minWidth: 150 }}
                                        >
                                            <Icon name="check" size={14} />
                                            Confirm payment
                                        </button>
                                        <button
                                            type="button"
                                            className="btn danger grow"
                                            onClick={() => setRejectOpen(true)}
                                            disabled={rejectForm.processing}
                                            style={{ minWidth: 140 }}
                                        >
                                            Reject payment
                                        </button>
                                    </div>
                                </div>
                            )}

                            {order.payment_reviewed_at && (
                                <small>
                                    Payment reviewed {order.payment_reviewed_at}
                                    {order.payment_reviewer?.name ? ` by ${order.payment_reviewer.name}` : ''}
                                </small>
                            )}
                        </div>
                    </section>

                    {canManageOrders && order.payment_status === 'paid' && !isCancelled && !isDelivered && (
                        <section className="panel glass">
                            <PanelHeading eyebrow="Fulfillment" title="Update status" />
                            <div className="stack-sm">
                                {order.status === 'processing' && (
                                    <button
                                        type="button"
                                        className="btn primary full"
                                        onClick={() => advanceStatus('shipped')}
                                        disabled={statusForm.processing}
                                    >
                                        <Icon name="navigation" size={14} />
                                        Mark as shipped
                                    </button>
                                )}
                                {order.status === 'shipped' && (
                                    <button
                                        type="button"
                                        className="btn primary full"
                                        onClick={() => advanceStatus('delivered')}
                                        disabled={statusForm.processing}
                                    >
                                        <Icon name="check" size={14} />
                                        Mark as delivered
                                    </button>
                                )}
                            </div>
                        </section>
                    )}

                    {canCancelOrders && !isCancelled && !isDelivered && (
                        <button type="button" className="btn danger full" onClick={() => setCancelOpen(true)}>
                            Cancel order
                        </button>
                    )}

                    {canCancelOrders && (
                        <button type="button" className="btn danger full" onClick={() => setDeleteOpen(true)}>
                            <Icon name="trash" size={14} />
                            Delete & return stock
                        </button>
                    )}

                </div>
            </div>

            {rejectOpen && (
                <div className="modal-backdrop" onClick={() => setRejectOpen(false)}>
                    <form className="operation-modal compact glass" onSubmit={handleReject} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Payment</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Reject payment</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={() => setRejectOpen(false)}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>
                        <div className="crud-grid">
                            <label className="form-field span-2">
                                <span>Message to customer (optional)</span>
                                <textarea
                                    value={rejectForm.data.reason}
                                    onChange={(e) => rejectForm.setData('reason', e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={() => setRejectOpen(false)}>
                                Close
                            </button>
                            <button type="submit" className="btn danger" disabled={rejectForm.processing}>
                                Reject & cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {cancelOpen && (
                <div className="modal-backdrop" onClick={() => setCancelOpen(false)}>
                    <form className="operation-modal compact glass" onSubmit={handleCancel} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Order</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Cancel order</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={() => setCancelOpen(false)}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>
                        <div className="crud-grid">
                            <p className="span-2">
                                {order.payment_status === 'paid'
                                    ? 'Stock will be restored to inventory. The customer will see the order as cancelled.'
                                    : 'This will cancel the order and notify the customer if applicable.'}
                            </p>
                            <label className="form-field span-2">
                                <span>Reason (optional)</span>
                                <textarea
                                    value={cancelForm.data.reason}
                                    onChange={(e) => cancelForm.setData('reason', e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={() => setCancelOpen(false)}>
                                Close
                            </button>
                            <button type="submit" className="btn danger" disabled={cancelForm.processing}>
                                Cancel order
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {deleteOpen && (
                <div className="modal-backdrop" onClick={() => setDeleteOpen(false)}>
                    <form className="operation-modal compact glass" onSubmit={handleDelete} onClick={(e) => e.stopPropagation()}>
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">Order return</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>Delete order</h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={() => setDeleteOpen(false)}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>
                        <div className="crud-grid">
                            <p className="span-2">
                                This permanently removes the order. Paid order stock will be returned, active reservations will be released, and any POS sale finance entry will be deleted.
                            </p>
                            <label className="form-field span-2">
                                <span>Reason (optional)</span>
                                <textarea
                                    value={deleteForm.data.reason}
                                    onChange={(e) => deleteForm.setData('reason', e.target.value)}
                                />
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={() => setDeleteOpen(false)}>
                                Close
                            </button>
                            <button type="submit" className="btn danger" disabled={deleteForm.processing}>
                                Delete order
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </AdminLayout>
    );
}
