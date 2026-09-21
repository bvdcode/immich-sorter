'use client';
import { useState } from 'react';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { presetsSchema, type Preset } from '@/lib/contracts';
import { useErrorText, useLocale } from './providers';

export function PresetDialog({ open, close, onSaved }: { open: boolean; close: () => void; onSaved: (presets: Preset[], selected: Preset) => void }) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const [name, setName] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [timeZone, setTimeZone] = useState('');
  const save = useMutation({ mutationFn: async () => {
    const parts = coordinates.trim().split(/\s*,\s*/);
    if (parts.length !== 2 || parts.some((p) => !p.trim())) { throw new Error('invalidInput'); }
    const preset: Preset = { id: crypto.randomUUID(), name: name.trim(), latitude: Number(parts[0]), longitude: Number(parts[1]), timeZone: timeZone.trim() };
    const presets = await api('preset', presetsSchema, preset);
    return { presets, preset };
  }, onSuccess: ({ presets, preset }) => { onSaved(presets, preset); close(); } });
  return <Dialog open={open} onClose={save.isPending ? undefined : close} fullWidth maxWidth="sm">
    <DialogTitle>{t('newPlace')}</DialogTitle><DialogContent>
      <Stack spacing={3}  sx={{ pt: 1 }}>
        <TextField label={t('placeName')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <TextField label={t('coordinates')} value={coordinates} onChange={(e) => setCoordinates(e.target.value)} />
        <Autocomplete freeSolo options={Intl.supportedValuesOf('timeZone')} inputValue={timeZone}
          onInputChange={(_, value) => setTimeZone(value)} renderInput={(params) => <TextField {...params} label={t('timezone')} />} />
        {save.error && <Alert severity="error">{errorText(save.error)}</Alert>}
      </Stack>
    </DialogContent><DialogActions><Button onClick={close} disabled={save.isPending}>{t('cancel')}</Button>
      <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim() || !coordinates || !timeZone} variant="contained">{t('savePlace')}</Button>
    </DialogActions>
  </Dialog>;
}
