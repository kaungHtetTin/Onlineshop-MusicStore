import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import Icon from '@/Components/Admin/icons';
import { usePhraseTranslation } from '@/Utils/i18n';

async function getCroppedImg(imageSrc, pixelCrop, outputType = 'image/jpeg') {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas is empty'));
                return;
            }
            resolve(blob);
        }, outputType);
    });
}

const createImage = (url) =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });

const defaultRatioLabel = (aspect) => {
    if (aspect === 1) return '1:1';
    if (Math.abs(aspect - 3 / 4) < 0.01) return '3:4';
    if (Math.abs(aspect - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(aspect - 2) < 0.01) return '2:1';
    return null;
};

export default function CropImageModal({
    open,
    image,
    onCropComplete,
    onCancel,
    aspect = 3 / 4,
    title = 'Crop image',
    ratioLabel = null,
    outputType = 'image/jpeg',
}) {
    const t = usePhraseTranslation();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

    const onCropAreaComplete = useCallback((_croppedArea, pixels) => {
        setCroppedAreaPixels(pixels);
    }, []);

    const handleCrop = async () => {
        try {
            const croppedImage = await getCroppedImg(image, croppedAreaPixels, outputType);
            onCropComplete(croppedImage);
        } catch (e) {
            console.error(e);
        }
    };

    if (!open) return null;

    return (
        <div className="modal-backdrop crop-modal-backdrop" onClick={onCancel}>
            <div className="operation-modal compact glass crop-modal" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                    <div>
                        <p className="eyebrow">{t('Media')}</p>
                        <h2 style={{ fontSize: 16, fontWeight: 800 }}>
                            {t(title)}{(ratioLabel || defaultRatioLabel(aspect)) ? ` (${ratioLabel || defaultRatioLabel(aspect)})` : ''}
                        </h2>
                    </div>
                    <button type="button" className="icon-btn small" onClick={onCancel} aria-label={t('Close')}>
                        <Icon name="close" size={14} />
                    </button>
                </div>
                <div className="crop-area">
                    {image && (
                        <Cropper
                            image={image}
                            crop={crop}
                            zoom={zoom}
                            aspect={aspect}
                            onCropChange={setCrop}
                            onCropComplete={onCropAreaComplete}
                            onZoomChange={setZoom}
                        />
                    )}
                </div>
                <div className="crop-zoom">
                    <label className="form-field">
                        <span>{t('Zoom')}</span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.1}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                        />
                    </label>
                </div>
                <div className="modal-actions">
                    <button type="button" className="btn secondary" onClick={onCancel}>
                        {t('Cancel')}
                    </button>
                    <button type="button" className="btn primary" onClick={handleCrop}>
                        {t('Crop & save')}
                    </button>
                </div>
            </div>
        </div>
    );
}
