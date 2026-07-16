import { Head, Link, useForm, usePage } from '@inertiajs/react';
import React, { useEffect } from 'react';
import { routeWithBase } from '@/Utils/url';
import {
    Box,
    Button,
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
    Person as PersonIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Google as GoogleIcon,
} from '@mui/icons-material';
import { alpha, useTheme } from '@mui/material/styles';

export default function Register({ error, googleAuthAvailable = false }) {
    const theme = useTheme();
    const { app_base } = usePage().props;
    const [showPassword, setShowPassword] = React.useState(false);

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        contact: '',
        password: '',
        password_confirmation: '',
    });

    useEffect(() => {
        return () => {
            reset('password', 'password_confirmation');
        };
    }, []);

    const submit = (e) => {
        e.preventDefault();
        post(routeWithBase('/register', app_base));
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
            <Head title="Register" />

            <Container maxWidth="xs">
                <Paper elevation={0} sx={{
                    p: 4,
                    borderRadius: 5,
                    bgcolor: 'rgba(255, 255, 255, 0.7)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: `0 20px 40px ${alpha(theme.palette.primary.main, 0.1)}`,
                    textAlign: 'center',
                }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', mb: 1 }}>
                        Create Account
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                        Join our lovely community today
                    </Typography>

                    {error && (
                        <Typography color="error.main" sx={{ mb: 3, fontWeight: 600 }}>
                            {error}
                        </Typography>
                    )}

                    <form onSubmit={submit}>
                        <Stack spacing={2}>
                            <TextField
                                fullWidth
                                label="Full Name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                error={!!errors.name}
                                helperText={errors.name}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <PersonIcon color="primary" sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ bgcolor: 'white', borderRadius: 2 }}
                            />

                            <TextField
                                fullWidth
                                label="Email or phone"
                                value={data.contact}
                                onChange={(e) => setData('contact', e.target.value)}
                                error={!!errors.contact}
                                helperText={errors.contact}
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

                            <TextField
                                fullWidth
                                label="Confirm Password"
                                type="password"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                error={!!errors.password_confirmation}
                                helperText={errors.password_confirmation}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <LockIcon color="primary" sx={{ opacity: 0.7 }} />
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ bgcolor: 'white', borderRadius: 2 }}
                            />

                            <Button
                                fullWidth
                                type="submit"
                                variant="contained"
                                size="large"
                                disabled={processing}
                                sx={{ py: 1.5, mt: 1 }}
                            >
                                {processing ? 'Creating account...' : 'Create Account'}
                            </Button>
                        </Stack>
                    </form>

                    <Box sx={{ my: 3 }}>
                        <Divider>
                            <Typography variant="caption" color="text.secondary">
                                OR SIGN UP WITH
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
                            py: 1,
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

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                        Already have an account?{' '}
                        <Link href={routeWithBase('/login', app_base)} style={{ textDecoration: 'none' }}>
                            <Typography component="span" variant="body2" color="primary" sx={{ fontWeight: 700 }}>
                                Sign In
                            </Typography>
                        </Link>
                    </Typography>
                </Paper>
            </Container>
        </Box>
    );
}
