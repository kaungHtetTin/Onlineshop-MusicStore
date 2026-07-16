import { useEffect, useRef, useState } from 'react';
import Icon from '@/Components/Admin/icons';

const STATUS_MAP = {
    success: 'status-success',
    paid: 'status-success',
    delivered: 'status-success',
    available: 'status-success',
    healthy: 'status-success',
    warning: 'status-warning',
    pending: 'status-warning',
    pending_review: 'status-warning',
    unpaid: 'status-warning',
    danger: 'status-danger',
    error: 'status-danger',
    rejected: 'status-danger',
    cancelled: 'status-danger',
    failed: 'status-danger',
    info: 'status-info',
    processing: 'status-info',
    shipped: 'status-info',
    assigned: 'status-info',
    primary: 'status-info',
    neutral: 'status-neutral',
    default: 'status-neutral',
    offline: 'status-neutral',
    inactive: 'status-neutral',
    super_admin: 'status-info',
    manager: 'status-success',
    inventory_staff: 'status-warning',
    sales: 'status-warning',
    support: 'status-neutral',
};

export function statusClass(value) {
    const key = String(value || 'neutral').toLowerCase().replace(/\s+/g, '_');
    return STATUS_MAP[key] || 'status-neutral';
}

export function StatusBadge({ status, label }) {
    const cls = statusClass(status);
    return (
        <span className={`status ${cls}`}>
            <span className="status-dot" />
            {label || status}
        </span>
    );
}

export function PanelHeading({ eyebrow, title, action, actionLabel, onAction }) {
    return (
        <div className="panel-heading">
            <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <h2>{title}</h2>
            </div>
            {action}
            {!action && actionLabel && onAction && (
                <button className="text-btn" type="button" onClick={onAction}>
                    {actionLabel}
                </button>
            )}
        </div>
    );
}

const BRAND_PRESETS = ['#087f74', '#2874bc', '#7c3aed', '#e91e63', '#d17d19', '#168255'];

export function ThemeControl({ theme, onThemeChange, brand, onBrandChange }) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        const onDoc = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    return (
        <div className="theme-popover-wrap" ref={wrapRef}>
            <button
                type="button"
                className="icon-btn"
                aria-label="Theme settings"
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
            >
                <Icon name="palette" size={16} />
            </button>
            {open && (
                <div className="theme-popover glass">
                    <p className="eyebrow">Appearance</p>
                    <div className="segmented" style={{ marginTop: 8 }}>
                        <button
                            type="button"
                            className={theme === 'light' ? 'active' : ''}
                            onClick={() => onThemeChange('light')}
                        >
                            <Icon name="sun" size={14} /> Light
                        </button>
                        <button
                            type="button"
                            className={theme === 'dark' ? 'active' : ''}
                            onClick={() => onThemeChange('dark')}
                        >
                            <Icon name="moon" size={14} /> Dark
                        </button>
                    </div>
                    <p className="eyebrow" style={{ marginTop: 12 }}>
                        Brand color
                    </p>
                    <div className="color-swatches">
                        {BRAND_PRESETS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={brand === color ? 'active' : ''}
                                style={{ background: color }}
                                aria-label={`Brand color ${color}`}
                                onClick={() => onBrandChange(color)}
                            />
                        ))}
                    </div>
                    <label className="form-field" style={{ marginTop: 10 }}>
                        <span>Custom</span>
                        <input type="color" value={brand} onChange={(e) => onBrandChange(e.target.value)} />
                    </label>
                </div>
            )}
        </div>
    );
}

export function AdminLogo({ settings }) {
    const appName = settings?.app_name || 'LaLaPick';

    return (
        <div className="admin-logo">
            {settings?.logo_url ? (
                <img
                    src={settings.logo_url}
                    alt=""
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        objectFit: 'contain',
                        background: '#fff',
                        flexShrink: 0,
                    }}
                />
            ) : (
                <span
                    style={{
                        width: 34,
                        height: 34,
                        borderRadius: 6,
                        display: 'grid',
                        placeItems: 'center',
                        background: 'var(--color-primary)',
                        color: '#fff',
                        flexShrink: 0,
                    }}
                >
                    <Icon name="shop" size={18} />
                </span>
            )}
            <div>
                <strong>{appName}</strong>
                <small className="muted">Admin console</small>
            </div>
        </div>
    );
}
