'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Divider, FormControlLabel, Paper, Stack, Switch, TextField, Typography } from '@mui/material';
import { api } from '@/lib/api';
import { albumsSchema, type Album, type Asset } from '@/lib/contracts';
import { groupPlanSchema, groupResultSchema,
  type GroupIntent, type GroupPlan, type GroupResult, type LocationValue } from '@/lib/group-contracts';
import { useErrorText, useLocale } from './providers';
import { AlbumPicker } from './album-picker';
import { GroupDate, dateDraftReady, emptyDateDraft, toDateIntent } from './group-date';
import { GroupLocation } from './group-location';
import { GroupPreviewDialog } from './group-preview';

export function GroupEditor({ group, zone, onApplied }: {
  group: Asset[]; zone: string; onApplied: (result: GroupResult) => void;
}) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const cache = useQueryClient();
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [overwriteLocation, setOverwriteLocation] = useState(false);
  const [date, setDate] = useState(emptyDateDraft(zone));
  const [albums, setAlbums] = useState<Album[]>([]);
  const [description, setDescription] = useState('');
  const [overwriteDescription, setOverwriteDescription] = useState(false);
  const [pending, setPending] = useState<{ intent: GroupIntent; plan: GroupPlan } | null>(null);
  const known = useQuery({ queryKey: ['albums'], queryFn: () => api('albums', albumsSchema), staleTime: 60000 });

  function buildIntent(): GroupIntent {
    const intent: GroupIntent = { assetIds: group.map((asset) => asset.id), albumIds: albums.map((album) => album.id),
      overwrite: { location: overwriteLocation, date: date.overwrite, description: overwriteDescription } };
    if (location) { intent.location = location; }
    const dates = toDateIntent(date);
    if (dates) { intent.date = dates; }
    const text = description.trim();
    if (text !== '') { intent.description = text; }
    return intent;
  }

  const ready = group.length > 0 && dateDraftReady(date)
    && (location !== null || date.enabled || albums.length > 0 || description.trim() !== '');

  const preview = useMutation({ mutationFn: async () => {
    const intent = buildIntent();
    return { intent, plan: await api('group/preview', groupPlanSchema, intent) };
  }, onSuccess: setPending });
  const apply = useMutation({ mutationFn: () => {
    if (!pending) { throw new Error('noChanges'); }
    return api('group/apply', groupResultSchema, { intent: pending.intent, revision: pending.plan.revision });
  }, onSuccess: (result) => {
    setPending(null);
    void cache.invalidateQueries({ queryKey: ['albums'] });
    onApplied(result);
  } });

  const busy = preview.isPending || apply.isPending;
  return <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
    <Stack spacing={3} component="fieldset" disabled={busy} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
      <GroupLocation group={group} value={location} label={locationLabel} overwrite={overwriteLocation}
        onChange={(value, label) => { setLocation(value); setLocationLabel(label); }}
        onOverwrite={setOverwriteLocation} onZone={(value) => setDate((draft) => ({ ...draft, zone: value }))} />
      <Divider />
      <GroupDate group={group} value={date} onChange={setDate} />
      <Divider />
      <AlbumPicker albums={known.data ?? []} existing={[]} selected={albums} onChange={setAlbums}
        onCreated={(album) => { cache.setQueryData(['albums'], [...(known.data ?? []), album]); }} />
      <Divider />
      <Stack spacing={1.5}>
        <TextField multiline minRows={2} label={`${t('description')} · ${t('optional')}`} placeholder={t('caption')}
          value={description} onChange={(event) => setDescription(event.target.value)} />
        {description.trim() !== '' && <FormControlLabel label={t('overwriteDescription')}
          control={<Switch checked={overwriteDescription} onChange={(_, value) => setOverwriteDescription(value)} />} />}
      </Stack>
      {group.length === 0 && <Alert severity="info">{t('groupEmpty')}</Alert>}
      {(preview.error || known.error) && <Alert severity="error">{errorText(preview.error ?? known.error)}</Alert>}
      <Button fullWidth variant="contained" disabled={!ready || busy} onClick={() => preview.mutate()}>
        {preview.isPending ? t('loading') : `${t('previewChanges')} · ${group.length}`}
      </Button>
      <Typography variant="caption" color="text.secondary">{t('processedHint')}</Typography>
      {pending && <GroupPreviewDialog plan={pending.plan} albums={albums} applying={apply.isPending}
        error={apply.error} close={() => setPending(null)} onApply={() => apply.mutate()} />}
    </Stack>
  </Paper>;
}
