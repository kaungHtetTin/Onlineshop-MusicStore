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
} from '@mui/icons-material';

export default function Login({ status, error, isAdminLogin = false, googleAuthAvailable = false }) {
    const { url, props } = usePage();
    const { app_base } = props;
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

    return (
        <Box sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #FFF1F5 0%, #F8BBD0 100%)',
            py: 4,
        }}>
            <Head title="Log in" />

            <Container maxWidth="xs">
                <Paper elevation={0} sx={{
                    p: 4,
                    borderRadius: 5,
                    bgcolor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 20px 40px rgba(233, 30, 99, 0.1)',
                    textAlign: 'center',
                }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>
                        {isAdmin ? 'Staff Login' : 'Welcome Back'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                        {isAdmin ? 'Sign in to manage LaLaPick' : 'Log in to your lovely account'}
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
                                label={isAdmin ? 'Email' : 'Email or phone'}
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

                    {!isAdmin && (
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
                                    '&:hover': { borderColor: 'primary.main', bgcolor: 'rgba(233, 30, 99, 0.05)' },
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
                    )}
                </Paper>
            </Container>
        </Box>
    );
}
