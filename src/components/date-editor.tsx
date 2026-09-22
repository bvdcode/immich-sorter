'use client';
import { Autocomplete, Button, FormControlLabel, Stack, Switch, TextField, Typography } from '@mui/material';
import type { Asset } from '@/lib/contracts';
import { parseFilename } from '@/lib/dates';
import { useLocale } from './providers';
import { LocalTimeField } from './local-time-field';

export type DateDraft = { enabled: boolean; local: string; zone: string; offset: string };
export function DateEditor({ asset, value, onChange }: { asset: Asset; value: DateDraft; onChange: (value: DateDraft) => void }) {
  const { t } = useLocale();
  const parsed = parseFilename(asset.originalFileName);
  return <Stack spacing={1.5}>
    <Stack direction="row"    sx={{ justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
      <Typography variant="h6">{t('date')}</Typography>
      <FormControlLabel label={t('editDate')} control={<Switch checked={value.enabled} onChange={(_, enabled) => onChange({ ...value, enabled })} />} />
    </Stack>
    <Typography variant="body2" color="text.secondary">{t('currentDate')}: {asset.localDateTime.slice(0, 19).replace('T', ' ')} {asset.exifInfo?.timeZone ?? ''}</Typography>
    <Button variant="outlined" disabled={!parsed} onClick={() => { if (parsed) { onChange({ ...value, enabled: true, local: parsed }); } }}>
      {t('parseDate')}{parsed ? ` · ${parsed.replace('T', ' ')}` : ''}
    </Button>
    {value.enabled && <>
      <LocalTimeField label={t('localDate')} value={value.local} onChange={(local) => onChange({ ...value, local })} />
      <Autocomplete freeSolo options={Intl.supportedValuesOf('timeZone')} inputValue={value.zone}
        onInputChange={(_, zone) => onChange({ ...value, zone })} renderInput={(params) => <TextField {...params} label={t('timezone')} helperText={t('timezoneHint')} />} />
      <TextField label={t('offset')} type="number" value={value.offset} placeholder={t('optional')} onChange={(e) => onChange({ ...value, offset: e.target.value })} />
    </>}
    <Typography variant="caption" color="text.secondary">{parsed ? t('parseHint') : t('noFilenameDate')}</Typography>
  </Stack>;
}
