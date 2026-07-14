import React, { useState } from 'react';
import { Link, useForm, usePage } from '@inertiajs/react';
import {
    Avatar,
    Box,
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Typography,
} from '@mui/material';
import {
    ChatBubbleOutlined,
    FavoriteBorder,
    KeyboardArrowDown,
    Login,
    Logout,
    Person,
    PersonAdd,
    ReceiptLong,
    Settings,
    ShoppingBag,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { routeWithBase, storageUrl } from '@/Utils/url';
import { useWishlistStore } from '@/stores/wishlistStore';

const menuPaperSx = {
    mt: 1,
    minWidth: { xs: 260, sm: 280 },
    maxWidth: 320,
    borderRadius: 2,
    overflow: 'visible',
    border: '1px solid',
    borderColor: alpha('#E91E63', 0.12),
    boxShadow: '0 12px 40px rgba(233, 30, 99, 0.14), 0 4px 12px rgba(0,0,0,0.06)',
    '&::before': {
        content: '""',
        display: 'block',
        position: 'absolute',
        top: 0,
        right: 20,
        width: 12,
        height: 12,
        bgcolor: 'background.paper',
        transform: 'translateY(-50%) rotate(45deg)',
        zIndex: 0,
        borderLeft: '1px solid',
        borderTop: '1px solid',
        borderColor: alpha('#E91E63', 0.12),
    },
};

const menuItemSx = {
    py: 1.25,
    px: 2,
    mx: 1,
    my: 0.25,
    borderRadius: 1,
    fontSize: '0.875rem',
    fontWeight: 600,
    '&:hover': {
        bgcolor: alpha('#E91E63', 0.08),
    },
};

const iconSx = { minWidth: 36, color: 'primary.main' };

function MenuLinkItem({ href, icon, label, secondary, badge, onClose }) {
    return (
        <MenuItem
            component={Link}
            href={href}
            onClick={onClose}
            sx={menuItemSx}
        >
            <ListItemIcon sx={iconSx}>{icon}</ListItemIcon>
            <ListItemText
                primary={label}
                secondary={secondary}
                primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
                secondaryTypographyProps={{ fontSize: '0.7rem' }}
            />
            {badge != null && badge > 0 && (
                <Box
                    component="span"
                    sx={{
                        ml: 1,
                        px: 0.75,
                        py: 0.15,
                        borderRadius: 1,
                        bgcolor: 'secondary.main',
                        color: 'secondary.contrastText',
                        fontSize: '0.65rem',
                        fontWeight: 800,
                        lineHeight: 1.4,
                    }}
                >
                    {badge > 99 ? '99+' : badge}
                </Box>
            )}
        </MenuItem>
    );
}

export default function ProfileMenu() {
    const { app_base, app_url, auth, chat_unread_count, app_settings } = usePage().props;
    const appName = app_settings?.app_name || 'LaLaPick';
    const wishCount = useWishlistStore((s) => s.count());
    const [anchorEl, setAnchorEl] = useState(null);
    const logoutForm = useForm({});
    const open = Boolean(anchorEl);
    const user = auth?.user;

    const handleOpen = (e) => setAnchorEl(e.currentTarget);
    const handleClose = () => setAnchorEl(null);

    const handleLogout = () => {
        handleClose();
        logoutForm.post(routeWithBase('/logout', app_base));
    };

    return (
        <>
            <IconButton
                size="small"
                color="primary"
                onClick={handleOpen}
                aria-label={user ? 'Account menu' : 'Sign in menu'}
                aria-controls={open ? 'profile-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                sx={{
                    p: user?.avatar ? '2px' : undefined,
                    borderRadius: 2,
                    border: open ? `1px solid ${alpha('#E91E63', 0.35)}` : '1px solid transparent',
                    bgcolor: open ? alpha('#E91E63', 0.06) : 'transparent',
                    transition: 'border-color 0.2s, background-color 0.2s',
                    '&:hover': { bgcolor: alpha('#E91E63', 0.08) },
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                    {user?.avatar ? (
                        <Avatar
                            alt={user.name || ''}
                            src={storageUrl(user.avatar, app_url)}
                            sx={{
                                width: 30,
                                height: 30,
                                border: '1px solid rgba(233, 30, 99, 0.25)',
                            }}
                        />
                    ) : (
                        <Person sx={{ fontSize: '1.35rem' }} />
                    )}
                    <KeyboardArrowDown
                        sx={{
                            fontSize: '1rem',
                            opacity: 0.7,
                            display: { xs: 'none', sm: 'block' },
                            transform: open ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                        }}
                    />
                </Box>
            </IconButton>

            <Menu
                id="profile-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: { sx: menuPaperSx },
                    list: { sx: { py: 1, position: 'relative', zIndex: 1 } },
                }}
            >
                {user ? (
                    <>
                        <Box
                            sx={{
                                px: 2,
                                pt: 1.5,
                                pb: 1.75,
                                mx: 1,
                                mb: 0.5,
                                borderRadius: 1.5,
                                background: `linear-gradient(135deg, ${alpha('#E91E63', 0.1)} 0%, ${alpha('#FF8DA1', 0.14)} 100%)`,
                            }}
                        >
                            <StackRow user={user} app_url={app_url} />
                        </Box>
                        <Divider sx={{ mx: 2, mb: 0.5, opacity: 0.6 }} />
                        <MenuLinkItem
                            href={routeWithBase('/profile', app_base)}
                            icon={<Settings fontSize="small" />}
                            label="Profile settings"
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/orders', app_base)}
                            icon={<ReceiptLong fontSize="small" />}
                            label="My orders"
                            secondary="Track payments & delivery"
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/wishlist', app_base)}
                            icon={<FavoriteBorder fontSize="small" />}
                            label="Wishlist"
                            badge={wishCount}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/chat', app_base)}
                            icon={<ChatBubbleOutlined fontSize="small" />}
                            label="Support chat"
                            badge={chat_unread_count}
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/products', app_base)}
                            icon={<ShoppingBag fontSize="small" />}
                            label="Continue shopping"
                            onClose={handleClose}
                        />
                        <Divider sx={{ mx: 2, my: 0.75, opacity: 0.6 }} />
                        <MenuItem onClick={handleLogout} sx={{ ...menuItemSx, color: 'error.main' }} disabled={logoutForm.processing}>
                            <ListItemIcon sx={{ ...iconSx, color: 'error.main' }}>
                                <Logout fontSize="small" />
                            </ListItemIcon>
                            <ListItemText
                                primary={logoutForm.processing ? 'Signing out…' : 'Log out'}
                                primaryTypographyProps={{ fontWeight: 700, fontSize: '0.875rem' }}
                            />
                        </MenuItem>
                    </>
                ) : (
                    <>
                        <Box sx={{ px: 2.5, pt: 1.5, pb: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                                Welcome to {appName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                Sign in to save orders, chat with support, and manage your profile.
                            </Typography>
                        </Box>
                        <Divider sx={{ mx: 2, mb: 0.5, opacity: 0.6 }} />
                        <MenuLinkItem
                            href={routeWithBase('/login', app_base)}
                            icon={<Login fontSize="small" />}
                            label="Sign in"
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/register', app_base)}
                            icon={<PersonAdd fontSize="small" />}
                            label="Create account"
                            onClose={handleClose}
                        />
                        <MenuLinkItem
                            href={routeWithBase('/products', app_base)}
                            icon={<ShoppingBag fontSize="small" />}
                            label="Browse shop"
                            onClose={handleClose}
                        />
                    </>
                )}
            </Menu>
        </>
    );
}

function StackRow({ user, app_url }) {
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
            <Avatar
                alt={user.name || ''}
                src={user.avatar ? storageUrl(user.avatar, app_url) : undefined}
                sx={{
                    width: 44,
                    height: 44,
                    bgcolor: 'primary.main',
                    fontWeight: 800,
                    fontSize: '1rem',
                    border: '2px solid rgba(255,255,255,0.9)',
                    boxShadow: '0 2px 8px rgba(233, 30, 99, 0.2)',
                }}
            >
                {!user.avatar && (user.name?.charAt(0)?.toUpperCase() || '?')}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                    {user.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                    {user.email}
                </Typography>
            </Box>
        </Box>
    );
}
