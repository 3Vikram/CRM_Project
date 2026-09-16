import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import App from './App'
import './index.css'

const theme = createTheme({
  palette: {
    primary: {
      main: '#06283D',
      light: '#0B3A53',
      dark: '#031724',
    },
    secondary: {
      main: '#0B3A53',
    },
    background: {
      default: '#F4F6F8',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#06283D',
      secondary: '#5F6B76',
    },
    divider: '#DDE4EA',
  },
  typography: {
    fontFamily: 'Inter, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: { fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontSize: '1.6rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h6: { fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.01em' },
    body1: { fontSize: '1.125rem', lineHeight: 1.6 },
    body2: { fontSize: '1.0625rem', lineHeight: 1.55 },
    subtitle1: { fontSize: '1.1875rem' },
    subtitle2: { fontSize: '1.0625rem' },
    caption: { fontSize: '0.9375rem' },
    button: { fontSize: '1.0625rem' },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 999,
          fontWeight: 600,
          boxShadow: 'none',
          minHeight: 42,
        },
        containedPrimary: {
          backgroundColor: '#06283D',
          '&:hover': { backgroundColor: '#0B3A53' },
        },
        outlined: {
          borderColor: '#D7DEE8',
          color: '#06283D',
          '&:hover': {
            borderColor: '#0B3A53',
            backgroundColor: '#F3F7FA',
          },
        },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 12,
            backgroundColor: '#FFFFFF',
            '& fieldset': { borderColor: '#D7DEE8' },
            '&:hover fieldset': { borderColor: '#0B3A53' },
            '&.Mui-focused fieldset': { borderColor: '#0B3A53', borderWidth: 1 },
          },
          '& .MuiInputLabel-root': { color: '#5F6B76' },
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 20, boxShadow: '0 18px 48px rgba(6, 40, 61, 0.14)' },
      },
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)