'use client';
import { Autocomplete, Button, FormControlLabel, MenuItem, Stack, Switch, TextField,
  ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { Asset } from '@/lib/contracts';
import { parseFilename } from '@/lib/dates';
import { DEFAULT_STEP_SECONDS, orderingSchema, strategySchema,
  type DateIntent, type Ordering, type Strategy } from '@/lib/group-contracts';
import type { MessageKey } from '@/lib/messages';
import { useLocale } from './providers';

export type GroupDateDraft = {
  enabled: boolean; strategy: Strategy; ordering: Ordering; overwrite: boolean;
  anchorId: string; anchorLocal: string; startLocal: string; endLocal: string;
  stepSeconds: string; zone: string; offset: string;
};

export function emptyDateDraft(zone: string): GroupDateDraft {
  return { enabled: false, strategy: 'shift', ordering: 'byFilename', overwrite: false,
    anchorId: '', anchorLocal: '', startLocal: '', endLocal: '',
    stepSeconds: String(DEFAULT_STEP_SECONDS), zone, offset: '' };
}

export function toDateIntent(draft: GroupDateDraft): DateIntent | undefined {
  if (!draft.enabled) { return undefined; }
  const timeZone = draft.zone.trim();
  const offset = draft.offset.trim() === '' ? undefined : Number(draft.offset);
  switch (draft.strategy) {
    case 'shift': return { strategy: 'shift', timeZone, offset, anchorId: draft.anchorId, anchorLocal: draft.anchorLocal };
    case 'step': return { strategy: 'step', timeZone, offset, ordering: draft.ordering,
      anchorId: draft.anchorId, anchorLocal: draft.anchorLocal, stepSeconds: Number(draft.stepSeconds) };
    case 'span': return { strategy: 'span', timeZone, offset, ordering: draft.ordering,
      startLocal: draft.startLocal, endLocal: draft.endLocal };
  }
}

export function dateDraftReady(draft: GroupDateDraft): boolean {
  if (!draft.enabled) { return true; }
  if (draft.zone.trim() === '') { return false; }
  switch (draft.strategy) {
    case 'shift': return draft.anchorId !== '' && draft.anchorLocal !== '';
    case 'step': return draft.anchorId !== '' && draft.anchorLocal !== '' && Number(draft.stepSeconds) > 0;
    case 'span': return draft.startLocal !== '' && draft.endLocal !== '';
  }
}

function hintFor(strategy: Strategy): MessageKey {
  switch (strategy) {
    case 'shift': return 'strategyShiftHint';
    case 'step': return 'strategyStepHint';
    case 'span': return 'strategySpanHint';
  }
}

function seconds(raw: string) { return raw.length === 16 ? `${raw}:00` : raw; }

export function GroupDate({ group, value, onChange }: {
  group: Asset[]; value: GroupDateDraft; onChange: (value: GroupDateDraft) => void;
}) {
  const { t } = useLocale();
  const anchor = group.find((asset) => asset.id === value.anchorId);
  const fromName = anchor ? parseFilename(anchor.originalFileName) : null;
  const needsAnchor = value.strategy !== 'span';
  const needsOrder = value.strategy !== 'shift';

  return <Stack spacing={1.5}>
    <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
      <Typography variant="h6">{t('date')}</Typography>
      <FormControlLabel label={t('changeDates')}
        control={<Switch checked={value.enabled} onChange={(_, enabled) => onChange({ ...value, enabled })} />} />
    </Stack>
    {value.enabled && <>
      <ToggleButtonGroup exclusive size="small" value={value.strategy} aria-label={t('date')}
        onChange={(_, chosen) => {
          if (chosen !== null) { onChange({ ...value, strategy: strategySchema.parse(chosen) }); }
        }}>
        <ToggleButton value="shift">{t('strategyShift')}</ToggleButton>
        <ToggleButton value="step">{t('strategyStep')}</ToggleButton>
        <ToggleButton value="span">{t('strategySpan')}</ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary">{t(hintFor(value.strategy))}</Typography>
      {needsAnchor && <>
        <TextField select label={t('anchorFrame')} value={value.anchorId}
          onChange={(event) => onChange({ ...value, anchorId: event.target.value })}>
          {group.map((asset) => <MenuItem key={asset.id} value={asset.id}>
            {asset.originalFileName} · {asset.localDateTime.slice(0, 19).replace('T', ' ')}
          </MenuItem>)}
        </TextField>
        <TextField label={t('anchorTime')} type="datetime-local" value={value.anchorLocal}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 1 } }}
          onChange={(event) => onChange({ ...value, anchorLocal: seconds(event.target.value) })} />
        <Button size="small" disabled={fromName === null} sx={{ alignSelf: 'flex-start' }}
          onClick={() => { if (fromName) { onChange({ ...value, anchorLocal: fromName }); } }}>
          {t('parseDate')}{fromName ? ` · ${fromName.replace('T', ' ')}` : ''}
        </Button>
      </>}
      {value.strategy === 'step' && <TextField label={t('stepSeconds')} type="number" value={value.stepSeconds}
        onChange={(event) => onChange({ ...value, stepSeconds: event.target.value })} />}
      {value.strategy === 'span' && <>
        <TextField label={t('startTime')} type="datetime-local" value={value.startLocal}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 1 } }}
          onChange={(event) => onChange({ ...value, startLocal: seconds(event.target.value) })} />
        <TextField label={t('endTime')} type="datetime-local" value={value.endLocal}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 1 } }}
          onChange={(event) => onChange({ ...value, endLocal: seconds(event.target.value) })} />
      </>}
      {needsOrder && <>
        <TextField select label={t('frameOrder')} value={value.ordering}
          onChange={(event) => onChange({ ...value, ordering: orderingSchema.parse(event.target.value) })}>
          <MenuItem value="byFilename">{t('byFilename')}</MenuItem>
          <MenuItem value="byDate">{t('byDate')}</MenuItem>
        </TextField>
        <Typography variant="caption" color="text.secondary">{t('orderHint')}</Typography>
      </>}
      <Autocomplete freeSolo options={Intl.supportedValuesOf('timeZone')} inputValue={value.zone}
        onInputChange={(_, zone) => onChange({ ...value, zone })}
        renderInput={(params) => <TextField {...params} label={t('timezone')} helperText={t('timezoneHint')} />} />
      <TextField label={t('offset')} type="number" value={value.offset} placeholder={t('optional')}
        onChange={(event) => onChange({ ...value, offset: event.target.value })} />
      <FormControlLabel label={t('overwriteDate')}
        control={<Switch checked={value.overwrite} onChange={(_, overwrite) => onChange({ ...value, overwrite })} />} />
    </>}
  </Stack>;
}
