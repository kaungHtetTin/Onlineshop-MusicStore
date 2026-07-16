import { Head, useForm, usePage } from '@/spa/router';
import { useEffect, useState } from 'react';
import AdminLayout from '@/Layouts/AdminLayout';
import Icon from '@/Components/Admin/icons';
import { AdminFlash } from '@/Components/Admin/AdminFlash';
import { PanelHeading } from '@/Components/Admin/shared';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

const contactMeta = {
    email: { label: 'Email', type: 'email', placeholder: 'support@example.com' },
    phone: { label: 'Phone', type: 'text', placeholder: '+95 9 123 456 789' },
    facebook: { label: 'Facebook', type: 'text', placeholder: 'https://facebook.com/your-page' },
    tiktok: { label: 'TikTok', type: 'text', placeholder: 'https://tiktok.com/@your-shop' },
};

const ensureContacts = (contacts = {}) => ({
    email: contacts.email?.length ? contacts.email : [''],
    phone: contacts.phone?.length ? contacts.phone : [''],
    facebook: contacts.facebook?.length ? contacts.facebook : [''],
    tiktok: contacts.tiktok?.length ? contacts.tiktok : [''],
});

const validHex = (value) => /^#[0-9A-Fa-f]{6}$/.test(value || '');

function useObjectUrl(file) {
    const [url, setUrl] = useState(null);

    useEffect(() => {
        if (!file) {
            setUrl(null);
            return undefined;
        }

        const nextUrl = URL.createObjectURL(file);
        setUrl(nextUrl);

        return () => URL.revokeObjectURL(nextUrl);
    }, [file]);

    return url;
}

function AssetControl({ id, label, previewUrl, icon, fileName, error, accept, onUpload, onRemove, canRemove, t }) {
    const translatedLabel = t(label);

    return (
        <div className="settings-asset-row">
            <div className="settings-asset-thumb">
                {previewUrl ? <img src={previewUrl} alt="" /> : <Icon name={icon} size={17} />}
            </div>
            <div className="settings-asset-meta">
                <span>{translatedLabel}</span>
                <small>{fileName}</small>
                {error && <small className="field-error">{error}</small>}
            </div>
            <div className="settings-asset-actions">
                <input
                    id={id}
                    type="file"
                    className="sr-only-file"
                    accept={accept}
                    onChange={(e) => {
                        onUpload(e.target.files?.[0] || null);
                        e.target.value = '';
                    }}
                />
                <label className="icon-btn small" htmlFor={id} title={`${t('Upload')} ${translatedLabel}`} aria-label={`${t('Upload')} ${translatedLabel}`}>
                    <Icon name="image" size={13} />
                </label>
                {canRemove && (
                    <button type="button" className="icon-btn small danger" title={`${t('Remove')} ${translatedLabel}`} aria-label={`${t('Remove')} ${translatedLabel}`} onClick={onRemove}>
                        <Icon name="trash" size={13} />
                    </button>
                )}
            </div>
        </div>
    );
}

function ContactRows({ type, values, errors, onChange, onAdd, onRemove, t }) {
    const meta = contactMeta[type];
    const label = t(meta.label);

    return (
        <div className="stack-sm settings-contact-group">
            <div className="stack-row" style={{ alignItems: 'center', marginBottom: 2 }}>
                <div>
                    <p className="eyebrow">{label}</p>
                </div>
                <button type="button" className="btn secondary" onClick={onAdd} style={{ minHeight: 30, padding: '6px 9px' }}>
                    <Icon name="plus" size={13} />
                    {t('Add')}
                </button>
            </div>

            {values.map((value, index) => (
                <label key={`${type}-${index}`} className="form-field">
                    <span>
                        {label} {index + 1}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <input
                            type={meta.type}
                            value={value}
                            placeholder={meta.placeholder}
                            onChange={(e) => onChange(index, e.target.value)}
                        />
                        <button
                            type="button"
                            className="icon-btn small danger"
                            aria-label={`${t('Remove')} ${label}`}
                            onClick={() => onRemove(index)}
                            disabled={values.length === 1 && !value}
                            style={{ flexShrink: 0, alignSelf: 'center' }}
                        >
                            <Icon name="trash" size={13} />
                        </button>
                    </div>
                    {errors?.[`${type}.${index}`] && <small style={{ color: '#ce4444' }}>{errors[`${type}.${index}`]}</small>}
                </label>
            ))}
        </div>
    );
}

