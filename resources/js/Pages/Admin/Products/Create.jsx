import { useMemo, useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import CropImageModal from '@/Components/Admin/CropImageModal';
import ProductFormUI from '@/Components/Admin/ProductFormUI';
import {
    buildCombinations,
    generateSkuCode,
    normalizeOptionKey,
    signatureForAttributes,
} from '@/Components/Admin/productFormUtils';
import { routeWithBase } from '@/Utils/url';

export default function Create({ categories, app_base }) {
    const [previews, setPreviews] = useState([]);
    const [options, setOptions] = useState([{ id: Date.now(), name: '', values: [] }]);
    const [selectedSkuImageIndex, setSelectedSkuImageIndex] = useState(null);
    const [croppingImage, setCroppingImage] = useState(null);
    const [pendingFiles, setPendingFiles] = useState([]);

    const { data, setData, post, processing, errors } = useForm({
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

    const generateVariants = () => {
        const combos = buildCombinations(options);
        if (combos.length === 0) return;

        const bySig = new Map();
        for (const v of data.skus) {
            bySig.set(signatureForAttributes(v.attributes, optionNames), v);
        }

        const skuCodes = new Set(data.skus.map((v) => v.sku_code).filter(Boolean));
        const next = [...data.skus];

        for (const attrs of combos) {
            const sig = signatureForAttributes(attrs, optionNames);
            if (!bySig.has(sig)) {
                next.push({
                    sku_code: generateSkuCode({ title: data.name, attrs, optionNames, existing: skuCodes }),
                    barcode: '',
                    price: 0,
                    stock_qty: 0,
                    is_active: true,
                    attributes: attrs,
                    image_index: selectedSkuImageIndex,
                });
            }
        }

        setData({
            ...data,
            metadata: { options: options.filter((o) => o.name && o.values.length > 0) },
            skus: next,
        });
    };

    const updateSku = (index, patch) => {
        const newSkus = [...data.skus];
        newSkus[index] = { ...newSkus[index], ...patch };
        setData('skus', newSkus);
    };

    const removeSku = (index) => setData('skus', data.skus.filter((_, i) => i !== index));

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
        post(routeWithBase('/admin/products', app_base));
    };

    return (
        <AdminLayout
            title="Add product"
            eyebrow="Catalog"
            action={
                <button type="button" className="btn primary" onClick={handleSubmit} disabled={processing}>
                    <Icon name="check" size={14} />
                    {processing ? 'Saving…' : 'Save product'}
                </button>
            }
        >
            <Head title="Create Product" />

            <div className="sticky-toolbar">
                <Link href={routeWithBase('/admin/products', app_base)} className="back-link" style={{ marginBottom: 0 }}>
                    <Icon name="navigation" size={14} style={{ transform: 'rotate(180deg)' }} />
                    Back to products
                </Link>
            </div>

            {Object.keys(errors).length > 0 && (
                <div className="flash error">
                    Please correct the errors below.
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
                    onGenerateVariants={generateVariants}
                    onUpdateSku={updateSku}
                    onRemoveSku={removeSku}
                    onAddSku={() =>
                        setData('skus', [
                            ...data.skus,
                            {
                                sku_code: '',
                                barcode: '',
                                price: 0,
                                stock_qty: 0,
                                is_active: true,
                                attributes: {},
                                image_index: selectedSkuImageIndex,
                            },
                        ])
                    }
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
