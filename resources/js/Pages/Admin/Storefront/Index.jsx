import { useEffect, useMemo, useState } from 'react';
import { Head, useForm, usePage } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import CropImageModal from '@/Components/Admin/CropImageModal';
import { routeWithBase } from '@/Utils/url';

const sectionLabels = {
    categories: 'Category strip',
    flash_sale: 'Flash sale',
    promos: 'Promo tiles',
    best_sellers: 'Best sellers',
    blogs: 'Blogs',
};

const normalizeBlock = (block = {}, fallback = {}) => ({
    id: block.id || null,
    key: block.key || fallback.key || '',
    title: block.title || fallback.title || '',
    subtitle: block.subtitle || fallback.subtitle || '',
    button_label: block.button_label || fallback.button_label || '',
    link_url: block.link_url || fallback.link_url || '',
    accent_color: block.accent_color || fallback.accent_color || '#087f74',
    sort_order: block.sort_order ?? fallback.sort_order ?? 0,
    is_active: block.is_active ?? fallback.is_active ?? true,
    image_url: block.image_url || null,
    image: null,
    remove_image: false,
});

const imageCropPresets = {
    hero: { aspect: 16 / 9, ratioLabel: '16:9', title: 'Crop hero image', outputType: 'image/jpeg' },
    promo: { aspect: 2, ratioLabel: '2:1', title: 'Crop promo tile', outputType: 'image/jpeg' },
};

const croppedImageName = (sourceName, prefix) => {
    const base = (sourceName || prefix).replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
    return `${base || prefix}-crop-${Date.now()}.jpg`;
};

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

