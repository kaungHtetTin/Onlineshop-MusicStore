import { Head, Link, useForm, usePage } from '@inertiajs/react';
import React, { useEffect } from 'react';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Button,
    Checkbox,
    FormControlLabel,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Typography,
    Container,
    Paper,
    Divider,
} from '@mui/material';
import {
    Email as EmailIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Google as GoogleIcon,
    AdminPanelSettings,
    GraphicEq,
    Headphones,
    MusicNote,
    Piano,
} from '@mui/icons-material';
import { alpha, darken, useTheme } from '@mui/material/styles';
import { eyebrowSx, getMusicStoreColors, musicGradientForTheme } from '@/Components/User/musicStoreDesign';
import PwaHeadTags from '@/Components/User/PwaHeadTags';

export default function Login({ status, error, isAdminLogin = false, googleAuthAvailable = false }) {
    const theme = useTheme();
    const musicColors = getMusicStoreColors(theme);
    const { url, props } = usePage();
    const { app_base, app_settings } = props;
    const isAdmin = isAdminLogin || (typeof url === 'string' && url.includes('/admin/login'));
    const [showPassword, setShowPassword] = React.useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        email: '',
        password: '',
        remember: false,
    });

    useEffect(() => {
        return () => {
            reset('password');
        };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        const action = isAdmin ? routeWithBase('/admin/login', app_base) : routeWithBase('/login', app_base);
        post(action);
    };

    const appName = app_settings?.app_name || 'the music shop';
    const adminGradient = `radial-gradient(circle at 18% 20%, ${alpha(musicColors.amber, 0.28)} 0, transparent 24%), radial-gradient(circle at 82% 10%, ${alpha(musicColors.rosin, 0.34)} 0, transparent 28%), linear-gradient(135deg, ${musicColors.coal} 0%, ${darken(musicColors.rosin, 0.45)} 52%, #11100f 100%)`;

    const adminForm = (
        <Box
            sx={{
                minHeight: '100vh',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                py: { xs: 4, md: 7 },
                background: adminGradient,
                color: 'white',
            }}
        >
            <Head title="Admin Login" />

            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.12,
                    backgroundImage: 'repeating-linear-gradient(90deg, transparent 0 62px, rgba(255,255,255,0.42) 62px 63px), repeating-linear-gradient(0deg, transparent 0 34px, rgba(255,255,255,0.22) 34px 35px)',
                }}
            />
            <Piano
                sx={{
                    position: 'absolute',
                    left: { xs: -48, md: 54 },
                    bottom: { xs: -38, md: 38 },
                    fontSize: { xs: 180, md: 250 },
                    color: alpha(musicColors.amber, 0.2),
                    transform: 'rotate(-9deg)',
                }}
            />
            <GraphicEq
                sx={{
                    position: 'absolute',
                    right: { xs: -18, md: 84 },
                    top: { xs: 36, md: 74 },
                    fontSize: { xs: 96, md: 140 },
                    color: alpha('#ffffff', 0.14),
                }}
            />

            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '0.98fr 1.02fr' },
                        gap: { xs: 3, md: 5 },
                        alignItems: 'center',
                    }}
                >
                    <Box sx={{ display: { xs: 'none', md: 'block' }, maxWidth: 520 }}>
                        <Typography sx={{ ...eyebrowSx, color: musicColors.amber, mb: 1 }}>
                            Back office
                        </Typography>
                        <Typography
                            variant="h2"
                            sx={{
                                fontWeight: 950,
                                lineHeight: 0.98,
                                fontSize: { md: '4.2rem' },
                                mb: 2,
                            }}
                        >
                            Keep the store in tune.
                        </Typography>
                        <Typography sx={{ color: alpha('#fff', 0.78), fontWeight: 650, lineHeight: 1.7, maxWidth: 440 }}>
                            Manage instruments, inventory, orders, and customer requests from the staff console.
                        </Typography>
                        <Stack direction="row" spacing={1.25} sx={{ mt: 3 }} useFlexGap flexWrap="wrap">
                            {[
                                { label: 'Catalog', Icon: Piano },
                                { label: 'Inventory', Icon: GraphicEq },
                                { label: 'Orders', Icon: MusicNote },
                                { label: 'Support', Icon: Headphones },
                            ].map(({ label, Icon }) => (
                                <Stack
                                    key={label}
                                    direction="row"
                                    spacing={0.75}
                                    alignItems="center"
                                    sx={{
                                        px: 1.35,
                                        py: 0.9,
                                        borderRadius: 1.5,
                                        border: `1px solid ${alpha('#fff', 0.16)}`,
                                        bgcolor: alpha('#fff', 0.08),
                                        color: alpha('#fff', 0.9),
                                    }}
                                >
                                    <Icon sx={{ fontSize: 18, color: musicColors.amber }} />
                                    <Typography variant="caption" sx={{ fontWeight: 850 }}>
                                        {label}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Box>

                    <Paper
                        elevation={0}
                        sx={{
                            justifySelf: { xs: 'stretch', md: 'end' },
                            width: '100%',
                            maxWidth: 430,
                            p: { xs: 3, sm: 4 },
                            borderRadius: 2,
                            bgcolor: 'rgba(255, 253, 248, 0.94)',
                            color: musicColors.ink,
                            border: `1px solid ${alpha(musicColors.amber, 0.32)}`,
                            boxShadow: '0 28px 90px rgba(0,0,0,0.34)',
                            backdropFilter: 'blur(18px)',
                        }}
                    >
                        <Stack alignItems="center" spacing={1.25} sx={{ textAlign: 'center', mb: 3 }}>
                            <Box
                                sx={{
                                    width: 58,
                                    height: 58,
                                    borderRadius: 2,
                                    display: 'grid',
                                    placeItems: 'center',
                                    color: musicColors.rosin,
                                    bgcolor: alpha(musicColors.rosin, 0.1),
                                    border: `1px solid ${alpha(musicColors.rosin, 0.18)}`,
                                }}
                            >
                                <AdminPanelSettings sx={{ fontSize: 32 }} />
                            </Box>
                            <Box>
                                <Typography variant="h4" sx={{ fontWeight: 950, color: musicColors.ink, lineHeight: 1.05 }}>
                                    Staff Login
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, fontWeight: 650 }}>
                                    Sign in to manage {appName}.
                                </Typography>
                            </Box>
                        </Stack>

                        {status && (
                            <Typography color="success.main" sx={{ mb: 2.5, fontWeight: 700, textAlign: 'center' }}>
                                {status}
                            </Typography>
                        )}

                        {error && (
                            <Typography color="error.main" sx={{ mb: 2.5, fontWeight: 700, textAlign: 'center' }}>
                                {error}
                            </Typography>
                        )}

                        <form onSubmit={submit}>
                            <Stack spacing={2.25}>
                                <TextField
                                    fullWidth
                                    label="Email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    error={!!errors.email}
                                    helperText={errors.email}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <EmailIcon sx={{ color: musicColors.rosin, opacity: 0.78 }} />
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ bgcolor: 'white', borderRadius: 1.5 }}
                                />

                                <TextField
                                    fullWidth
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    error={!!errors.password}
                                    helperText={errors.password}
                                    InputProps={{
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <LockIcon sx={{ color: musicColors.rosin, opacity: 0.78 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                    sx={{ bgcolor: 'white', borderRadius: 1.5 }}
                                />

                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                name="remember"
                                                checked={data.remember}
                                                onChange={(e) => setData('remember', e.target.checked)}
                                                sx={{ color: musicColors.rosin, '&.Mui-checked': { color: musicColors.rosin } }}
                                            />
                                        }
                                        label={<Typography variant="body2" sx={{ fontWeight: 650 }}>Remember me</Typography>}
                                    />
                                    <Link href={routeWithBase('/forgot-password', app_base)} style={{ textDecoration: 'none' }}>
                                        <Typography variant="body2" sx={{ color: musicColors.rosin, fontWeight: 850 }}>
                                            Forgot?
                                        </Typography>
                                    </Link>
                                </Box>

                                <Button
                                    fullWidth
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={processing}
                                    sx={{
                                        py: 1.45,
                                        fontSize: '1rem',
                                        fontWeight: 900,
                                        bgcolor: musicColors.rosin,
                                        color: 'white',
                                        boxShadow: `0 12px 28px ${alpha(musicColors.rosin, 0.26)}`,
                                        '&:hover': { bgcolor: darken(musicColors.rosin, 0.08) },
                                    }}
                                >
                                    {processing ? 'Logging in...' : 'Enter admin'}
                                </Button>
                            </Stack>
                        </form>
                    </Paper>
                </Box>
            </Container>
        </Box>
    );

    if (isAdmin) {
        return adminForm;
    }

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: musicGradientForTheme(theme),
            py: 4,
        }}>
            <Head title="Log in">
                <PwaHeadTags />
            </Head>

            <Container maxWidth="xs">
                <Paper elevation={0} sx={{
                    p: 4,
                    borderRadius: 2,
                    bgcolor: 'rgba(255, 253, 248, 0.92)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(244, 194, 103, 0.26)',
                    boxShadow: '0 24px 70px rgba(23,19,18,0.24)',
                    textAlign: 'center',
                }}>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: musicColors.ink, mb: 1 }}>
                        {`Welcome to ${appName}`}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                        Log in to save instruments, track orders, and chat with the shop team.
                    </Typography>

                    {status && (
                        <Typography color="success.main" sx={{ mb: 3, fontWeight: 500 }}>
                            {status}
                        </Typography>
                    )}

                    {error && (
                        <Typography color="error.main" sx={{ mb: 3, fontWeight: 600 }}>
                            {error}
                        </Typography>
                    )}

                    <form onSubmit={submit}>
                        <Stack spacing={2.5}>
                            <TextField
                                fullWidth
                                label="Email or phone"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                error={!!errors.email}
                                helperText={errors.email}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <EmailIcon color="primary" sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ bgcolor: 'white', borderRadius: 2 }}
                            />

                            <TextField
                                fullWidth
                                label="Password"
                                type={showPassword ? 'text' : 'password'}
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                error={!!errors.password}
                                helperText={errors.password}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockIcon color="primary" sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                                                {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ bgcolor: 'white', borderRadius: 2 }}
                            />

                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            name="remember"
                                            checked={data.remember}
                                            onChange={(e) => setData('remember', e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={<Typography variant="body2">Remember me</Typography>}
                                />
                                <Link href={routeWithBase('/forgot-password', app_base)} style={{ textDecoration: 'none' }}>
                                    <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
                                        Forgot?
                                    </Typography>
                                </Link>
                            </Box>

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={processing}
                                sx={{ py: 1.5, fontSize: '1rem' }}
                            >
                                {processing ? 'Logging in...' : 'Sign In'}
                            </Button>
                        </Stack>
                    </form>

                    <>
                        <Box sx={{ my: 4 }}>
                            <Divider>
                                <Typography variant="caption" color="text.secondary">
                                    OR CONTINUE WITH
                                </Typography>
                            </Divider>
                        </Box>

                        <Button
                            fullWidth
                            component="a"
                            href={googleAuthAvailable ? routeWithBase('/auth/google', app_base) : undefined}
                            variant="outlined"
                            startIcon={<GoogleIcon />}
                            disabled={!googleAuthAvailable}
                            sx={{
                                borderColor: '#ddd',
                                color: 'text.primary',
                                '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.05) },
                            }}
                        >
                            Google
                        </Button>

                        {!googleAuthAvailable && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
                                Add Google OAuth credentials in .env to enable this button.
                            </Typography>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
                            Don't have an account?{' '}
                            <Link href={routeWithBase('/register', app_base)} style={{ textDecoration: 'none' }}>
                                <Typography component="span" variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                                    Sign Up
                                </Typography>
                            </Link>
                        </Typography>
                    </>
                </Paper>
            </Container>
        </Box>
    );
}
