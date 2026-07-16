import './bootstrap';
import '../css/app.css';
import { createRoot } from 'react-dom/client';
import { createInertiaApp, router } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ThemeProvider } from '@mui/material/styles';
import { createUserTheme } from './Theme/UserTheme';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 15_000,
            gcTime: 30 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
        mutations: {
            retry: 0,
        },
    },
});

const el = document.getElementById('app');

const normalizeDuplicatedBasePath = (pathname, base) => {
    if (!pathname || !base || base === '/') {
        return pathname;
    }

    const cleanBase = `/${String(base).replace(/^\/+|\/+$/g, '')}`;
    if (cleanBase === '/') {
        return pathname;
    }

    const doubled = `${cleanBase}${cleanBase}`;
    let nextPath = pathname;

    while (nextPath === doubled || nextPath.startsWith(`${doubled}/`)) {
        nextPath = nextPath.substring(cleanBase.length);
    }

    return nextPath;
};

const normalizeDuplicatedBase = (url, base) => {
    if (!url) return url;

    const isAbsolute = /^https?:\/\//i.test(url);

    try {
        const parsed = new URL(url, window.location.origin);
        parsed.pathname = normalizeDuplicatedBasePath(parsed.pathname, base);
        return isAbsolute
            ? `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
            : `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
        return url;
    }
};

const stripBasePath = (pathname, base) => {
    if (!pathname || !base || base === '/') {
        return pathname || '/';
    }

    const cleanBase = `/${String(base).replace(/^\/+|\/+$/g, '')}`;
    if (pathname === cleanBase) {
        return '/';
    }

    return pathname.startsWith(`${cleanBase}/`) ? pathname.substring(cleanBase.length) : pathname;
};

const normalizeCurrentBrowserUrl = (base) => {
    const correctedPath = normalizeDuplicatedBasePath(window.location.pathname, base);
    if (correctedPath !== window.location.pathname) {
        window.history.replaceState(null, '', `${correctedPath}${window.location.search}${window.location.hash}`);
    }
};

const coerceNavigationUrl = (url, base) => {
    if (url === undefined || url === null || url === '') return url;
    const raw = String(url);
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    const normalizedInput = hasScheme || raw.startsWith('/') ? raw : `/${raw.replace(/^\/+/, '')}`;
    return normalizeDuplicatedBase(normalizedInput, base);
};

const buildGetUrl = (rawUrl, data = {}) => {
    const parsed = new URL(rawUrl, window.location.origin);
    const params = new URLSearchParams(parsed.search);

    Object.entries(data || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
            params.delete(key);
        } else {
            params.set(key, String(value));
        }
    });

    parsed.search = params.toString() ? `?${params.toString()}` : '';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

const registerUserServiceWorker = (base = '') => {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    const cleanBase = base && base !== '/' ? `/${String(base).replace(/^\/+|\/+$/g, '')}` : '';
    const currentPath = normalizeDuplicatedBasePath(window.location.pathname, cleanBase);
    const pathInApp = stripBasePath(currentPath, cleanBase);

    if (pathInApp === '/admin' || pathInApp.startsWith('/admin/')) {
        return;
    }

    const workerUrl = `${cleanBase}/sw.js`;
    const scope = `${cleanBase || ''}/`;
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });

    window.addEventListener('load', () => {
        navigator.serviceWorker.register(workerUrl, { scope }).then((registration) => {
            if (registration.waiting) {
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }

            registration.addEventListener('updatefound', () => {
                const worker = registration.installing;
                if (!worker) return;

                worker.addEventListener('statechange', () => {
                    if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                        worker.postMessage({ type: 'SKIP_WAITING' });
                    }
                });
            });

            window.setInterval(() => registration.update(), 60 * 60 * 1000);
        }).catch(() => {});
    });
};

if (el && el.dataset.page) {
    const initialPage = JSON.parse(el.dataset.page);

    createInertiaApp({
        page: initialPage,
        resolve: (name) => resolvePageComponent(`./Pages/${name}.jsx`, import.meta.glob('./Pages/**/*.jsx')),
        setup({ el, App, props }) {
            const base = props.initialPage.props.app_base || '';
            const userTheme = createUserTheme(props.initialPage.props.app_settings || {});
            props.initialPage.url = normalizeDuplicatedBase(props.initialPage.url, base);
            normalizeCurrentBrowserUrl(base);
            const cleanBase = base && base !== '/' ? `/${String(base).replace(/^\/+|\/+$/g, '')}` : '';
            const pathInApp = stripBasePath(window.location.pathname, cleanBase);
            const csrfRefreshPath = pathInApp === '/admin' || pathInApp.startsWith('/admin/')
                ? `${cleanBase}/admin/csrf-token`
                : `${cleanBase}/csrf-token`;
            window.setCsrfRefreshUrl?.(csrfRefreshPath);
            registerUserServiceWorker(base);
            window.configureRealtime?.(base);

            if (!window.__forceBrowserGetNavigation && typeof router.visit === 'function') {
                const originalVisit = router.visit.bind(router);
                window.__forceBrowserGetNavigation = true;

                router.visit = (url, options = {}) => {
                    const method = String(options?.method || 'get').toLowerCase();
                    const rawUrl = typeof url === 'string' ? url : (url?.url || String(url));
                    const withQuery = method === 'get' ? buildGetUrl(rawUrl, options?.data || {}) : rawUrl;
                    const target = coerceNavigationUrl(withQuery, base);

                    if (method === 'get') {
                        window.location.assign(target);
                        return;
                    }

                    return originalVisit(target, options);
                };
            }

            if (!window.__historyUrlGuardBound) {
                const originalPushState = window.history.pushState.bind(window.history);
                const originalReplaceState = window.history.replaceState.bind(window.history);

                window.history.pushState = (state, title, url) => originalPushState(state, title, coerceNavigationUrl(url, base));
                window.history.replaceState = (state, title, url) => originalReplaceState(state, title, coerceNavigationUrl(url, base));
                window.__historyUrlGuardBound = true;
            }

            if (!window.__inertiaUrlGuardBound) {
                window.__inertiaUrlGuardBound = true;
                router.on('navigate', () => normalizeCurrentBrowserUrl(base));
            }

            createRoot(el).render(
                <QueryClientProvider client={queryClient}>
                    <ThemeProvider theme={userTheme}>
                        <App {...props} />
                    </ThemeProvider>
                </QueryClientProvider>
            );
        },
        progress: {
            color: initialPage.props?.app_settings?.theme_color || '#4B5563',
        },
    });
}
