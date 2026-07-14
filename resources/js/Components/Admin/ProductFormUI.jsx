import Icon from '@/Components/Admin/icons';
import { PanelHeading, StatusBadge } from '@/Components/Admin/shared';
import { normalizeOptionKey, variantLabel } from '@/Components/Admin/productFormUtils';
import { storageUrl } from '@/Utils/url';

export default function ProductFormUI({
    mode,
    data,
    setData,
    errors,
    processing,
    categories,
    options,
    setOptions,
    optionNames,
    previews,
    product,
    app_url,
    selectedSkuImageKey,
    setSelectedSkuImageKey,
    onGenerateVariants,
    onUpdateSku,
    onRemoveSku,
    onAddSku,
    onImageChange,
    onRemoveNewPreview,
    onRemoveExistingImage,
    onClearAllImages,
    onSetCover,
    imageKeyForSku,
    setImageKeyForSku,
}) {
    const isEdit = mode === 'edit';
    const existingImages = isEdit ? product.images.filter((img) => data.imageAttachmentIds.includes(img.id)) : [];

    const addOption = () => {
        if (options.length >= 3) return;
        setOptions([...options, { id: Date.now(), name: '', values: [] }]);
    };

    const removeOption = (index) => {
        const next = [...options];
        next.splice(index, 1);
        setOptions(next);
    };

    const renderThumbPicker = (sku, idx) => {
        const currentKey = imageKeyForSku(sku);

        return (
            <div className="thumb-picker">
                <div
                    className={`thumb-none ${currentKey === null ? 'selected' : ''}`}
                    onClick={() => onUpdateSku(idx, setImageKeyForSku(null))}
                    role="button"
                    tabIndex={0}
                >
                    None
                </div>
                {isEdit
                    ? existingImages.map((img) => (
                          <img
                              key={img.id}
                              src={storageUrl(img.image_path, app_url)}
                              alt=""
                              className={`thumb ${currentKey === img.id ? 'selected' : ''}`}
                              onClick={() => onUpdateSku(idx, setImageKeyForSku(img.id))}
                          />
                      ))
                    : previews.map((url, imgIdx) => (
                          <img
                              key={imgIdx}
                              src={url}
                              alt=""
                              className={`thumb ${currentKey === imgIdx ? 'selected' : ''}`}
                              onClick={() => onUpdateSku(idx, setImageKeyForSku(imgIdx))}
                          />
                      ))}
            </div>
        );
    };

    return (
        <div className="product-form-layout">
            <div className="product-form-main">
                <section className="panel glass">
                    <PanelHeading eyebrow="General" title="Product information" />
                    <div className="crud-grid" style={{ padding: 0 }}>
                        <label className="form-field span-2">
                            <span>Product name</span>
                            <input value={data.name} onChange={(e) => setData('name', e.target.value)} required />
                            {errors.name && <small style={{ color: '#ce4444' }}>{errors.name}</small>}
                        </label>
                        <label className="form-field span-2">
                            <span>Description</span>
                            <textarea value={data.description} onChange={(e) => setData('description', e.target.value)} />
                            {errors.description && <small style={{ color: '#ce4444' }}>{errors.description}</small>}
                        </label>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Media" title="Product images" />
                    <p>Add multiple images. Select one for new variant defaults.</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
                        <label className="btn primary" style={{ cursor: 'pointer' }}>
                            <Icon name="image" size={14} />
                            {isEdit ? 'Add more images' : 'Upload images'}
                            <input type="file" hidden multiple accept="image/*" onChange={onImageChange} disabled={processing} />
                        </label>
                        {!isEdit && data.images.length > 0 && onClearAllImages && (
                            <button type="button" className="btn danger" onClick={onClearAllImages}>
                                Remove all
                            </button>
                        )}
                        {(data.images.length > 0 || existingImages.length > 0) && (
                            <StatusBadge status="info" label={`${existingImages.length + previews.length} images`} />
                        )}
                    </div>

                    <div className="image-grid">
                        {existingImages.map((img) => {
                            const isCover = data.mainImageAttachmentId === img.id;
                            const isSelected = selectedSkuImageKey === img.id;
                            return (
                                <div
                                    key={img.id}
                                    className={`image-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedSkuImageKey(img.id)}
                                >
                                    <img src={storageUrl(img.image_path, app_url)} alt="" />
                                    <div className="actions">
                                        {isCover && <span className="chip">Cover</span>}
                                        {isSelected && <span className="chip">SKU default</span>}
                                        <button
                                            type="button"
                                            className="btn secondary full"
                                            style={{ minHeight: 28, fontSize: 10 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveExistingImage(img.id);
                                            }}
                                        >
                                            Remove
                                        </button>
                                        {!isCover && (
                                            <button
                                                type="button"
                                                className="btn secondary full"
                                                style={{ minHeight: 28, fontSize: 10 }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSetCover(img.id);
                                                }}
                                            >
                                                Set cover
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {previews.map((url, index) => {
                            const isSelected = !isEdit && selectedSkuImageKey === index;
                            return (
                                <div
                                    key={`new-${index}`}
                                    className={`image-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => setSelectedSkuImageKey(index)}
                                >
                                    <img src={url} alt="" />
                                    <div className="actions">
                                        {index === 0 && !isEdit && <span className="chip">Cover</span>}
                                        {isSelected && <span className="chip">SKU default</span>}
                                        <button
                                            type="button"
                                            className="btn secondary full"
                                            style={{ minHeight: 28, fontSize: 10 }}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveNewPreview(index);
                                            }}
                                        >
                                            {isEdit ? 'Cancel upload' : 'Remove'}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                        {existingImages.length === 0 && previews.length === 0 && (
                            <div
                                style={{
                                    width: 140,
                                    height: 90,
                                    border: '1px dashed var(--color-border)',
                                    borderRadius: 6,
                                    display: 'grid',
                                    placeItems: 'center',
                                }}
                            >
                                <small>No images yet</small>
                            </div>
                        )}
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Options" title="Variant options" />
                    <p>Define options like Size or Color (max 3).</p>
                    <div className="stack-sm" style={{ marginTop: 12 }}>
                        {options.map((opt, idx) => (
                            <div key={opt.id} className="variant-card">
                                <div className="crud-grid" style={{ padding: 0 }}>
                                    <label className="form-field">
                                        <span>Option name</span>
                                        <input
                                            value={opt.name}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, name: value } : o)));
                                            }}
                                        />
                                    </label>
                                    <label className="form-field">
                                        <span>Values (comma separated)</span>
                                        <input
                                            value={(opt.values || []).join(', ')}
                                            onChange={(e) => {
                                                const values = e.target.value
                                                    .split(',')
                                                    .map((s) => s.trim())
                                                    .filter((s) => s !== '');
                                                setOptions((prev) => prev.map((o, i) => (i === idx ? { ...o, values } : o)));
                                            }}
                                        />
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    className="btn danger"
                                    style={{ marginTop: 8, minHeight: 32 }}
                                    onClick={() => removeOption(idx)}
                                    disabled={processing}
                                >
                                    Remove option
                                </button>
                            </div>
                        ))}
                        <button type="button" className="btn secondary" onClick={addOption} disabled={options.length >= 3 || processing}>
                            Add option
                        </button>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading
                        eyebrow="Variants"
                        title="SKUs"
                        action={
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn secondary"
                                    style={{ minHeight: 32 }}
                                    onClick={onGenerateVariants}
                                    disabled={processing || optionNames.length === 0}
                                >
                                    {isEdit ? 'Update grid' : 'Generate variants'}
                                </button>
                                <button type="button" className="btn secondary" style={{ minHeight: 32 }} onClick={onAddSku} disabled={processing}>
                                    Add variant
                                </button>
                            </div>
                        }
                    />

                    {data.skus.length === 0 ? (
                        <p>No variants yet.</p>
                    ) : (
                        data.skus.map((v, idx) => (
                            <div key={idx} className="variant-card">
                                <div className="stack-row" style={{ alignItems: 'flex-start' }}>
                                    <div>
                                        <strong>{variantLabel(v.attributes, optionNames)}</strong>
                                        <div className="chip-row">
                                            {Object.entries(v.attributes || {}).map(([k, val]) => (
                                                <span key={`${k}-${val}`} className="chip">
                                                    {k}: {val}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                    <button type="button" className="btn danger" style={{ minHeight: 32 }} onClick={() => onRemoveSku(idx)} disabled={processing}>
                                        Remove
                                    </button>
                                </div>

                                {renderThumbPicker(v, idx)}

                                <div className="crud-grid" style={{ padding: '12px 0 0' }}>
                                    {optionNames.map((optName) => {
                                        const attrKey = normalizeOptionKey(optName);
                                        return (
                                            <label key={attrKey} className="form-field">
                                                <span>{optName}</span>
                                                <input
                                                    value={v.attributes?.[attrKey] || ''}
                                                    onChange={(e) => {
                                                        const newAttrs = { ...(v.attributes || {}), [attrKey]: e.target.value };
                                                        onUpdateSku(idx, { attributes: newAttrs });
                                                    }}
                                                />
                                            </label>
                                        );
                                    })}
                                    <label className="form-field">
                                        <span>SKU code</span>
                                        <input value={v.sku_code} onChange={(e) => onUpdateSku(idx, { sku_code: e.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Barcode</span>
                                        <input value={v.barcode} onChange={(e) => onUpdateSku(idx, { barcode: e.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Price</span>
                                        <input type="number" value={v.price} onChange={(e) => onUpdateSku(idx, { price: e.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Stock</span>
                                        <input type="number" value={v.stock_qty} onChange={(e) => onUpdateSku(idx, { stock_qty: e.target.value })} />
                                    </label>
                                    <label className="form-field checkbox-row">
                                        <input
                                            type="checkbox"
                                            checked={!!v.is_active}
                                            onChange={(e) => onUpdateSku(idx, { is_active: e.target.checked })}
                                        />
                                        <span>Active</span>
                                    </label>
                                </div>
                            </div>
                        ))
                    )}
                </section>
            </div>

            <div className="product-form-side">
                <section className="panel glass">
                    <PanelHeading eyebrow="Status" title="Visibility" />
                    <label className="form-field">
                        <span>Product status</span>
                        <select value={data.status} onChange={(e) => setData('status', e.target.value)} required>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="draft">Draft</option>
                        </select>
                        {errors.status && <small style={{ color: '#ce4444' }}>{errors.status}</small>}
                    </label>
                    <label className="form-field checkbox-row" style={{ marginTop: 10 }}>
                        <input type="checkbox" checked={data.is_featured} onChange={(e) => setData('is_featured', e.target.checked)} />
                        <span>Featured product</span>
                    </label>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow="Catalog" title="Category" />
                    <label className="form-field">
                        <span>Category</span>
                        <select value={data.category_id} onChange={(e) => setData('category_id', e.target.value)} required>
                            <option value="">Select category</option>
                            {categories.map((cat) => (
                                <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                </option>
                            ))}
                        </select>
                        {errors.category_id && <small style={{ color: '#ce4444' }}>{errors.category_id}</small>}
                    </label>
                </section>
            </div>
        </div>
    );
}
