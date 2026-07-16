import './bootstrap';
import '../css/app.css';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@mui/material/styles';
import { createUserTheme } from './Theme/UserTheme';
import { SpaApp, router } from './spa/router';
import { AdminPersistentShell } from './Layouts/AdminLayout';

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

const pages = import.meta.glob('./Pages/**/*.jsx');
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

const resolvePage = async (name) => {
    const loader = pages[`./Pages/${name}.jsx`];

    if (!loader) {
        throw new Error(`SPA page component not found: ${name}`);
    }

    return loader();
};

const usesPersistentAdminShell = (component) => {
    if (component === 'Profile/Edit') {
        return true;
    }

    if (!String(component || '').startsWith('Admin/')) {
        return false;
    }

    return component !== 'Admin/POS/Index';
};

if (el && window.__SPA_PAGE__) {
    const initialPage = window.__SPA_PAGE__;
    const base = initialPage.props.app_base || '';
    const cleanBase = base && base !== '/' ? `/${String(base).replace(/^\/+|\/+$/g, '')}` : '';
    const pathInApp = stripBasePath(window.location.pathname, cleanBase);
    const csrfRefreshPath = pathInApp === '/admin' || pathInApp.startsWith('/admin/')
        ? `${cleanBase}/admin/csrf-token`
        : `${cleanBase}/csrf-token`;

    normalizeCurrentBrowserUrl(base);
    window.setCsrfRefreshUrl?.(csrfRefreshPath);
    registerUserServiceWorker(base);
    window.configureRealtime?.(base);
    router.on('navigate', () => normalizeCurrentBrowserUrl(base));

    createRoot(el).render(
        <QueryClientProvider client={queryClient}>
            <SpaApp
                initialPage={initialPage}
                resolve={resolvePage}
                render={({ Component, page }) => (
                    <ThemeProvider theme={createUserTheme(page.props.app_settings || {})}>
                        <AdminPersistentShell active={usesPersistentAdminShell(page.component)}>
                            {Component ? <Component {...page.props} /> : null}
                        </AdminPersistentShell>
                    </ThemeProvider>
                )}
            />
        </QueryClientProvider>,
    );
}
