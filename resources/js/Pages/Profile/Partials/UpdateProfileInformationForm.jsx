import { Link, useForm, usePage } from '@/spa/router';
import { Transition } from '@headlessui/react';
import {
    Alert,
    Avatar,
    Box,
    Button,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import { routeWithBase } from '@/Utils/url';
import { storageUrl } from '@/Utils/url';
import { useEffect, useState } from 'react';
import CropImageModal from '@/Components/Admin/CropImageModal';
import { usePhraseTranslation } from '@/Utils/i18n';

export default function UpdateProfileInformation({ mustVerifyEmail, status, className }) {
    const { url, props } = usePage();
    const t = usePhraseTranslation();
    const { auth, admin_app_url, app_base, app_url } = props;
    const user = auth?.user;
    const isAdminContext = typeof url === 'string' && url.includes('/admin');
    const profileEndpoint = isAdminContext ? `${admin_app_url}/profile` : routeWithBase('/profile', app_base);
    const avatarSrc = user?.avatar ? storageUrl(user.avatar, app_url) : undefined;

    const { data, setData, patch, post, transform, errors, processing, recentlySuccessful } = useForm({
        name: user?.name ?? '',
        email: user?.email ?? '',
        phone: user?.phone ?? '',
        default_address: user?.default_address ?? '',
        avatar: null,
    });
    const [croppingImage, setCroppingImage] = useState(null);
    const [avatarPreview, setAvatarPreview] = useState(avatarSrc);

    const submit = (e) => {
        e.preventDefault();
        if (data.avatar instanceof File) {
            // Multipart + PATCH can drop fields in some PHP setups; use POST method spoof.
            transform((form) => ({
                ...form,
                _method: 'patch',
            }));
            post(profileEndpoint, {
                preserveScroll: true,
                forceFormData: true,
                onFinish: () => transform((form) => form),
            });
            return;
        }

        patch(profileEndpoint, {
            preserveScroll: true,
        });
    };

    useEffect(() => {
        if (!(data.avatar instanceof File)) {
            setAvatarPreview(avatarSrc);
            return undefined;
        }
        const url = URL.createObjectURL(data.avatar);
        setAvatarPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [data.avatar, avatarSrc]);

    const openCropper = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => setCroppingImage(reader.result);
        reader.readAsDataURL(file);
    };

    const handleCropComplete = (croppedBlob) => {
        const ext = (data.avatar?.type || 'image/jpeg').includes('png') ? 'png' : 'jpg';
        const cropped = new File([croppedBlob], `avatar-crop.${Date.now()}.${ext}`, {
            type: croppedBlob.type || 'image/jpeg',
        });
        setData('avatar', cropped);
        setCroppingImage(null);
    };

    if (!user) {
        return (
            <Box component="section" className={className}>
                <Alert severity="warning" variant="outlined">
                    {t('Please sign in again to manage your profile.')}
                </Alert>
            </Box>
        );
    }

    return (
        <Box component="section" className={className}>
            <Stack spacing={0.5}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    {t('Profile Information')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                    {t("Update your account's profile information and email address.")}
                </Typography>
            </Stack>

            <Box component="form" onSubmit={submit} sx={{ mt: 3 }}>
                <Stack spacing={2}>
                    {!isAdminContext && (
                        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                            <Avatar src={avatarPreview} sx={{ width: 88, height: 88, borderRadius: 2 }}>
                                {user.name?.charAt(0)}
                            </Avatar>
                            <Box>
                                <Button variant="outlined" component="label" size="small" startIcon={<PhotoCamera />}>
                                    {t('Change photo')}
                                    <input
                                        type="file"
                                        name="avatar"
                                        accept="image/jpeg,image/png,image/webp,image/gif"
                                        hidden
                                        onChange={(e) => {
                                            const f = e.target.files?.[0];
                                            if (f) {
                                                setData('avatar', f);
                                                openCropper(f);
                                            } else {
                                                setData('avatar', null);
                                            }
                                            e.target.value = '';
                                        }}
                                    />
                                </Button>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                                    {t('JPG, PNG, WebP or GIF - max 4MB')}
                                </Typography>
                                {errors.avatar && (
                                    <Typography variant="caption" color="error" display="block">
                                        {errors.avatar}
                                    </Typography>
                                )}
                                {data.avatar instanceof File && (
                                    <Typography variant="caption" color="primary" display="block" sx={{ mt: 0.5 }}>
                                        {t('Selected')}: {data.avatar.name}
                                    </Typography>
                                )}
                            </Box>
                        </Stack>
                    )}

                    <TextField
                        id="name"
                        label={t('Name')}
                        fullWidth
                        required
                        autoComplete="name"
                        autoFocus={isAdminContext}
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        error={Boolean(errors.name)}
                        helperText={errors.name}
                    />

                    <TextField
                        id="email"
                        type="email"
                        label={t('Email')}
                        fullWidth
                        required
                        autoComplete="username"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        error={Boolean(errors.email)}
                        helperText={errors.email}
                    />

                    {!isAdminContext && (
                        <>
                            <TextField
                                id="phone"
                                label={t('Phone number')}
                                fullWidth
                                autoComplete="tel"
                                value={data.phone}
                                onChange={(e) => setData('phone', e.target.value)}
                                error={Boolean(errors.phone)}
                                helperText={errors.phone || t('Used for shipping and order updates.')}
                            />
                            <TextField
                                id="default_address"
                                label={t('Default shipping address')}
                                fullWidth
                                multiline
                                minRows={3}
                                value={data.default_address}
                                onChange={(e) => setData('default_address', e.target.value)}
                                error={Boolean(errors.default_address)}
                                helperText={errors.default_address || t('Prefills checkout. You can still edit each order.')}
                            />
                        </>
                    )}

                    {mustVerifyEmail && user.email_verified_at === null && (
                        <Stack spacing={1}>
                            <Alert severity="warning" variant="outlined">
                                {t('Your email address is unverified.')}
                            </Alert>
                            <Typography variant="body2">
                                <Link
                                    href={routeWithBase('/email/verification-notification', app_base)}
                                    method="post"
                                    as="button"
                                    className="text-sm text-primary-600 underline"
                                >
                                    {t('Re-send verification email')}
                                </Link>
                            </Typography>
                            {status === 'verification-link-sent' && (
                                <Alert severity="success" variant="outlined">
                                    {t('A new verification link has been sent to your email address.')}
                                </Alert>
                            )}
                        </Stack>
                    )}

                    <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                        <Button type="submit" variant="contained" disabled={processing}>
                            {t('Save')}
                        </Button>
                        <Transition
                            show={recentlySuccessful}
                            enterFrom="opacity-0"
                            leaveTo="opacity-0"
                            className="transition ease-in-out"
                        >
                            <Typography variant="body2" color="text.secondary">
                                {t('Saved.')}
                            </Typography>
                        </Transition>
                    </Stack>
                </Stack>
            </Box>
            <CropImageModal
                open={!!croppingImage}
                image={croppingImage}
                onCropComplete={handleCropComplete}
                onCancel={() => setCroppingImage(null)}
                aspect={1}
            />
        </Box>
    );
}
