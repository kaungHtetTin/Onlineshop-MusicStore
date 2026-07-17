import { useMemo, useState } from 'react';
import { Head, Link, useForm } from '@/spa/router';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import CropImageModal from '@/Components/Admin/CropImageModal';
import ProductFormUI from '@/Components/Admin/ProductFormUI';
import { normalizeOptionKey, refreshAutoSkuCodes } from '@/Components/Admin/productFormUtils';
import { imageExtensionFromType } from '@/Utils/imageCompression';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function Create({ categories, app_base }) {
    const t = usePhraseTranslation();
    const [previews, setPreviews] = useState([]);
    const [options, setOptions] = useState([]);
    const [selectedSkuImageIndex, setSelectedSkuImageIndex] = useState(null);
    const [croppingImage, setCroppingImage] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);

    const { data, setData, transform, post, processing, errors } = useForm({
        category_id: '',
        name: '',
        description: '',
        status: 'active',
        is_featured: false,
        metadata: { options: [] },
        mainImageAttachmentId: null,
        imageAttachmentIds: [],
        skus: [],
        images: [],
    });

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
                image_index: selectedSkuImageIndex,
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
        const croppedFile = new File(
            [croppedBlob],
            `product-${Date.now()}.${imageExtensionFromType(croppedBlob.type)}`,
            { type: croppedBlob.type || 'image/jpeg' },
        );
        const newImages = [...data.images, croppedFile];
        setData('images', newImages);

        const newUrl = URL.createObjectURL(croppedBlob);
        const allPreviews = [...previews, newUrl];
        setPreviews(allPreviews);

        if (selectedSkuImageIndex === null) setSelectedSkuImageIndex(allPreviews.length - 1);

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

        if (selectedSkuImageIndex === index) {
            setSelectedSkuImageIndex(newPreviews.length > 0 ? 0 : null);
        } else if (selectedSkuImageIndex > index) {
            setSelectedSkuImageIndex(selectedSkuImageIndex - 1);
        }
    };

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
        post(routeWithBase('/admin/products', app_base));
    };

    return (
        <AdminLayout
            title={t('Add product')}
            eyebrow={t('Catalog')}
            action={
                <button type="button" className="btn primary" onClick={handleSubmit} disabled={processing}>
                    <Icon name="check" size={14} />
                    {processing ? t('Saving...') : t('Save product')}
                </button>
            }
        >
            <Head title={t('Create Product')} />

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
                    mode="create"
                    data={data}
                    setData={setData}
                    errors={errors}
                    processing={processing}
                    categories={categories}
                    options={options}
                    setOptions={setOptions}
                    optionNames={optionNames}
                    previews={previews}
                    product={{ images: [] }}
                    app_url={null}
                    selectedSkuImageKey={selectedSkuImageIndex}
                    setSelectedSkuImageKey={setSelectedSkuImageIndex}
                    onUpdateSku={updateSku}
                    onRemoveSku={removeSku}
                    onAddSku={addSku}
                    onImageChange={handleImageChange}
                    onRemoveNewPreview={removeNewPreview}
                    onRemoveExistingImage={() => {}}
                    onClearAllImages={() => {
                        previews.forEach((url) => URL.revokeObjectURL(url));
                        setPreviews([]);
                        setData('images', []);
                        setSelectedSkuImageIndex(null);
                    }}
                    onSetCover={() => {}}
                    imageKeyForSku={(sku) => sku.image_index ?? null}
                    setImageKeyForSku={(key) => ({ image_index: key })}
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
