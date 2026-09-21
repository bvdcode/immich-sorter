'use client';
import { useState } from 'react';
import { Alert, Autocomplete, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { albumSchema, PROCESSED, type Album } from '@/lib/contracts';
import { useErrorText, useLocale } from './providers';

export function AlbumPicker({ albums, existing, selected, onChange, onCreated }: {
  albums: Album[]; existing: Album[]; selected: Album[]; onChange: (value: Album[]) => void; onCreated: (album: Album) => void;
}) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const create = useMutation({ mutationFn: () => api('albums', albumSchema, { name: name.trim() }),
    onSuccess: (album) => { onCreated(album); onChange([...selected, album]); setOpen(false); setName(''); } });
  return <Stack spacing={1.5}>
    <Stack direction="row"   sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography variant="h6">{t('albums')}</Typography>
      <Button size="small" onClick={() => setOpen(true)}>{t('newAlbum')}</Button></Stack>
    {existing.length > 0 && <Stack direction="row"  useFlexGap   sx={{ flexWrap: "wrap", gap: 1, alignItems: "center" }}>
      <Typography variant="caption" color="text.secondary">{t('existingAlbums')}</Typography>
      {existing.map((a) => <Chip key={a.id} label={a.albumName} size="small" variant="outlined" />)}
    </Stack>}
    <Autocomplete multiple options={albums.filter((a) => a.albumName !== PROCESSED && !existing.some((e) => e.id === a.id))}
      value={selected} getOptionLabel={(a) => a.albumName} isOptionEqualToValue={(a, b) => a.id === b.id}
      onChange={(_, value) => onChange(value)} renderInput={(params) => <TextField {...params} label={t('chooseAlbums')} />} />
    <Typography variant="caption" color="text.secondary">{t('albumHint')}</Typography>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs"><DialogTitle>{t('newAlbum')}</DialogTitle>
      <DialogContent><Stack spacing={2}  sx={{ pt: 1 }}><TextField autoFocus label={t('albumName')} value={name} onChange={(e) => setName(e.target.value)} />
        {create.error && <Alert severity="error">{errorText(create.error)}</Alert>}</Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>{t('cancel')}</Button><Button variant="contained" disabled={create.isPending || !name.trim()}
        onClick={() => create.mutate()}>{t('create')}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
