import React from 'react';
import { Head, usePage } from '@inertiajs/react';

export default function UserBrandHead({ title }) {
    const { app_base, app_settings } = usePage().props;
    const appName = app_settings?.app_name || 'LaLaPick';
    const pageTitle = title ? `${title} | ${appName}` : appName;
    const manifestUrl = `${app_base || ''}/manifest.webmanifest`;

    return (
        <Head title={pageTitle}>
            <link rel="manifest" href={manifestUrl} />
            {app_settings?.favicon_url && <link rel="icon" href={app_settings.favicon_url} />}
            {app_settings?.favicon_url && <link rel="apple-touch-icon" href={app_settings.favicon_url} />}
            {app_settings?.theme_color && <meta name="theme-color" content={app_settings.theme_color} />}
            <meta name="mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-capable" content="yes" />
            <meta name="apple-mobile-web-app-title" content={appName} />
            <meta name="application-name" content={appName} />
        </Head>
    );
}
