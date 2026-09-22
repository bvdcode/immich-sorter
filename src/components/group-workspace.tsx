'use client';
import { useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { api, candidatesSchema, queueSchema } from '@/lib/api';
import type { Filters } from '@/lib/contracts';
import { NEIGHBOUR_MAX, NEIGHBOUR_PAGE, type GroupResult, type NeighbourSource } from '@/lib/group-contracts';
import { GroupEditor } from './group-editor';
import { GroupPicker } from './group-picker';
import { useErrorText, useLocale } from './providers';

export function GroupWorkspace({ filters, instance }: { filters: Filters; instance: string }) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const cache = useQueryClient();
  const [after, setAfter] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [source, setSource] = useState<NeighbourSource>('time');
  const [windowDays, setWindowDays] = useState(3);
  const [selection, setSelection] = useState<{ seedId: string | null; ids: Set<string> }>({ seedId: null, ids: new Set() });
  const [paging, setPaging] = useState({ key: '', count: NEIGHBOUR_PAGE });
  const [result, setResult] = useState<GroupResult | null>(null);
  const queue = useQuery({ queryKey: ['queue', filters, after], staleTime: Infinity,
    queryFn: () => api('queue', queueSchema, { filters, after }) });
  const seed = queue.data?.items[index]?.asset ?? null;
  const seedId = seed?.id ?? null;
  const pageKey = `${seedId}/${source}/${windowDays}`;
  const count = paging.key === pageKey ? paging.count : NEIGHBOUR_PAGE;
  const candidates = useQuery({ queryKey: ['candidates', seedId, source, windowDays, count], enabled: seedId !== null,
    staleTime: 300000, placeholderData: keepPreviousData,
    queryFn: () => api(`candidates?id=${seedId}&source=${source}&window=${windowDays}&count=${count}`, candidatesSchema) });

  const selected = selection.seedId === seedId ? selection.ids : new Set(seedId === null ? [] : [seedId]);

  function restart() {
    void cache.invalidateQueries({ queryKey: ['queue'] });
    setAfter(null); setIndex(0);
  }
  function skip() {
    const items = queue.data?.items ?? [];
    const item = items[index];
    if (!item) { return; }
    if (index + 1 < items.length) { setIndex(index + 1); return; }
    setAfter(item.cursor); setIndex(0);
  }
  function applied(value: GroupResult) {
    setResult(value);
    restart();
  }
  function choose(ids: Set<string>) { setSelection({ seedId, ids }); }
  function loadMore() { setPaging({ key: pageKey, count: Math.min(count + NEIGHBOUR_PAGE, NEIGHBOUR_MAX) }); }

  if (queue.isPending) { return <LinearProgress />; }
  if (queue.error) {
    return <Alert severity="error" action={<Button onClick={() => void queue.refetch()}>{t('retry')}</Button>}>
      {errorText(queue.error)}</Alert>;
  }
  if (!seed) {
    return <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
      <Stack spacing={2} sx={{ alignItems: 'center' }}>
        <Typography variant="h5">{after ? t('pageEmpty') : t('empty')}</Typography>
        <Typography color="text.secondary">{after ? t('pageEmptyHint') : t('emptyHint')}</Typography>
        {after && <Button onClick={restart}>{t('restart')}</Button>}
      </Stack></Paper>;
  }

  const pool = [seed, ...(candidates.data?.items ?? [])];
  const group = pool.filter((asset) => selected.has(asset.id));
  return <Stack spacing={2}>
    <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
      <Typography color="text.secondary" variant="body2">{t('remaining')} {queue.data.total.toLocaleString()}</Typography>
      <Stack direction="row" sx={{ gap: 1 }}>
        <Button size="small" onClick={skip}>{t('skipFrame')}</Button>
        <Button size="small" onClick={restart}>{t('restart')}</Button>
      </Stack>
    </Stack>
    {result && <Alert severity={result.failed.length > 0 ? 'warning' : 'success'} onClose={() => setResult(null)}>
      {t('groupProcessed')} {result.processed.length}
      {result.failed.length > 0 && ` · ${t('groupFailed')} ${result.failed.length}`}
    </Alert>}
    <Stack direction={{ xs: 'column', lg: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
      <Stack spacing={2} sx={{ flex: 1, minWidth: 0, width: '100%' }}>
        <Paper variant="outlined" sx={{ overflow: 'hidden', p: 1, bgcolor: 'background.default' }}>
          <Box component="img" alt={seed.originalFileName} src={`/api/media?id=${seed.id}&kind=preview`}
            sx={{ width: '100%', height: { xs: 280, sm: 400, lg: 460 }, display: 'block', objectFit: 'contain' }} />
        </Paper>
        <Stack direction="row" useFlexGap sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{seed.originalFileName}</Typography>
          <Button href={`${instance}/photos/${seed.id}`} target="_blank" rel="noreferrer" size="small">{t('source')} ↗</Button>
        </Stack>
        <Typography variant="h6">{t('candidates')} · {t('selectedCount')} {group.length}</Typography>
        <GroupPicker pool={pool} selected={selected} source={source} windowDays={windowDays}
          pending={candidates.isPending} loading={candidates.isFetching} error={candidates.error}
          canLoadMore={(candidates.data?.items.length ?? 0) >= count && count < NEIGHBOUR_MAX}
          onLoadMore={loadMore} onSelected={choose} onSource={setSource} onWindow={setWindowDays} />
      </Stack>
      <Box sx={{ width: { xs: '100%', lg: 440 }, flexShrink: 0, position: { lg: 'sticky' }, top: 24 }}>
        <GroupEditor key={seed.id} group={group} zone={seed.exifInfo?.timeZone ?? ''} onApplied={applied} />
      </Box>
    </Stack>
  </Stack>;
}
