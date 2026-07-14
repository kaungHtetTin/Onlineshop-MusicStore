import { createTheme } from '@mui/material/styles';

const clamp = (value) => Math.max(0, Math.min(255, value));

const hexToRgb = (hex) => {
    const clean = String(hex || '').replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(clean)) {
        return { r: 233, g: 30, b: 99 };
    }

    return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
    };
};

const rgbToHex = ({ r, g, b }) =>
    `#${[r, g, b].map((part) => clamp(Math.round(part)).toString(16).padStart(2, '0')).join('')}`;

const mix = (hex, target, weight) => {
    const a = hexToRgb(hex);
    const b = hexToRgb(target);

    return rgbToHex({
        r: a.r * (1 - weight) + b.r * weight,
        g: a.g * (1 - weight) + b.g * weight,
        b: a.b * (1 - weight) + b.b * weight,
    });
};

export const createUserTheme = (settings = {}) => {
    const primary = /^#[0-9a-fA-F]{6}$/.test(settings?.theme_color || '')
        ? settings.theme_color
        : '#E91E63';
    const primaryLight = mix(primary, '#ffffff', 0.72);
    const primaryDark = mix(primary, '#000000', 0.22);
    const secondary = mix(primary, '#ff5c8a', 0.45);
    const background = mix(primary, '#ffffff', 0.92);

    return createTheme({
    palette: {
        primary: {
            main: primary,
            light: primaryLight,
            dark: primaryDark,
            contrastText: '#fff',
        },
        secondary: {
            main: secondary,
            light: mix(secondary, '#ffffff', 0.55),
            dark: mix(secondary, '#000000', 0.22),
            contrastText: '#fff',
        },
        background: {
            default: background,
            paper: '#FFFFFF',
        },
        text: {
            primary: '#2D3436',
            secondary: '#636E72',
        },
    },
    shape: {
        borderRadius: 4, // Reduced from 16 for a sharper, modern look
    },
    spacing: 4, // More granular spacing
    typography: {
        fontFamily: '"Poppins", "Roboto", "Helvetica", "Arial", sans-serif',
        h1: { fontWeight: 700, letterSpacing: '-0.02em' },
        h2: { fontWeight: 700, letterSpacing: '-0.01em' },
        h3: { fontWeight: 700, letterSpacing: '-0.01em' },
        h4: { fontWeight: 600, letterSpacing: '-0.01em' },
        h5: { fontWeight: 600 },
        h6: { fontWeight: 600 },
        body1: { fontSize: '0.925rem' },
        body2: { fontSize: '0.825rem' },
        button: {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
        },
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 4, // Sharp edges
                    padding: '6px 12px', // Compact padding
                    minHeight: 36,
                    boxShadow: 'none',
                    '&:hover': {
                        boxShadow: `0px 2px 8px ${mix(primary, '#ffffff', 0.55)}66`,
                    },
                },
                containedPrimary: {
                    background: primary,
                    '&:hover': {
                        background: primaryDark,
                    }
                },
            },
        },
        MuiCard: {
            styleOverrides: {
                root: {
                    borderRadius: 4, // Sharp edges
                    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    overflow: 'hidden',
                },
            },
        },
        MuiContainer: {
            styleOverrides: {
                root: {
                    minWidth: 0,
                },
            },
        },
        MuiTextField: {
            defaultProps: {
                size: 'small', // Default to compact size
            },
        },
        MuiFormControl: {
            defaultProps: {
                size: 'small',
            },
        },
        MuiSelect: {
            styleOverrides: {
                select: {
                    minHeight: '1.4375em',
                },
            },
        },
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: 'none',
                },
            },
        },
    },
    });
};

const theme = createUserTheme();

export default theme;
