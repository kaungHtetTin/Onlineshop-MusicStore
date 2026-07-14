import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

const normalizeEnvUrl = (value) => {
    const raw = String(value || '').trim();
    const markdownLink = raw.match(/^\[(.+?)\]\((.+?)\)$/);

    return (markdownLink ? markdownLink[2] : raw).replace(/\/+$/, '');
};

const buildBaseFromEnv = (env) => {
    const rawUrl = normalizeEnvUrl(env.ASSET_URL || env.APP_URL);

    if (!rawUrl) {
        return '/build/';
    }

    try {
        const parsed = new URL(rawUrl);
        const pathname = parsed.pathname.replace(/\/+$/, '');

        return `${parsed.origin}${pathname}/build/`;
    } catch {
        const pathname = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;

        return `${pathname}/build/`.replace(/^\/?/, '/');
    }
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');

    return {
        base: buildBaseFromEnv(env),
        plugins: [
            laravel({
                input: 'resources/js/app.jsx',
                refresh: true,
            }),
            react(),
        ],
    };
});