export default function SettingsEdit({ settings }) {
    const { app_base, flash } = usePage().props;
    const t = usePhraseTranslation();
    const form = useForm({
        app_name: settings.app_name || '',
        theme_color: settings.theme_color || '#087f74',
        logo: null,
        favicon: null,
        remove_logo: false,
        remove_favicon: false,
        contacts: ensureContacts(settings.contacts),
    });

    const submit = (e) => {
        e.preventDefault();
        form.post(routeWithBase('/admin/settings', app_base), {
            preserveScroll: true,
            forceFormData: true,
        });
    };

    const setContact = (type, index, value) => {
        const next = [...(form.data.contacts[type] || [''])];
        next[index] = value;
        form.setData('contacts', { ...form.data.contacts, [type]: next });
    };

    const addContact = (type) => {
        form.setData('contacts', {
            ...form.data.contacts,
            [type]: [...(form.data.contacts[type] || []), ''],
        });
    };

    const removeContact = (type, index) => {
        const next = (form.data.contacts[type] || []).filter((_, i) => i !== index);
        form.setData('contacts', {
            ...form.data.contacts,
            [type]: next.length ? next : [''],
        });
    };

    const contactErrors = Object.entries(form.errors || {}).reduce((carry, [key, value]) => {
        if (key.startsWith('contacts.')) {
            const [, type, index] = key.split('.');
            carry[`${type}.${index}`] = value;
        }

        return carry;
    }, {});

    const logoName = form.data.logo?.name || (form.data.remove_logo ? t('Logo will be removed') : t('No new file selected'));
    const faviconName = form.data.favicon?.name || (form.data.remove_favicon ? t('Favicon will be removed') : t('No new file selected'));
    const previewColor = validHex(form.data.theme_color) ? form.data.theme_color : '#087f74';
    const logoObjectUrl = useObjectUrl(form.data.logo);
    const faviconObjectUrl = useObjectUrl(form.data.favicon);
    const logoPreviewUrl = form.data.remove_logo ? null : logoObjectUrl || settings.logo_url;
    const faviconPreviewUrl = form.data.remove_favicon ? null : faviconObjectUrl || settings.favicon_url;

    return (
        <AdminLayout title={t('Application settings')} eyebrow={t('Office configuration')}>
            <Head title={t('Application Settings')}>
                {settings.favicon_url && <link rel="icon" href={settings.favicon_url} />}
            </Head>

            <AdminFlash flash={flash} errors={form.errors} />

            <form onSubmit={submit} className="stack-sm">
                <section className="panel glass">
                    <PanelHeading eyebrow={t('Brand system')} title={t('Application identity')} />
                    <div className="settings-brand-system">
                        <aside className="brand-preview-card">
                            <div className="brand-preview-top">
                                <div className="brand-preview-mark" style={{ background: previewColor }}>
                                    {logoPreviewUrl ? (
                                        <img src={logoPreviewUrl} alt="" />
                                    ) : (
                                        <Icon name="shop" size={18} />
                                    )}
                                </div>
                                <div>
                                    <strong>{form.data.app_name || t('Application')}</strong>
                                    <small>{t('Admin console')}</small>
                                </div>
                            </div>
                            <div className="brand-preview-strip" style={{ background: previewColor }} />
                            <div className="brand-preview-controls">
                                <span className="status" style={{ color: previewColor, background: `${previewColor}1a` }}>
                                    <span className="status-dot" />
                                    {t('Primary')}
                                </span>
                                <button type="button" className="btn primary" style={{ background: previewColor }}>
                                    {t('Action')}
                                </button>
                            </div>
                            <div className="brand-token-row">
                                <span style={{ background: previewColor }} />
                                <code>{form.data.theme_color || '#087f74'}</code>
                            </div>
                        </aside>

                        <div className="settings-brand-controls">
                            <div className="settings-field-grid">
                                <label className="form-field">
                                    <span>{t('Application name')}</span>
                                    <input
                                        value={form.data.app_name}
                                        onChange={(e) => form.setData('app_name', e.target.value)}
                                        required
                                        maxLength={80}
                                    />
                                    {form.errors.app_name && <small className="field-error">{form.errors.app_name}</small>}
                                </label>

                                <label className="form-field">
                                    <span>{t('Theme color')}</span>
                                    <div className="settings-color-control">
                                        <input
                                            type="color"
                                            value={previewColor}
                                            onChange={(e) => form.setData('theme_color', e.target.value)}
                                        />
                                        <input
                                            value={form.data.theme_color}
                                            onChange={(e) => form.setData('theme_color', e.target.value)}
                                            placeholder="#087f74"
                                            maxLength={7}
                                        />
                                    </div>
                                    {form.errors.theme_color && <small className="field-error">{form.errors.theme_color}</small>}
                                </label>
                            </div>

                            <div className="settings-asset-list">
                                <AssetControl
                                    id="settings-logo-upload"
                                    label="Logo"
                                    previewUrl={logoPreviewUrl}
                                    icon="image"
                                    fileName={logoName}
                                    error={form.errors.logo}
                                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                    canRemove={!!settings.logo_url && !form.data.remove_logo}
                                    onUpload={(file) => form.setData({ ...form.data, logo: file, remove_logo: false })}
                                    onRemove={() => form.setData({ ...form.data, logo: null, remove_logo: true })}
                                    t={t}
                                />
                                <AssetControl
                                    id="settings-favicon-upload"
                                    label="Favicon"
                                    previewUrl={faviconPreviewUrl}
                                    icon="settings"
                                    fileName={faviconName}
                                    error={form.errors.favicon}
                                    accept="image/x-icon,image/jpeg,image/png,image/webp,image/svg+xml"
                                    canRemove={!!settings.favicon_url && !form.data.remove_favicon}
                                    onUpload={(file) => form.setData({ ...form.data, favicon: file, remove_favicon: false })}
                                    onRemove={() => form.setData({ ...form.data, favicon: null, remove_favicon: true })}
                                    t={t}
                                />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="panel glass">
                    <PanelHeading eyebrow={t('Contacts')} title={t('Public contact channels')} />
                    <div className="crud-grid">
                        {Object.keys(contactMeta).map((type) => (
                            <ContactRows
                                key={type}
                                type={type}
                                values={form.data.contacts[type] || ['']}
                                errors={contactErrors}
                                onChange={(index, value) => setContact(type, index, value)}
                                onAdd={() => addContact(type)}
                                onRemove={(index) => removeContact(type, index)}
                                t={t}
                            />
                        ))}
                    </div>
                </section>

                <div className="stack-row" style={{ justifyContent: 'flex-end' }}>
                    <button type="submit" className="btn primary" disabled={form.processing}>
                        <Icon name="check" size={14} />
                        {form.processing ? t('Saving...') : t('Save settings')}
                    </button>
                </div>
            </form>
        </AdminLayout>
    );
}
