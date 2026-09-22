'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Autocomplete, Button, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import { api } from '@/lib/api';
import { presetsSchema, type Asset, type Preset } from '@/lib/contracts';
import type { LocationValue } from '@/lib/group-contracts';
import { useLocale } from './providers';
import { PresetDialog } from './preset-dialog';

const MapDialog = dynamic(() => import('./map-dialog').then((loaded) => loaded.MapDialog), { ssr: false });

function coordinatesOf(asset: Asset): LocationValue | null {
  const latitude = asset.exifInfo?.latitude;
  const longitude = asset.exifInfo?.longitude;
  if (latitude == null || longitude == null) { return null; }
  return { latitude, longitude };
}

export function GroupLocation({ group, value, label, overwrite, onChange, onOverwrite, onZone }: {
  group: Asset[]; value: LocationValue | null; label: string; overwrite: boolean;
  onChange: (value: LocationValue | null, label: string) => void;
  onOverwrite: (value: boolean) => void; onZone: (zone: string) => void;
}) {
  const { t } = useLocale();
  const cache = useQueryClient();
  const [mapOpen, setMapOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [frameId, setFrameId] = useState('');
  const [preset, setPreset] = useState<Preset | null>(null);
  const presets = useQuery({ queryKey: ['presets'], queryFn: () => api('presets', presetsSchema) });
  const anchors = group.filter((asset) => coordinatesOf(asset) !== null);

  function fromFrame(id: string) {
    const found = anchors.find((asset) => asset.id === id);
    const point = found ? coordinatesOf(found) : null;
    if (!found || !point) { return; }
    setFrameId(id); setPreset(null);
    onChange(point, found.originalFileName);
  }
  function fromPreset(chosen: Preset | null) {
    setPreset(chosen); setFrameId('');
    if (!chosen) { onChange(null, ''); return; }
    onChange({ latitude: chosen.latitude, longitude: chosen.longitude }, chosen.name);
    onZone(chosen.timeZone);
  }
  function fromMap(point: LocationValue, place: string, zone: string) {
    setFrameId(''); setPreset(null); setMapOpen(false);
    onChange(point, place);
    onZone(zone);
  }

  return <Stack spacing={1.5}>
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="h6">{t('location')}</Typography>
      {value && <Button size="small" onClick={() => setPlaceOpen(true)}>{t('newPlace')}</Button>}
    </Stack>
    <Button variant="outlined" onClick={() => setMapOpen(true)}>{t('pickOnMap')}</Button>
    <TextField select label={t('fromGroup')} value={frameId} disabled={anchors.length === 0}
      helperText={anchors.length === 0 ? t('noGpsInGroup') : ''}
      onChange={(event) => fromFrame(event.target.value)}>
      {anchors.map((asset) => <MenuItem key={asset.id} value={asset.id}>{asset.originalFileName}</MenuItem>)}
    </TextField>
    <Autocomplete options={presets.data ?? []} loading={presets.isPending} value={preset}
      getOptionLabel={(option) => option.name} isOptionEqualToValue={(left, right) => left.id === right.id}
      onChange={(_, chosen) => fromPreset(chosen)}
      renderInput={(params) => <TextField {...params} label={t('preset')} />} />
    {value && <Typography variant="body2" color="text.secondary">
      {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)} {label}
    </Typography>}
    {value && <FormControlLabel label={t('overwriteLocation')}
      control={<Switch checked={overwrite} onChange={(_, checked) => onOverwrite(checked)} />} />}
    {mapOpen && <MapDialog assets={group} close={() => setMapOpen(false)} onPick={fromMap} />}
    {placeOpen && value && <PresetDialog open close={() => setPlaceOpen(false)}
      initial={`${value.latitude}, ${value.longitude}`}
      onSaved={(values, saved) => { cache.setQueryData(['presets'], values); fromPreset(saved); }} />}
  </Stack>;
}
