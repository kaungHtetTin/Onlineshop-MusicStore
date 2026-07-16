import { useEffect, useState } from 'react';
import { Head, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import AdminPagination from '@/Components/Admin/AdminPagination';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import CropImageModal from '@/Components/Admin/CropImageModal';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

function useObjectUrl(file) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!file) {
            setUrl(null);
            return undefined;
        }

        const next = URL.createObjectURL(file);
        setUrl(next);
        return () => URL.revokeObjectURL(next);
    }, [file]);

    return url;
}

const croppedIconName = (sourceName) => {
    const base = (sourceName || 'category-icon').replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `${base || 'category-icon'}-crop-${Date.now()}.png`;
};

export default function Index({ categories, parentCategories }) {
    const { app_base } = usePage().props;
    const t = usePhraseTranslation();
    const categoryRows = categories.data || categories;
    const [open, setOpen] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(null);
    const [iconCropper, setIconCropper] = useState(null);

    const { data, setData, post, patch, delete: destroy, processing, reset, errors } = useForm({
        parent_id: '',
        name: '',
        description: '',
        icon: '',
        icon_image: null,
        remove_icon_image: false,
        metadata: { color: '#FCE4EC' },
        homepage_featured: true,
        is_active: true,
        sort_order: 0,
    });
    const iconPreviewObjectUrl = useObjectUrl(data.icon_image);
    const iconPreviewUrl = data.remove_icon_image ? null : iconPreviewObjectUrl || currentCategory?.icon_image_url;

    const handleOpen = (category = null) => {
        if (category) {
            setEditMode(true);
            setCurrentCategory(category);
            setData({
                parent_id: category.parent_id || '',
                name: category.name,
                description: category.description || '',
                icon: category.icon || '',
                icon_image: null,
                remove_icon_image: false,
                metadata: category.metadata || { color: '#FCE4EC' },
                homepage_featured: category.metadata?.homepage_featured ?? true,
                is_active: !!category.is_active,
                sort_order: category.sort_order || 0,
            });
        } else {
            setEditMode(false);
            setCurrentCategory(null);
            reset();
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setIconCropper(null);
        reset();
    };

    const openIconCropper = (file) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => setIconCropper({ image: reader.result, sourceName: file.name });
        reader.readAsDataURL(file);
    };

    const handleIconCropComplete = (croppedBlob) => {
        const croppedFile = new File([croppedBlob], croppedIconName(iconCropper?.sourceName), {
            type: croppedBlob.type || 'image/png',
        });

        setData({
            ...data,
            icon_image: croppedFile,
            remove_icon_image: false,
        });
        setIconCropper(null);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (editMode) {
            post(routeWithBase(`/admin/categories/${currentCategory.id}`, app_base), {
                forceFormData: true,
                onSuccess: () => handleClose(),
            });
        } else {
            post(routeWithBase('/admin/categories', app_base), {
                forceFormData: true,
                onSuccess: () => handleClose(),
            });
        }
    };

    const handleDelete = (id) => {
        if (confirm(t('Are you sure you want to delete this category?'))) {
            destroy(routeWithBase(`/admin/categories/${id}`, app_base));
        }
    };

    return (
        <AdminLayout
            title={t('Categories')}
            eyebrow={t('Catalog management')}
            action={
                <button type="button" className="btn primary" onClick={() => handleOpen()}>
                    <Icon name="plus" size={14} />
                    {t('Add category')}
                </button>
            }
        >
            <Head title={t('Manage Categories')} />

            <section className="panel glass">
                <PanelHeading eyebrow={t('Taxonomy')} title={t('Product categories')} />
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>{t('Icon')}</th>
                                <th>{t('Name')}</th>
                                <th>{t('Parent')}</th>
                                <th>{t('Order')}</th>
                                <th>{t('Status')}</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {categoryRows.length === 0 ? (
                                <tr>
                                    <td colSpan={6}>
                                        <span className="muted">{t('No categories found.')}</span>
                                    </td>
                                </tr>
                            ) : (
                                categoryRows.map((category) => (
                                    <tr key={category.id}>
                                        <td>
                                            <span
                                                style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 6,
                                                    display: 'inline-grid',
                                                    placeItems: 'center',
                                                    background: category.metadata?.color || 'var(--color-primary-soft)',
                                                    color: 'var(--color-primary)',
                                                }}
                                            >
                                                {category.icon_image_url ? (
                                                    <img
                                                        src={category.icon_image_url}
                                                        alt=""
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : category.icon || <Icon name="tag" size={14} />}
                                            </span>
                                        </td>
                                        <td>
                                            <strong>{category.name}</strong>
                                        </td>
                                        <td>{category.parent?.name || '-'}</td>
                                        <td>{category.sort_order}</td>
                                        <td>
                                            <StatusBadge
                                                status={category.is_active ? 'success' : 'neutral'}
                                                label={category.is_active ? t('Active') : t('Inactive')}
                                            />
                                        </td>
                                        <td>
                                            <div className="inline-actions">
                                                <button
                                                    type="button"
                                                    className="icon-btn small"
                                                    aria-label={t('Edit category')}
                                                    onClick={() => handleOpen(category)}
                                                >
                                                    <Icon name="edit" size={13} />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="icon-btn small danger"
                                                    aria-label={t('Delete category')}
                                                    onClick={() => handleDelete(category.id)}
                                                >
                                                    <Icon name="trash" size={13} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <AdminPagination paginator={categories} label={t('categories')} />
            </section>

            {open && (
                <div className="modal-backdrop" onClick={handleClose}>
                    <form
                        className="operation-modal compact glass"
                        onSubmit={handleSubmit}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="drawer-header">
                            <div>
                                <p className="eyebrow">{t('Category')}</p>
                                <h2 style={{ fontSize: 16, fontWeight: 800 }}>
                                    {editMode ? t('Edit category') : t('New category')}
                                </h2>
                            </div>
                            <button type="button" className="icon-btn small" onClick={handleClose} aria-label={t('Close')}>
                                <Icon name="close" size={14} />
                            </button>
                        </div>
                        <div className="crud-grid">
                            <label className="form-field">
                                <span>{t('Parent category')}</span>
                                <select
                                    value={data.parent_id}
                                    onChange={(e) => setData('parent_id', e.target.value)}
                                >
                                    <option value="">{t('None (top level)')}</option>
                                    {parentCategories
                                        .filter((pc) => !currentCategory || pc.id !== currentCategory.id)
                                        .map((pc) => (
                                            <option key={pc.id} value={pc.id}>
                                                {pc.name}
                                            </option>
                                        ))}
                                </select>
                            </label>
                            <label className="form-field">
                                <span>{t('Display order')}</span>
                                <input
                                    type="number"
                                    value={data.sort_order}
                                    onChange={(e) => setData('sort_order', e.target.value)}
                                />
                            </label>
                            <label className="form-field span-2">
                                <span>{t('Category name')}</span>
                                <input
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    required
                                />
                                {errors.name && <small style={{ color: '#ce4444' }}>{errors.name}</small>}
                            </label>
                            <label className="form-field">
                                <span>{t('Icon')}</span>
                                <input
                                    value={data.icon}
                                    onChange={(e) => setData('icon', e.target.value)}
                                    placeholder={t('Emoji fallback')}
                                />
                            </label>
                            <label className="form-field">
                                <span>{t('Color')}</span>
                                <input
                                    type="color"
                                    value={data.metadata.color}
                                    onChange={(e) => setData('metadata', { ...data.metadata, color: e.target.value })}
                                />
                            </label>
                            <div className="span-2 storefront-image-picker">
                                <div className="storefront-image-preview" style={{ background: data.metadata.color || '#FCE4EC' }}>
                                    {iconPreviewUrl ? (
                                        <img src={iconPreviewUrl} alt="" />
                                    ) : (
                                        data.icon || <Icon name="tag" size={16} />
                                    )}
                                </div>
                                <div className="storefront-image-meta">
                                    <strong>{t('Category icon image')}</strong>
                                    <small>{data.icon_image?.name || (iconPreviewUrl ? t('Current image') : t('No image selected'))}</small>
                                </div>
                                <div className="storefront-image-actions">
                                    <label className="btn secondary">
                                        <Icon name="image" size={13} />
                                        {t('Upload')}
                                        <input
                                            className="sr-only-file"
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                            onChange={(event) => {
                                                const file = event.target.files?.[0] || null;
                                                event.target.value = '';
                                                if (file) openIconCropper(file);
                                            }}
                                        />
                                    </label>
                                    {iconPreviewUrl && (
                                        <button type="button" className="icon-btn small danger" onClick={() => setData({ ...data, icon_image: null, remove_icon_image: true })}>
                                            <Icon name="trash" size={13} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <label className="form-field span-2">
                                <span>{t('Description')}</span>
                                <textarea
                                    value={data.description}
                                    onChange={(e) => setData('description', e.target.value)}
                                />
                            </label>
                            {editMode && (
                                <label className="form-field checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={data.is_active}
                                        onChange={(e) => setData('is_active', e.target.checked)}
                                    />
                                    <span>{t('Active status')}</span>
                                </label>
                            )}
                            <label className={`form-field checkbox-row ${editMode ? '' : 'span-2'}`}>
                                <input
                                    type="checkbox"
                                    checked={data.homepage_featured}
                                    onChange={(e) => setData('homepage_featured', e.target.checked)}
                                />
                                <span>{t('Show on homepage')}</span>
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button type="button" className="btn secondary" onClick={handleClose}>
                                {t('Cancel')}
                            </button>
                            <button type="submit" className="btn primary" disabled={processing}>
                                {editMode ? t('Update category') : t('Create category')}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <CropImageModal
                open={!!iconCropper}
                image={iconCropper?.image}
                onCropComplete={handleIconCropComplete}
                onCancel={() => setIconCropper(null)}
                aspect={1}
                title={t('Crop category icon')}
                ratioLabel="1:1"
                outputType="image/png"
            />
        </AdminLayout>
    );
}
