'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Button, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { api, detailSchema, queueSchema } from '@/lib/api';
import type { Filters } from '@/lib/contracts';
import { Editor } from './editor';
import { useErrorText, useLocale } from './providers';

export function ReviewQueue({ filters, instance }: { filters: Filters; instance: string }) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const cache = useQueryClient();
  const [after, setAfter] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const reviewStart = useRef<HTMLDivElement>(null);
  const queue = useQuery({ queryKey: ['queue', filters, after], queryFn: () => api('queue', queueSchema, { filters, after }), staleTime: Infinity });
  const current = queue.data?.items[index];
  const next = queue.data?.items[index + 1];
  const detail = useQuery({ queryKey: ['asset', current?.asset.id], queryFn: () => api(`asset?id=${current?.asset.id}`, detailSchema), enabled: !!current });
  useEffect(() => {
    if (detail.data) { reviewStart.current?.scrollIntoView({ block: 'start' }); }
  }, [detail.data]);
  useEffect(() => {
    if (next) {
      void cache.prefetchQuery({ queryKey: ['asset', next.asset.id], queryFn: () => api(`asset?id=${next.asset.id}`, detailSchema), staleTime: 30000 });
    }
  }, [next, cache]);
  function advance() {
    if (!queue.data || !current) { return; }
    if (index + 1 < queue.data.items.length) { setIndex(index + 1); }
    else { setAfter(current.cursor); setIndex(0); }
  }
  function restart() { void cache.invalidateQueries({ queryKey: ['queue'] }); setAfter(null); setIndex(0); }
  if (queue.isPending) { return <LinearProgress />; }
  if (queue.error) { return <Alert severity="error" action={<Button onClick={() => void queue.refetch()}>{t('retry')}</Button>}>{errorText(queue.error)}</Alert>; }
  if (!current) {
    return <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}><Stack spacing={2}  sx={{ alignItems: "center" }}>
      <Typography variant="h5">{after ? t('pageEmpty') : t('empty')}</Typography>
      <Typography color="text.secondary">{after ? t('pageEmptyHint') : t('emptyHint')}</Typography>
      {after && <Button onClick={restart}>{t('restart')}</Button>}
    </Stack></Paper>;
  }
  return <Stack spacing={2} ref={reviewStart}>
    <Stack direction="row"   sx={{ alignItems: "center", justifyContent: "space-between" }}><Typography color="text.secondary" variant="body2">
      {t('remaining')} {queue.data.total.toLocaleString()}
    </Typography><Button onClick={restart} size="small">{t('restart')}</Button></Stack>
    {detail.isPending && <><Typography>{t('loadingAsset')}</Typography><LinearProgress /></>}
    {detail.error && <Alert severity="error" action={<Button onClick={() => void detail.refetch()}>{t('retry')}</Button>}>{errorText(detail.error)}</Alert>}
    {detail.data && <Editor key={`${detail.data.asset.id}:${detail.data.revision}`} detail={detail.data} instance={instance} advance={advance} reload={() => void detail.refetch()} />}
  </Stack>;
}
