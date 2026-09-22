'use client';
import { useRef } from 'react';
import { Alert, Box, Button, Card, CardActionArea, Checkbox, Chip, LinearProgress, MenuItem,
  Stack, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import type { Asset } from '@/lib/contracts';
import { neighbourSourceSchema, type NeighbourSource } from '@/lib/group-contracts';
import { dateNeedsReview } from '@/lib/dates';
import { useErrorText, useLocale } from './providers';

const WINDOWS = [1, 3, 14];

function hasLocation(asset: Asset) {
  return asset.exifInfo?.latitude != null && asset.exifInfo?.longitude != null;
}

export function GroupPicker({ pool, selected, source, windowDays, pending, loading, error,
  canLoadMore, onLoadMore, onSelected, onSource, onWindow }: {
  pool: Asset[]; selected: Set<string>; source: NeighbourSource; windowDays: number;
  pending: boolean; loading: boolean; error: Error | null; canLoadMore: boolean; onLoadMore: () => void;
  onSelected: (value: Set<string>) => void;
  onSource: (value: NeighbourSource) => void; onWindow: (value: number) => void;
}) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const anchor = useRef<number | null>(null);

  function choose(index: number, extend: boolean) {
    const next = new Set(selected);
    const start = anchor.current;
    if (extend && start !== null) {
      const adding = !next.has(pool[index].id);
      for (let step = Math.min(start, index); step <= Math.max(start, index); step += 1) {
        if (adding) { next.add(pool[step].id); } else { next.delete(pool[step].id); }
      }
    } else {
      const id = pool[index].id;
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      anchor.current = index;
    }
    onSelected(next);
  }

  return <Stack spacing={2}>
    <Stack direction={{ xs: 'column', md: 'row' }} useFlexGap
      sx={{ justifyContent: 'space-between', alignItems: { md: 'center' }, gap: 2 }}>
      <ToggleButtonGroup exclusive size="small" value={source} aria-label={t('candidates')}
        onChange={(_, value) => { if (value !== null) { onSource(neighbourSourceSchema.parse(value)); } }}>
        <ToggleButton value="similar">{t('sourceSimilar')}</ToggleButton>
        <ToggleButton value="time">{t('sourceTime')}</ToggleButton>
        <ToggleButton value="filename">{t('sourceFilename')}</ToggleButton>
      </ToggleButtonGroup>
      <Stack direction="row" useFlexGap sx={{ gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField select label={t('windowDays')} value={windowDays} disabled={source !== 'time'}
          sx={{ minWidth: 140 }} onChange={(event) => onWindow(Number(event.target.value))}>
          {WINDOWS.map((days) => <MenuItem key={days} value={days}>± {days} {t('daysShort')}</MenuItem>)}
        </TextField>
        <Button size="small" onClick={() => onSelected(new Set(pool.map((item) => item.id)))}>{t('selectAll')}</Button>
        <Button size="small" onClick={() => onSelected(new Set())}>{t('clearSelection')}</Button>
      </Stack>
    </Stack>
    <Typography variant="caption" color="text.secondary">{t('rangeHint')}</Typography>
    {pending && <LinearProgress />}
    {error && <Alert severity="error">{errorText(error)}</Alert>}
    <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1.5 }}>
      {pool.map((item, index) => <Card key={item.id} variant="outlined"
        sx={{ position: 'relative', minWidth: 0, flex: { xs: '1 1 45%', sm: '1 1 30%', lg: '1 1 22%', xl: '1 1 15%' },
          maxWidth: { xs: 'calc(50% - 6px)', sm: 'calc(33% - 8px)', lg: 'calc(25% - 9px)', xl: 'calc(16.6% - 10px)' },
          borderColor: selected.has(item.id) ? 'primary.main' : 'divider' }}>
        <CardActionArea onClick={(event) => choose(index, event.shiftKey)}
          aria-label={`${t('selectPhoto')} ${item.originalFileName}`}>
          <Box component="img" src={`/api/media?id=${item.id}&kind=preview`} alt={item.originalFileName}
            loading="lazy" sx={{ width: '100%', height: 150, display: 'block', objectFit: 'cover' }} />
          <Stack spacing={0.5} sx={{ p: 1 }}>
            <Stack direction="row" useFlexGap sx={{ gap: 0.5, flexWrap: 'wrap' }}>
              {index === 0 && <Chip size="small" color="primary" label={t('currentFrame')} />}
              {hasLocation(item) && <Chip size="small" color="success" variant="outlined" label="GPS" />}
            </Stack>
            <Typography variant="caption" noWrap title={item.originalFileName}>{item.originalFileName}</Typography>
            <Typography variant="caption" color={dateNeedsReview(item) ? 'warning.main' : 'text.secondary'}>
              {item.localDateTime.slice(0, 19).replace('T', ' ')}
            </Typography>
          </Stack>
        </CardActionArea>
        <Checkbox checked={selected.has(item.id)} tabIndex={-1} disableRipple
          sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'background.paper', borderRadius: 1, pointerEvents: 'none' }} />
      </Card>)}
    </Stack>
    {!pending && pool.length <= 1 && <Typography color="text.secondary">{t('noCandidates')}</Typography>}
    {canLoadMore && <Button variant="outlined" disabled={loading} onClick={onLoadMore} sx={{ alignSelf: 'center' }}>
      {loading ? t('loading') : t('loadMore')}
    </Button>}
  </Stack>;
}
