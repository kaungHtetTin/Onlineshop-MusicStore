/**
 * Prepend the application base path to a given URL.
 * 
 * @param {string} path 
 * @param {string} base 
 * @returns {string}
 */
/**
 * Build `/api/...` URL respecting an app subdirectory base (e.g. `/larlarpick/public`).
 *
 * @param {string} path
 * @param {string} base
 * @returns {string}
 */
export const apiUrl = (path, base = '') => {
    if (!path) {
        return `${(base || '').replace(/\/+$/, '')}/api`;
    }
    if (path.startsWith('http') || path.startsWith('//')) return path;

    const cleanBase = (base || '').replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanBase}/api${cleanPath}`;
};

export const routeWithBase = (path, base = '') => {
    if (!path) return base || '/';
    if (path.startsWith('http') || path.startsWith('//')) return path;
    
    const cleanBase = base.replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    return `${cleanBase}${cleanPath}`;
};

/**
 * Get the full URL for a storage file using APP_URL from .env
 * 
 * @param {string} path 
 * @param {string} appUrl 
 * @returns {string}
 */
export const storageUrl = (path, appUrl = '') => {
    if (!path) return '';
    if (path.startsWith('http') || path.startsWith('//') || path.startsWith('blob:')) return path;
    
    const cleanAppUrl = (appUrl || '').replace(/\/+$/, '');
    const cleanPath = path.replace(/^\/+/, '');
    
    // If path doesn't start with storage/ and it's a relative path from storage
    const storagePath = cleanPath.startsWith('storage/') ? cleanPath : `storage/${cleanPath}`;
    
    return `${cleanAppUrl}/${storagePath}`;
};
