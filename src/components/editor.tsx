'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Autocomplete, Box, Button, Chip, Divider, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { api, detailSchema, type Detail } from '@/lib/api';
import { albumsSchema, presetsSchema, type Album, type Edit, type Preset } from '@/lib/contracts';
import { dateNeedsReview } from '@/lib/dates';
import { useErrorText, useLocale } from './providers';
import { DateEditor, type DateDraft } from './date-editor';
import { PresetDialog } from './preset-dialog';
import { AlbumPicker } from './album-picker';

export function Editor({ detail, instance, advance, reload }: { detail: Detail; instance: string; advance: () => void; reload: () => void }) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const cache = useQueryClient();
  const { asset } = detail;
  const [date, setDate] = useState<DateDraft>({ enabled: false, local: asset.localDateTime.slice(0, 19), zone: asset.exifInfo?.timeZone ?? '', offset: '' });
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [location, setLocation] = useState<Preset | null>(null);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [description, setDescription] = useState(asset.exifInfo?.description ?? '');
  const [selectedAlbums, setSelectedAlbums] = useState<Album[]>([]);
  const albums = useQuery({ queryKey: ['albums'], queryFn: () => api('albums', albumsSchema), staleTime: 60000 });
  const presets = useQuery({ queryKey: ['presets'], queryFn: () => api('presets', presetsSchema) });
  function selectLocation(value: Preset | null) {
    setLocation(value); setLocationEnabled(value !== null);
    if (value) { setDate((current) => ({ ...current, zone: value.timeZone, offset: '' })); }
  }
  const dirty = date.enabled || locationEnabled || selectedAlbums.length > 0 || description !== (asset.exifInfo?.description ?? '');
  const save = useMutation({ mutationFn: () => {
    const edit: Edit = { id: asset.id, revision: detail.revision, albumIds: selectedAlbums.map((a) => a.id) };
    if (description !== (asset.exifInfo?.description ?? '')) { edit.description = description.trim(); }
    if (locationEnabled && location) { edit.location = { latitude: location.latitude, longitude: location.longitude }; }
    if (date.enabled) { edit.date = { local: date.local, timeZone: date.zone.trim(), ...(date.offset.trim() ? { offset: Number(date.offset) } : {}) }; }
    return api('save', detailSchema, edit);
  }, onSuccess: () => { void cache.invalidateQueries({ queryKey: ['albums'] }); advance(); } });
  const missingLocation = asset.exifInfo?.latitude == null || asset.exifInfo?.longitude == null;
  return <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3}  sx={{ alignItems: "flex-start" }}>
    <Box    sx={{flex: 1, minWidth: 0, width: "100%",  position: { lg: 'sticky' }, top: 24 }}>
      <Paper variant="outlined" sx={{ overflow: 'hidden', p: 1, bgcolor: 'background.default' }}>
        {asset.type === 'VIDEO' ? <Box component="video" controls preload="metadata" aria-label={asset.originalFileName}
          src={`/api/media?id=${asset.id}&kind=video`} poster={`/api/media?id=${asset.id}&kind=preview`}
          sx={{ width: '100%', height: { xs: 380, sm: 560, lg: 680 }, display: 'block', objectFit: 'contain' }} /> :
          <Box component="img" alt={asset.originalFileName} src={`/api/media?id=${asset.id}&kind=preview`}
            sx={{ width: '100%', height: { xs: 380, sm: 560, lg: 680 }, display: 'block', objectFit: 'contain' }} />}
      </Paper>
      <Stack spacing={1.5}  sx={{ p: 2 }}>
        <Typography  sx={{fontWeight: 600,  overflowWrap: 'anywhere' }}>{asset.originalFileName}</Typography>
        <Stack direction="row" useFlexGap   sx={{ flexWrap: "wrap", gap: 1 }}>
          {missingLocation && <Chip size="small" label={t('noGps')} color="warning" variant="outlined" />}
          {dateNeedsReview(asset) && <Chip size="small" label={t('badDate')} color="warning" variant="outlined" />}
          {dirty && <Chip size="small" label={t('changed')} color="primary" variant="outlined" />}
        </Stack>
        <Button href={`${instance}/photos/${asset.id}`} target="_blank" rel="noreferrer" size="small" sx={{ alignSelf: 'flex-start' }}>{t('source')} ↗</Button>
      </Stack>
    </Box>
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, width: { xs: '100%', lg: 440 }, flexShrink: 0 }}>
      <Stack spacing={3} component="fieldset" disabled={save.isPending} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
        <Stack spacing={1.5}>
          <Stack direction="row"   sx={{ justifyContent: "space-between", alignItems: "center" }}><Typography variant="h6">{t('location')}</Typography>
            <Button size="small" onClick={() => setPlaceOpen(true)}>{t('newPlace')}</Button></Stack>
          <Typography variant="body2" color="text.secondary">{missingLocation ? t('noLocation') : `${asset.exifInfo?.latitude}, ${asset.exifInfo?.longitude}`}</Typography>
          <Autocomplete options={presets.data ?? []} loading={presets.isPending} value={location} getOptionLabel={(p) => p.name}
            isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_, value) => selectLocation(value)}
            renderInput={(params) => <TextField {...params} label={t('preset')} />} />
          {location && <><Typography variant="caption">{location.latitude}, {location.longitude} · {location.timeZone}</Typography>
            <FormControlLabel label={t('confirmLocation')} control={<Switch checked={locationEnabled} onChange={(_, v) => setLocationEnabled(v)} />} /></>}
          <Typography variant="caption" color="text.secondary">{t('locationHint')}</Typography>
        </Stack>
        <Divider /><DateEditor asset={asset} value={date} onChange={setDate} /><Divider />
        <AlbumPicker albums={albums.data ?? []} existing={detail.albums} selected={selectedAlbums} onChange={setSelectedAlbums}
          onCreated={(album) => { cache.setQueryData(['albums'], [...(albums.data ?? []), album]); }} />
        <Divider /><TextField multiline minRows={2} label={`${t('description')} · ${t('optional')}`} placeholder={t('caption')}
          value={description} onChange={(e) => setDescription(e.target.value)} />
        {(save.error || albums.error || presets.error) && <Alert severity="error" action={<Button color="inherit" size="small" onClick={reload}>{t('retry')}</Button>}>
          {errorText(save.error ?? albums.error ?? presets.error)}
        </Alert>}
        <Stack direction="row"  sx={{ gap: 1 }}>
          <Button variant="outlined" onClick={advance} disabled={save.isPending}>{t('skip')}</Button>
          <Button fullWidth variant="contained" onClick={() => save.mutate()} disabled={save.isPending || (date.enabled && (!date.local || !date.zone))}>
            {save.isPending ? t('saving') : dirty ? t('save') : t('correct')}
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary">{t('processedHint')}</Typography>
      </Stack>
    </Paper>
    {placeOpen && <PresetDialog open close={() => setPlaceOpen(false)} onSaved={(values, selected) => { cache.setQueryData(['presets'], values); selectLocation(selected); }} />}
  </Stack>;
}
