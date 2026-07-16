import { useMemo, useState } from 'react';
import { Head, Link, useForm, usePage } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import CropImageModal from '@/Components/Admin/CropImageModal';
import ProductFormUI from '@/Components/Admin/ProductFormUI';
import { normalizeOptionKey, refreshAutoSkuCodes } from '@/Components/Admin/productFormUtils';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function Edit({ product, categories, app_base }) {
    const { app_url } = usePage().props;
    const t = usePhraseTranslation();
    const { data, setData, transform, post, processing, errors } = useForm({
        _method: 'PATCH',
        category_id: product.category_id,
        name: product.name,
        description: product.description || '',
        status: product.status || 'active',
        is_featured: !!product.is_featured,
        is_active: !!product.is_active,
        metadata: product.metadata || { options: [] },
        mainImageAttachmentId: product.images.find((img) => img.is_primary)?.id || null,
        imageAttachmentIds: product.images.map((img) => img.id),
        skus: (product.skus || []).map((sku) => ({
            ...sku,
            sku_code_auto: false,
            cost: sku.cost ?? sku.market_price ?? '',
            wholesale_price: sku.wholesale_price ?? '',
        })),
        images: [],
    });

    const [previews, setPreviews] = useState([]);
    const [options, setOptions] = useState(() => (
        Array.isArray(product.metadata?.options)
            ? product.metadata.options.map((option) => ({ ...option, id: `${Date.now()}-${Math.random()}` }))
            : []
    ));
    const [selectedSkuImageId, setSelectedSkuImageId] = useState(
        data.skus[0]?.image_attachment_id || data.mainImageAttachmentId,
    );
    const [croppingImage, setCroppingImage] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);

    const optionNames = useMemo(
        () => options.map((o) => o.name).filter((n) => n && n.trim() !== '' && normalizeOptionKey(n) !== ''),
        [options],
    );

    const namesFromOptions = (nextOptions) => nextOptions
        .map((option) => option.name)
        .filter((name) => name && name.trim() !== '' && normalizeOptionKey(name) !== '');

    const refreshSkuCodes = (skus, title = data.name, names = optionNames) => (
        refreshAutoSkuCodes(skus, title, names)
    );

    const updateSku = (index, patch) => {
        const newSkus = [...data.skus];
        newSkus[index] = { ...newSkus[index], ...patch };
        setData('skus', refreshSkuCodes(newSkus));
    };

    const addSku = () => {
        const nextSkus = [
            ...data.skus,
            {
                sku_code: '',
                sku_code_auto: true,
                barcode: '',
                price: 0,
                wholesale_price: '',
                cost: '',
                is_active: true,
                attributes: {},
                image_attachment_id: selectedSkuImageId,
            },
        ];
        setData('skus', refreshSkuCodes(nextSkus));
    };

    const removeSku = (index) => setData('skus', refreshSkuCodes(data.skus.filter((_, i) => i !== index)));

    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        setPendingFiles(files);
        const reader = new FileReader();
        reader.onload = () => setCroppingImage(reader.result);
        reader.readAsDataURL(files[0]);
    };

    const handleCropComplete = (croppedBlob) => {
        const croppedFile = new File([croppedBlob], `product-${Date.now()}.jpg`, { type: 'image/jpeg' });
        setData('images', [...data.images, croppedFile]);

        const newUrl = URL.createObjectURL(croppedBlob);
        setPreviews([...previews, newUrl]);

        const remaining = pendingFiles.slice(1);
        if (remaining.length > 0) {
            setPendingFiles(remaining);
            const reader = new FileReader();
            reader.onload = () => setCroppingImage(reader.result);
            reader.readAsDataURL(remaining[0]);
        } else {
            setPendingFiles([]);
            setCroppingImage(null);
        }
    };

    const removeNewPreview = (index) => {
        const newImages = [...data.images];
        newImages.splice(index, 1);
        setData('images', newImages);

        const newPreviews = [...previews];
        URL.revokeObjectURL(newPreviews[index]);
        newPreviews.splice(index, 1);
        setPreviews(newPreviews);
    };

    const removeExistingImage = (imageId) => {
        const newIds = data.imageAttachmentIds.filter((id) => id !== imageId);
        setData('imageAttachmentIds', newIds);
        if (data.mainImageAttachmentId === imageId) {
            setData('mainImageAttachmentId', newIds[0] || null);
        }
        if (selectedSkuImageId === imageId) {
            setSelectedSkuImageId(newIds[0] || null);
        }
    };

    const setCover = (imageId) => setData('mainImageAttachmentId', imageId);

    const handleSubmit = (e) => {
        e.preventDefault();
        transform((current) => ({
            ...current,
            metadata: {
                options: options
                    .map((option) => ({ name: option.name.trim() }))
                    .filter((option) => option.name),
            },
        }));
        post(routeWithBase(`/admin/products/${product.id}`, app_base));
    };

    return (
        <AdminLayout
            title={`${t('Edit')}: ${product.name}`}
            eyebrow={t('Catalog')}
            action={
                <button type="button" className="btn primary" onClick={handleSubmit} disabled={processing}>
                    <Icon name="check" size={14} />
                    {processing ? t('Saving...') : t('Save changes')}
                </button>
            }
        >
            <Head title={t('Edit Product')} />

            <div className="sticky-toolbar">
                <Link href={routeWithBase('/admin/products', app_base)} className="back-link" style={{ marginBottom: 0 }}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                    {t('Back to products')}
                </Link>
            </div>

            {Object.keys(errors).length > 0 && (
                <div className="flash error">
                    {t('Please correct the errors below.')}
                    {Object.entries(errors).map(([key, err]) => (
                        <div key={key}>
                            <small>
                                {key}: {err}
                            </small>
                        </div>
                    ))}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <ProductFormUI
                    mode="edit"
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    categories={categories}
                    options={options}
                    setOptions={setOptions}
                    optionNames={optionNames}
                    previews={previews}
                    product={product}
                    app_url={app_url}
                    selectedSkuImageKey={selectedSkuImageId}
                    setSelectedSkuImageKey={setSelectedSkuImageId}
                    onUpdateSku={updateSku}
                    onRemoveSku={removeSku}
                    onAddSku={addSku}
                    onImageChange={handleImageChange}
                    onRemoveNewPreview={removeNewPreview}
                    onRemoveExistingImage={removeExistingImage}
                    onSetCover={setCover}
                    imageKeyForSku={(sku) => sku.image_attachment_id ?? null}
                    setImageKeyForSku={(key) => ({ image_attachment_id: key })}
                    onProductNameChange={(name) => setData({ ...data, name, skus: refreshSkuCodes(data.skus, name) })}
                    onRegenerateSku={(index) => {
                        const nextSkus = data.skus.map((sku, skuIndex) => (
                            skuIndex === index ? { ...sku, sku_code_auto: true } : sku
                        ));
                        setData('skus', refreshSkuCodes(nextSkus));
                    }}
                    onSkuStructureChange={(skus, nextOptions) => setData('skus', refreshSkuCodes(skus, data.name, namesFromOptions(nextOptions)))}
                />
            </form>

            <CropImageModal
                open={!!croppingImage}
                image={croppingImage}
                onCropComplete={handleCropComplete}
                onCancel={() => {
                    setCroppingImage(null);
                    setPendingFiles([]);
                }}
                aspect={3 / 4}
            />
        </AdminLayout>
    );
}
