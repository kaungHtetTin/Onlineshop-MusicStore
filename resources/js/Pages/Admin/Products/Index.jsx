import { Head, Link, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';
import { formatMoney } from '@/Utils/pricing';

export default function Index({ products, app_base }) {
    const { app_url } = usePage().props;
    const { delete: destroy } = useForm({});
    const productRows = products.data || products;
    const t = usePhraseTranslation();

    const handleDelete = (id) => {
        if (confirm(t('Are you sure you want to delete this product?'))) {
            destroy(routeWithBase(`/admin/products/${id}`, app_base));
        }
    };

    const getPriceRange = (skus) => {
        if (!skus || skus.length === 0) return '-';
        const prices = skus.map((s) => parseFloat(s.price));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
    };

    const getTotalStock = (product) => product.total_on_hand ?? 0;

    return (
        <AdminLayout
            title={t('Products')}
            eyebrow={t('Catalog management')}
            action={
                <div className="inline-actions">
                    <Link href={routeWithBase('/admin/products/barcodes', app_base)} className="btn secondary">
                        <Icon name="barcode" size={14} />
                        {t('Print barcodes')}
                    </Link>
                    <Link href={routeWithBase('/admin/products/create', app_base)} className="btn primary">
                        <Icon name="plus" size={14} />
                        {t('Add product')}
                    </Link>
                </div>
            }
        >
            <Head title={t('Manage Products')} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Inventory')} title={t('Shop products')} />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Product')}</th>
                                <th>{t('Category')}</th>
                                <th>{t('Price')}</th>
                                <th>{t('Stock')}</th>
                                <th>{t('Status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {productRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <span className="muted">{t('No products found.')}</span>
                                    </td>
                                </tr>
                            ) : (
                                productRows.map((product) => {
                                    const stock = getTotalStock(product);
                                    const status = product.status === 'active' ? 'success' : product.status === 'draft' ? 'warning' : 'neutral';

                                    return (
                                        <tr key={product.id}>
                                            <td>
                                                <div className="rider-cell">
                                                    {product.primary_image ? (
                                                        <img
                                                            src={storageUrl(product.primary_image.image_path, app_url)}
                                                            alt=""
                                                            style={{
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: 6,
                                                                objectFit: 'cover',
                                                            }}
                                                        />
                                                    ) : (
                                                        <span>
                                                            <Icon name="image" size={13} />
                                                        </span>
                                                    )}
                                                    <div>
                                                        <strong>{product.name}</strong>
                                                        <small>{product.skus?.length || 0} {t('variants')}</small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>{product.category?.name || '-'}</td>
                                            <td>
                                                <strong>{getPriceRange(product.skus)}</strong>
                                            </td>
                                            <td>
                                                <strong style={{ color: stock <= 5 ? '#ce4444' : undefined }}>{stock}</strong>
                                            </td>
                                            <td>
                                                <StatusBadge status={status} label={t(product.status || 'active')} />
                                                {product.is_featured && (
                                                    <StatusBadge status="info" label={t('FEATURED')} />
                                                )}
                                            </td>
                                            <td>
                                                <div className="inline-actions">
                                                    <Link
                                                        href={routeWithBase(`/admin/products/${product.id}/edit`, app_base)}
                                                        className="icon-btn small"
                                                        aria-label={t('Edit product')}
                                                    >
                                                        <Icon name="edit" size={13} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="icon-btn small danger"
                                                        aria-label={t('Delete product')}
                                                        onClick={() => handleDelete(product.id)}
                                                    >
                                                        <Icon name="trash" size={13} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={products} label={t('products')} />
            </section>
        </AdminLayout>
    );
}
