import React from 'react';
import { Link, usePage } from '@inertiajs/react';
import {
    Box,
    Container,
    Divider,
    Stack,
    Typography,
} from '@mui/material';
import {
    EmailOutlined,
    Facebook,
    MusicNote,
    PhoneOutlined,
} from '@mui/icons-material';
import { routeWithBase } from '@/Utils/url';

const asArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

const socialHref = (value, platform) => {
    if (!value) return '#';
    if (/^https?:\/\//i.test(value)) return value;

    const clean = value.replace(/^@/, '').replace(/^\/+/, '');

    if (platform === 'facebook') {
        return `https://facebook.com/${clean}`;
    }

    return `https://tiktok.com/@${clean}`;
};

function ContactList({ title, items, icon, hrefFor }) {
    if (items.length === 0) return null;

    return (
        <Box>
            <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block' }}>
                {title}
            </Typography>
            <Stack spacing={0.75}>
                {items.map((item) => (
                    <Typography
                        key={`${title}-${item}`}
                        component="a"
                        href={hrefFor(item)}
                        target={hrefFor(item).startsWith('http') ? '_blank' : undefined}
                        rel={hrefFor(item).startsWith('http') ? 'noopener noreferrer' : undefined}
                        variant="caption"
                        sx={{
                            color: 'inherit',
                            textDecoration: 'none',
                            opacity: 0.86,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 0.75,
                            wordBreak: 'break-word',
                            '&:hover': { opacity: 1, textDecoration: 'underline' },
                        }}
                    >
                        {icon}
                        {item}
                    </Typography>
                ))}
            </Stack>
        </Box>
    );
}

export default function Footer() {
    const { app_base, app_settings } = usePage().props;
    const appName = app_settings?.app_name || 'LaLaPick';
    const contacts = app_settings?.contacts || {};
    const emails = asArray(contacts.email);
    const phones = asArray(contacts.phone);
    const facebook = asArray(contacts.facebook);
    const tiktok = asArray(contacts.tiktok);
    const hasContacts = emails.length || phones.length || facebook.length || tiktok.length;

    return (
        <Box component="footer" sx={{ bgcolor: 'primary.main', color: 'white', py: { xs: 3, md: 4 }, mt: 4 }}>
            <Container maxWidth="lg">
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', sm: '1.1fr 0.9fr', md: hasContacts ? '1.1fr 0.8fr 1.4fr' : '1.2fr 1fr' },
                        gap: { xs: 2.5, md: 4 },
                    }}
                >
                    <Box>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                            {app_settings?.logo_url && (
                                <Box
                                    component="img"
                                    src={app_settings.logo_url}
                                    alt=""
                                    sx={{
                                        width: 32,
                                        height: 32,
                                        objectFit: 'contain',
                                        borderRadius: 1,
                                        bgcolor: 'white',
                                    }}
                                />
                            )}
                            <Typography variant="subtitle2" sx={{ fontWeight: 900 }}>
                                {appName}
                            </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ opacity: 0.82, display: 'block', maxWidth: 280 }}>
                            Your daily aesthetic boutique.
                        </Typography>
                    </Box>

                    <Box>
                        <Typography variant="caption" sx={{ fontWeight: 800, mb: 1, display: 'block' }}>
                            Shop
                        </Typography>
                        <Stack spacing={0.75}>
                            <Typography
                                component={Link}
                                href={routeWithBase('/products?sort=newest', app_base)}
                                variant="caption"
                                sx={{ opacity: 0.86, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 1, textDecoration: 'underline' } }}
                            >
                                New arrivals
                            </Typography>
                            <Typography
                                component={Link}
                                href={routeWithBase('/products?sort=best_selling', app_base)}
                                variant="caption"
                                sx={{ opacity: 0.86, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 1, textDecoration: 'underline' } }}
                            >
                                Best sellers
                            </Typography>
                            <Typography
                                component={Link}
                                href={routeWithBase('/blogs', app_base)}
                                variant="caption"
                                sx={{ opacity: 0.86, color: 'inherit', textDecoration: 'none', '&:hover': { opacity: 1, textDecoration: 'underline' } }}
                            >
                                Blog
                            </Typography>
                        </Stack>
                    </Box>

                    {hasContacts && (
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                gap: 2,
                            }}
                        >
                            <ContactList
                                title="Email"
                                items={emails}
                                icon={<EmailOutlined sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => `mailto:${item}`}
                            />
                            <ContactList
                                title="Phone"
                                items={phones}
                                icon={<PhoneOutlined sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => `tel:${item.replace(/\s+/g, '')}`}
                            />
                            <ContactList
                                title="Facebook"
                                items={facebook}
                                icon={<Facebook sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => socialHref(item, 'facebook')}
                            />
                            <ContactList
                                title="TikTok"
                                items={tiktok}
                                icon={<MusicNote sx={{ fontSize: 14 }} />}
                                hrefFor={(item) => socialHref(item, 'tiktok')}
                            />
                        </Box>
                    )}
                </Box>

                <Divider sx={{ my: 3, bgcolor: 'rgba(255,255,255,0.14)' }} />
                <Typography variant="caption" sx={{ textAlign: 'center', display: 'block', opacity: 0.64 }}>
                    Copyright {new Date().getFullYear()} {appName}.
                </Typography>
            </Container>
        </Box>
    );
}
