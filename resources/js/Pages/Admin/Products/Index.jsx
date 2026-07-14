import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { routeWithBase, storageUrl } from '@/Utils/url';

export default function Index({ products, app_base }) {
    const { app_url } = usePage().props;
    const { delete: destroy } = useForm({});
    const productRows = products.data || products;

    const handleDelete = (id) => {
        if (confirm('Are you sure you want to delete this product?')) {
            destroy(routeWithBase(`/admin/products/${id}`, app_base));
        }
    };

    const getPriceRange = (skus) => {
        if (!skus || skus.length === 0) return '-';
        const prices = skus.map((s) => parseFloat(s.price));
        const min = Math.min(...prices);
        const max = Math.max(...prices);
        return min === max ? `$${min}` : `$${min} - $${max}`;
    };

    const getTotalStock = (skus) => {
        if (!skus || skus.length === 0) return 0;
        return skus.reduce((sum, s) => sum + parseInt(s.stock_qty, 10), 0);
    };

    return (
        <AdminLayout
            title="Products"
            eyebrow="Catalog management"
            action={
                <Link href={routeWithBase('/admin/products/create', app_base)} className="btn primary">
                    <Icon name="plus" size={14} />
                    Add product
                </Link>
            }
        >
            <Head title="Manage Products" />

            <section className="panel glass">
                <PanelHeading eyebrow="Inventory" title="Shop products" />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Product</th>
                                <th>Category</th>
                                <th>Price</th>
                                <th>Stock</th>
                                <th>Status</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {productRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <span className="muted">No products found.</span>
                                    </td>
                                </tr>
                            ) : (
                                productRows.map((product) => {
                                    const stock = getTotalStock(product.skus);
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
                                                        <small>{product.skus?.length || 0} variants</small>
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
                                                <StatusBadge status={status} label={(product.status || 'active').toUpperCase()} />
                                                {product.is_featured && (
                                                    <StatusBadge status="info" label="FEATURED" />
                                                )}
                                            </td>
                                            <td>
                                                <div className="inline-actions">
                                                    <Link
                                                        href={routeWithBase(`/admin/products/${product.id}/edit`, app_base)}
                                                        className="icon-btn small"
                                                        aria-label="Edit product"
                                                    >
                                                        <Icon name="edit" size={13} />
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        className="icon-btn small danger"
                                                        aria-label="Delete product"
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
                <AdminPagination paginator={products} label="products" />
            </section>
        </AdminLayout>
    );
}
