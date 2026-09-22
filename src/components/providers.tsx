'use client';
import { createContext, useContext, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { enUS, ruRU } from '@mui/material/locale';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { languages, type Language, type MessageKey } from '@/lib/messages';

const theme = createTheme({
  palette: { mode: 'dark', primary: { main: '#a8dec6', contrastText: '#12241c' },
    background: { default: '#101715', paper: '#19221e' }, text: { primary: '#edf3ef', secondary: '#b8c6be' },
    divider: '#3b4942' },
  typography: { fontFamily: 'Arial, Helvetica, sans-serif', h3: { fontWeight: 600, letterSpacing: '-0.04em' },
    h5: { fontWeight: 600 }, button: { textTransform: 'none', fontWeight: 600 } },
  shape: { borderRadius: 12 },
  components: { MuiButton: { defaultProps: { disableElevation: true } }, MuiTextField: { defaultProps: { size: 'small' } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } } },
});
const LocaleContext = createContext<{ language: Language; setLanguage: (value: Language) => void; t: (key: MessageKey) => string } | null>(null);
const themes = { en: createTheme(theme, enUS), ru: createTheme(theme, ruRU) };
export function Providers({ children, initialLanguage }: { children: React.ReactNode; initialLanguage: Language }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } }));
  const [language, setLanguageState] = useState(initialLanguage);
  function setLanguage(value: Language) {
    setLanguageState(value);
    document.cookie = `language=${value};Path=/;SameSite=Strict;Max-Age=31536000`;
    document.documentElement.lang = value;
  }
  return <AppRouterCacheProvider><ThemeProvider theme={themes[language]}><CssBaseline />
    <QueryClientProvider client={queryClient}><LocaleContext.Provider value={{ language, setLanguage, t: (key) => languages[language][key] }}>
      {children}
    </LocaleContext.Provider></QueryClientProvider>
  </ThemeProvider></AppRouterCacheProvider>;
}
export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) { throw new Error('Missing locale provider'); }
  return context;
}
function isMessageKey(value: string): value is MessageKey { return Object.hasOwn(languages.en, value); }
export function useErrorText() {
  const { t } = useLocale();
  return (error: Error | null) => {
    if (!error) { return ''; }
    if (error.message.startsWith('upstream:')) { return `${t('upstream')} ${error.message.split(':')[1]}`; }
    if (isMessageKey(error.message)) { return t(error.message); }
    return t('requestFailed');
  };
}
