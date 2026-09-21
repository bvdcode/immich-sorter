'use client';
import { Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material';
import { filtersSchema, type Filters } from '@/lib/contracts';
import { useLocale } from './providers';

export function QueueFilters({ value, change }: { value: Filters; change: (value: Filters) => void }) {
  const { t } = useLocale();
  return <Paper variant="outlined" sx={{ p: 2, my: 3 }}>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}  sx={{ justifyContent: "space-between" }}>
      <Stack><Typography variant="subtitle2">{t('queue')}</Typography>
        <Stack direction="row"  useFlexGap sx={{ flexWrap: "wrap" }}>
          <FormControlLabel label={t('noGps')} control={<Checkbox checked={value.gps} disabled={value.all} onChange={(_, gps) => change({ ...value, gps })} />} />
          <FormControlLabel label={t('badDate')} control={<Checkbox checked={value.date} disabled={value.all} onChange={(_, date) => change({ ...value, date })} />} />
          <FormControlLabel label={t('noAlbum')} control={<Checkbox checked={value.album} disabled={value.all} onChange={(_, album) => change({ ...value, album })} />} />
        </Stack><Typography variant="caption" color="text.secondary">{t('anyFilter')}</Typography>
      </Stack>
      <Stack spacing={1}  sx={{ minWidth: 200 }}><TextField select label={t('mediaType')} value={value.type} onChange={(e) => change(filtersSchema.parse({ ...value, type: e.target.value }))}>
        <MenuItem value="ALL">{t('everything')}</MenuItem><MenuItem value="IMAGE">{t('photos')}</MenuItem><MenuItem value="VIDEO">{t('videos')}</MenuItem>
      </TextField><Stack direction="row"  useFlexGap sx={{ flexWrap: "wrap" }}>
        <FormControlLabel label={t('all')} control={<Checkbox size="small" checked={value.all} onChange={(_, all) => change({ ...value, all })} />} />
        <FormControlLabel label={t('includeProcessed')} control={<Checkbox size="small" checked={value.includeProcessed} onChange={(_, includeProcessed) => change({ ...value, includeProcessed })} />} />
      </Stack></Stack>
    </Stack>
  </Paper>;
}