function ImagePicker({ label, block, onChange, onFileSelect, cropHint }) {
    const objectUrl = useObjectUrl(block.image);
    const previewUrl = block.remove_image ? null : objectUrl || block.image_url;

    return (
        <div className="storefront-image-picker">
            <div className="storefront-image-preview" style={{ background: block.accent_color || '#087f74' }}>
                {previewUrl ? (
                    <img src={previewUrl} alt="" />
                ) : (
                    <Icon name="image" size={18} />
                )}
            </div>
            <div className="storefront-image-meta">
                <strong>{label}</strong>
                <small>{block.image?.name || (previewUrl ? 'Current image' : 'No image selected')}</small>
                {cropHint && <small className="storefront-crop-hint">{cropHint}</small>}
            </div>
            <div className="storefront-image-actions">
                <label className="btn secondary">
                    <Icon name="image" size={13} />
                    Upload
                    <input
                        className="sr-only-file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            event.target.value = '';
                            if (file && onFileSelect) onFileSelect(file);
                        }}
                    />
                </label>
                {previewUrl && (
                    <button type="button" className="icon-btn small danger" onClick={() => onChange({ image: null, remove_image: true })}>
                        <Icon name="trash" size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function StorefrontIndex({ hero, promos, sections }) {
    const { app_base, flash } = usePage().props;
    const [cropper, setCropper] = useState(null);

    const initialPromos = useMemo(() => (
        promos.length ? promos : [
            { key: 'editors-picks', title: "Editor's Picks", subtitle: 'Handpicked favorites', link_url: '/products', button_label: 'Explore', accent_color: '#fce4ec', sort_order: 1, is_active: true },
            { key: 'new-arrivals', title: 'New Arrivals', subtitle: 'Latest drops', link_url: '/products?sort=newest', button_label: 'View new', accent_color: '#f3e5f5', sort_order: 2, is_active: true },
        ]
    ), [promos]);

    const form = useForm({
        hero: normalizeBlock(hero, {
            title: 'Fresh picks for every occasion',
            subtitle: 'Discover customer favorites, seasonal gifts, and new arrivals curated for today.',
            button_label: 'Shop now',
            link_url: '/products',
            accent_color: '#087f74',
            is_active: true,
        }),
        promos: initialPromos.map((promo) => normalizeBlock(promo)),
        sections: sections.map((section) => ({
            id: section.id,
            key: section.key,
            title: section.title || '',
            subtitle: section.subtitle || '',
            sort_order: section.sort_order ?? 0,
            is_active: !!section.is_active,
        })),
    });

    const updateHero = (patch) => form.setData('hero', { ...form.data.hero, ...patch });
    const updatePromo = (index, patch) => {
        const next = [...form.data.promos];
        next[index] = { ...next[index], ...patch };
        form.setData('promos', next);
    };
    const updateSection = (index, patch) => {
        const next = [...form.data.sections];
        next[index] = { ...next[index], ...patch };
        form.setData('sections', next);
    };

    const openImageCropper = (file, target, preset) => {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            setCropper({
                image: reader.result,
                sourceName: file.name,
                target,
                ...preset,
            });
        };
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedBlob) => {
        if (!cropper) return;

        const croppedFile = new File([croppedBlob], croppedImageName(cropper.sourceName, cropper.target.type), {
            type: croppedBlob.type || cropper.outputType || 'image/jpeg',
        });

        if (cropper.target.type === 'hero') {
            updateHero({ image: croppedFile, remove_image: false });
        } else if (cropper.target.type === 'promo') {
            updatePromo(cropper.target.index, { image: croppedFile, remove_image: false });
        }

        setCropper(null);
    };

    const submit = (event) => {
        event.preventDefault();
        form.post(routeWithBase('/admin/storefront', app_base), {
            forceFormData: true,
            preserveScroll: true,
        });
    };

    return (
        <AdminLayout title="Storefront" eyebrow="Client decoration">
            <Head title="Storefront" />
            <AdminFlash flash={flash} errors={form.errors} />

            <form onSubmit={submit} className="storefront-editor">
                <section className="panel glass">
                    <PanelHeading eyebrow="Homepage hero" title="Hero banner" />
                    <div className="storefront-hero-grid">
                        <div className="storefront-preview-card" style={{ background: form.data.hero.accent_color || '#087f74' }}>
                            {(!form.data.hero.remove_image && (form.data.hero.image || form.data.hero.image_url)) && (
                                <ImagePreviewOverlay block={form.data.hero} />
                            )}
                            <div>
                                <small>Hero preview</small>
                                <h2>{form.data.hero.title || 'Hero title'}</h2>
                                <p>{form.data.hero.subtitle || 'Hero subtitle'}</p>
                                <span>{form.data.hero.button_label || 'Button label'}</span>
                            </div>
                        </div>
                        <div className="storefront-controls">
                            <div className="crud-grid">
                                <label className="form-field">
                                    <span>Hero title</span>
                                    <input value={form.data.hero.title} onChange={(e) => updateHero({ title: e.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Button label</span>
                                    <input value={form.data.hero.button_label} onChange={(e) => updateHero({ button_label: e.target.value })} />
                                </label>
                                <label className="form-field span-2">
                                    <span>Subtitle</span>
                                    <input value={form.data.hero.subtitle} onChange={(e) => updateHero({ subtitle: e.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Button link</span>
                                    <input value={form.data.hero.link_url} onChange={(e) => updateHero({ link_url: e.target.value })} placeholder="/products" />
                                </label>
                                <label className="form-field">
                                    <span>Accent color</span>
                                    <input type="color" value={form.data.hero.accent_color} onChange={(e) => updateHero({ accent_color: e.target.value })} />
                                </label>
                                <div className="span-2">
                                    <ImagePicker
                                        label="Hero image"
                                        block={form.data.hero}
                                        onChange={updateHero}
                                        onFileSelect={(file) => openImageCropper(file, { type: 'hero' }, imageCropPresets.hero)}
                                        cropHint="Fixed crop: 16:9 banner"
                                    />
                                </div>
                                <label className="form-field checkbox-row span-2">
                                    <input type="checkbox" checked={form.data.hero.is_active} onChange={(e) => updateHero({ is_active: e.target.checked })} />
                                    <span>Show hero on homepage</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Marketing tiles" title="Promo tiles" />
                    <div className="storefront-promo-list">
                        {form.data.promos.map((promo, index) => (
                            <article key={promo.key || index} className="storefront-promo-row">
                                <div className="storefront-promo-preview" style={{ background: promo.accent_color || '#f2f6f6' }}>
                                    <ImagePreviewOverlay block={promo} />
                                    <strong>{promo.title || 'Promo title'}</strong>
                                    <small>{promo.subtitle || 'Promo subtitle'}</small>
                                </div>
                                <div className="storefront-promo-fields">
                                    <div className="crud-grid">
                                        <label className="form-field">
                                            <span>Title</span>
                                            <input value={promo.title} onChange={(e) => updatePromo(index, { title: e.target.value })} />
                                        </label>
                                        <label className="form-field">
                                            <span>Subtitle</span>
                                            <input value={promo.subtitle} onChange={(e) => updatePromo(index, { subtitle: e.target.value })} />
                                        </label>
                                        <label className="form-field">
                                            <span>Link</span>
                                            <input value={promo.link_url} onChange={(e) => updatePromo(index, { link_url: e.target.value })} />
                                        </label>
                                        <label className="form-field">
                                            <span>Color</span>
                                            <input type="color" value={promo.accent_color} onChange={(e) => updatePromo(index, { accent_color: e.target.value })} />
                                        </label>
                                        <label className="form-field">
                                            <span>Order</span>
                                            <input type="number" value={promo.sort_order} onChange={(e) => updatePromo(index, { sort_order: e.target.value })} />
                                        </label>
                                        <label className="form-field checkbox-row">
                                            <input type="checkbox" checked={promo.is_active} onChange={(e) => updatePromo(index, { is_active: e.target.checked })} />
                                            <span>Visible</span>
                                        </label>
                                        <div className="span-2">
                                            <ImagePicker
                                                label="Tile image"
                                                block={promo}
                                                onChange={(patch) => updatePromo(index, patch)}
                                                onFileSelect={(file) => openImageCropper(file, { type: 'promo', index }, imageCropPresets.promo)}
                                                cropHint="Fixed crop: 2:1 tile"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Homepage controls" title="Sections" />
                    <div className="storefront-section-grid">
                        {form.data.sections.map((section, index) => (
                            <article key={section.key} className="storefront-section-card">
                                <div className="stack-row">
                                    <strong>{sectionLabels[section.key] || section.key}</strong>
                                    <label className="switch-lite">
                                        <input type="checkbox" checked={section.is_active} onChange={(e) => updateSection(index, { is_active: e.target.checked })} />
                                        <span />
                                    </label>
                                </div>
                                <label className="form-field">
                                    <span>Section title</span>
                                    <input value={section.title} onChange={(e) => updateSection(index, { title: e.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Subtitle</span>
                                    <input value={section.subtitle} onChange={(e) => updateSection(index, { subtitle: e.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Order</span>
                                    <input type="number" value={section.sort_order} onChange={(e) => updateSection(index, { sort_order: e.target.value })} />
                                </label>
                            </article>
                        ))}
                    </div>
                </section>

                <div className="sticky-toolbar">
                    <button type="submit" className="btn primary" disabled={form.processing}>
                        <Icon name="check" size={14} />
                        {form.processing ? 'Saving...' : 'Save storefront'}
                    </button>
                </div>
            </form>

            <CropImageModal
                open={!!cropper}
                image={cropper?.image}
                onCropComplete={handleCropComplete}
                onCancel={() => setCropper(null)}
                aspect={cropper?.aspect || 16 / 9}
                title={cropper?.title || 'Crop image'}
                ratioLabel={cropper?.ratioLabel}
                outputType={cropper?.outputType || 'image/jpeg'}
            />
        </AdminLayout>
    );
}

function ImagePreviewOverlay({ block }) {
    const objectUrl = useObjectUrl(block.image);
    const src = block.remove_image ? null : objectUrl || block.image_url;

    if (!src) return null;

    return <img className="storefront-preview-image" src={src} alt="" />;
}
