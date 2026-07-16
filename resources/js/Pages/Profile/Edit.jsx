import AdminLayout from '@/Layouts/AdminLayout';
import DeleteUserForm from './Partials/DeleteUserForm';
import LogoutForm from './Partials/LogoutForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head, Link, usePage } from '@/spa/router';
import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import Navbar from '@/Components/User/Navbar';
import MobileBottomNav, { MOBILE_BOTTOM_NAV_HEIGHT } from '@/Components/User/MobileBottomNav';
import { routeWithBase } from '@/Utils/url';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function Edit({ auth, mustVerifyEmail, status }) {
    const { url, props } = usePage();
    const { app_base } = props;
    const t = usePhraseTranslation();
    const isAdminContext = typeof url === 'string' && url.includes('/admin');

    const inner = (
        <>
            <Head title={t('Profile')} />
            {isAdminContext ? (
                <div className="stack-sm">
                    <section className="panel glass">
                        <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} className="max-w-xl" />
                    </section>
                    <section className="panel glass">
                        <UpdatePasswordForm className="max-w-xl" />
                    </section>
                    <section className="panel glass">
                        <DeleteUserForm className="max-w-xl" />
                    </section>
                </div>
            ) : (
                <Stack spacing={2}>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <UpdateProfileInformationForm mustVerifyEmail={mustVerifyEmail} status={status} className="max-w-xl" />
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <UpdatePasswordForm className="max-w-xl" />
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <LogoutForm />
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
                        <DeleteUserForm className="max-w-xl" />
                    </Paper>
                </Stack>
            )}
        </>
    );

    if (isAdminContext) {
        return (
            <AdminLayout title={t('Profile settings')} eyebrow={t('Account')}>
                {inner}
            </AdminLayout>
        );
    }

    return (
        <Box
            sx={{
                bgcolor: 'background.default',
                minHeight: '100dvh',
                pb: {
                    xs: `calc(${MOBILE_BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom, 0px) + 12px)`,
                    md: 4,
                },
            }}
        >
            <Navbar />
            <Container maxWidth="md" sx={{ mt: { xs: 2, md: 3 }, px: { xs: 2, sm: 3 } }}>
                <Stack direction="row" alignItems="center" gap={1} sx={{ mb: 2, width: '100%' }} flexWrap="wrap">
                    <Typography variant="h5" sx={{ fontWeight: 800, flexShrink: 0 }}>
                        {t('My account')}
                    </Typography>
                    <Button
                        component={Link}
                        href={routeWithBase('/orders', app_base)}
                        variant="outlined"
                        size="small"
                        sx={{ fontWeight: 700, ml: 'auto' }}
                    >
                        {t('My orders')}
                    </Button>
                </Stack>
                {inner}
            </Container>
            <MobileBottomNav />
        </Box>
    );
}
