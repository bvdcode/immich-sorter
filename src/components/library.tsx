'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Button, Stack, Tab, Tabs, Typography } from '@mui/material';
import { z } from 'zod';
import { api, defaultFilters, type SessionInfo } from '@/lib/api';
import { presetsSchema } from '@/lib/contracts';
import type { MessageKey } from '@/lib/messages';
import { Indexer } from './indexer';
import { ReviewQueue } from './queue';
import { GroupWorkspace } from './group-workspace';
import { QueueFilters } from './filters';
import { useErrorText, useLocale } from './providers';

const modeSchema = z.enum(['batch', 'single']);
type Mode = z.infer<typeof modeSchema>;

function headingFor(mode: Mode): { title: MessageKey; subtitle: MessageKey } {
  switch (mode) {
    case 'batch': return { title: 'batchTitle', subtitle: 'batchSubtitle' };
    case 'single': return { title: 'reviewTitle', subtitle: 'reviewSubtitle' };
  }
}

export function Library({ session }: { session: SessionInfo }) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const cache = useQueryClient();
  const [reindex, setReindex] = useState(false);
  const [mode, setMode] = useState<Mode>('batch');
  const [filters, setFilters] = useState(defaultFilters);
  const [error, setError] = useState<Error | null>(null);
  const heading = headingFor(mode);
  async function importPresets(file?: File) {
    if (!file) { return; }
    try {
      const values = presetsSchema.parse(JSON.parse(await file.text()));
      const existing = await api('presets', presetsSchema);
      const merged = [...existing.filter((p) => !values.some((v) => v.id === p.id)), ...values];
      const result = await api('presets', presetsSchema, { presets: merged });
      cache.setQueryData(['presets'], result); setError(null);
    } catch (failure) { setError(failure instanceof Error ? failure : new Error('invalidInput')); }
  }
  function review() {
    switch (mode) {
      case 'batch': return <GroupWorkspace key={JSON.stringify(filters)} filters={filters} instance={session.instance} />;
      case 'single': return <ReviewQueue key={JSON.stringify(filters)} filters={filters} instance={session.instance} />;
    }
  }
  return <>
    <Stack direction={{ xs: 'column', sm: 'row' }} sx={{ justifyContent: "space-between", alignItems: { sm: 'center' }, gap: 2, mt: 3 }}>
      <Stack sx={{ gap: 1 }}><Typography variant="h4" component="h1">{t(heading.title)}</Typography>
        <Typography color="text.secondary">{t(heading.subtitle)}</Typography></Stack>
      <Button variant="outlined" onClick={() => setReindex(true)} disabled={reindex}>{t('refresh')}</Button>
    </Stack>
    {(!session.indexed || reindex) ? <Indexer onDone={() => { setReindex(false); void cache.invalidateQueries({ queryKey: ['session'] }); void cache.invalidateQueries({ queryKey: ['queue'] }); }} /> : <>
      <Tabs value={mode} onChange={(_, value) => setMode(modeSchema.parse(value))} sx={{ mt: 3 }}>
        <Tab value="batch" label={t('modeBatch')} />
        <Tab value="single" label={t('modeSingle')} />
      </Tabs>
      <QueueFilters value={filters} change={setFilters} />
      {review()}
    </>}
    <Stack spacing={1} sx={{ mt: 5, mb: 3 }}>
      <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
        <Button size="small" href="/api/presets" download="places.json">{t('presetsExport')}</Button>
        <Button component="label" size="small">{t('presetsImport')}<input hidden type="file" accept="application/json" onChange={(e) => { void importPresets(e.target.files?.[0]); e.target.value = ''; }} /></Button>
        <Button size="small" href="/api/history" download="history.json">{t('historyExport')}</Button>
      </Stack><Typography variant="caption" color="text.secondary">{t('exportHint')}</Typography>
      {error && <Alert severity="error">{errorText(error)}</Alert>}
    </Stack>
  </>;
}
