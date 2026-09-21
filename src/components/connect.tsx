'use client';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Alert, Box, Button, Checkbox, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import { z } from 'zod';
import { api } from '@/lib/api';
import { useErrorText, useLocale } from './providers';

export function Connect({ onConnected }: { onConnected: () => void }) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const [instance, setInstance] = useState('');
  const [key, setKey] = useState('');
  const [remember, setRemember] = useState(false);
  const connect = useMutation({ mutationFn: () => api('connect', z.object({ connected: z.boolean() }),
    { instance: instance.trim(), key: key.trim(), remember }), onSuccess: () => { setKey(''); onConnected(); } });
  return <Stack direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 4, md: 8 }}   sx={{ alignItems: "center", py: { xs: 3, md: 10 } }}>
    <Box  sx={{ flex: 1 }}><Typography variant="overline" color="primary">{t('tagline')}</Typography>
      <Typography variant="h3" component="h1"   sx={{ mt: 2, mb: 3 }}>{t('connectTitle')}</Typography>
      <Typography color="text.secondary" variant="h6">{t('connectIntro')}</Typography>
      <Stack direction="row" useFlexGap     sx={{ flexWrap: "wrap", gap: 3, mt: 4, color: "primary.main" }}>
        {[t('date'), t('location'), t('albums')].map((label) => <Typography key={label}>{label}</Typography>)}
      </Stack>
    </Box>
    <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, flex: 1, width: '100%', maxWidth: 480 }}>
      <Box component="form" onSubmit={(event) => { event.preventDefault(); connect.mutate(); }}>
        <Stack spacing={3}>
          <Typography variant="h5">{t('library')}</Typography>
          <TextField label={t('instance')} type="url" required fullWidth value={instance} onChange={(e) => setInstance(e.target.value)} />
          <TextField label={t('apiKey')} type="password" autoComplete="off" required fullWidth value={key} onChange={(e) => setKey(e.target.value)} />
          <FormControlLabel control={<Checkbox checked={remember} onChange={(e) => setRemember(e.target.checked)} />} label={t('remember')} />
          {connect.error && <Alert severity="error">{errorText(connect.error)}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={connect.isPending}>{connect.isPending ? t('loading') : t('connect')}</Button>
          <Typography variant="body2" color="text.secondary">{t('connectionHint')}</Typography>
          <Typography variant="caption" color="text.secondary">{t('permissions')}</Typography>
        </Stack>
      </Box>
    </Paper>
  </Stack>;
}
