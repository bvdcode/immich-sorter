'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Chip, Container, Divider, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { z } from 'zod';
import { api, sessionInfoSchema } from '@/lib/api';
import { Connect } from './connect';
import { Library } from './library';
import { useLocale } from './providers';

export function Workspace() {
  const { t, language, setLanguage } = useLocale();
  const cache = useQueryClient();
  const session = useQuery({ queryKey: ['session'], queryFn: () => api('session', sessionInfoSchema) });
  const disconnect = useMutation({ mutationFn: () => api('disconnect', z.object({ connected: z.boolean() }), {}),
    onSuccess: () => { cache.clear(); void session.refetch(); } });
  return <Container maxWidth="xl" sx={{ py: { xs: 2, md: 3 }, px: { xs: 2, sm: 3, lg: 5 } }}>
    <Stack direction="row"   useFlexGap    sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 2, mb: 2 }}>
      <Stack direction="row"  spacing={1.5} sx={{ alignItems: "center" }}><Chip label="IC" color="primary" />
        <Typography variant="h6" component="span">{t('brand')}</Typography></Stack>
      <Stack direction="row"  useFlexGap   sx={{ alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        {session.data && <Typography variant="body2" color="text.secondary">{session.data.name}</Typography>}
        <TextField select size="small" value={language} slotProps={{ htmlInput: { 'aria-label': t('language') } }}
          onChange={(e) => { const value = z.enum(['ru', 'en']).parse(e.target.value); setLanguage(value); }}>
          <MenuItem value="en">English</MenuItem><MenuItem value="ru">Русский</MenuItem>
        </TextField>
        {session.data && <Button disabled={disconnect.isPending} onClick={() => disconnect.mutate()} size="small">{t('disconnect')}</Button>}
      </Stack>
    </Stack><Divider />
    {session.isPending ? <LinearProgress sx={{ mt: 3 }} /> : session.data ? <Library session={session.data} /> :
      <Connect onConnected={() => { cache.clear(); void session.refetch(); }} />}
  </Container>;
}
