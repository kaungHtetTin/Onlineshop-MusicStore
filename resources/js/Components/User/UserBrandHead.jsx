import React from 'react';
import { Head, usePage } from '@inertiajs/react';
import PwaHeadTags from '@/Components/User/PwaHeadTags';

export default function UserBrandHead({ title }) {
    const { app_settings } = usePage().props;
    const appName = app_settings?.app_name || 'Harmony House';
    const pageTitle = title ? `${title} | ${appName}` : appName;

    return (
        <Head title={pageTitle}>
            <PwaHeadTags />
        </Head>
    );
}
