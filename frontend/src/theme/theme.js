import { createTheme } from '@mui/material/styles';

// Custom theme so MUI doesn't read as "default Material" — tuned for an
// ERP-grade / Figma-Canva-adjacent professional feel: neutral surfaces,
// one accent color, tighter radii, subtle shadows.
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#6d28d9',
      dark: '#5b21b6',
      light: '#8b5cf6',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#18181b',
    },
    background: {
      default: '#f7f7f8',
      paper: '#ffffff',
    },
    text: {
      primary: '#18181b',
      secondary: '#71717a',
    },
    divider: '#e4e4e7',
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: "'Inter', system-ui, 'Segoe UI', Roboto, sans-serif",
    h1: { fontWeight: 600 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, boxShadow: 'none' },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: 'none' } },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { borderRadius: 0 },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: { fontWeight: 600, color: '#52525b', background: '#fafafa' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
  },
});

export default theme;
