'use client';
import { useRef, useState } from 'react';
import { Alert, Button, LinearProgress, Paper, Stack, Typography } from '@mui/material';
import { api, syncInputSchema, syncResultSchema, type SyncInput } from '@/lib/api';
import { useErrorText, useLocale } from './providers';

export function Indexer({ onDone }: { onDone: () => void }) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [next, setNext] = useState<SyncInput>({ phase: 'assets', page: 1, markerId: null, reset: true });
  const stop = useRef(false);
  async function run() {
    stop.current = false; setRunning(true); setError(null);
    let step = next;
    try {
      while (!stop.current) {
        const result = await api('sync', syncResultSchema, step);
        setCount(result.count);
        if (result.done) { onDone(); break; }
        step = syncInputSchema.parse(result.next);
        setNext(step);
      }
    } catch (failure) { setError(failure instanceof Error ? failure : new Error('requestFailed')); }
    finally { setRunning(false); }
  }
  return <Paper variant="outlined" sx={{ p: 4, my: 4 }}><Stack spacing={3}  sx={{ alignItems: "flex-start" }}>
    <Typography variant="h5">{t('indexing')}</Typography><Typography color="text.secondary">{t('syncIntro')}</Typography>
    <Typography>{t('indexed')}: {count.toLocaleString()}</Typography>
    {running && <LinearProgress sx={{ width: '100%' }} />}
    {error && <Alert severity="error">{errorText(error)}</Alert>}
    {running ? <Button onClick={() => { stop.current = true; }}>{t('stop')}</Button> :
      <Button variant="contained" onClick={() => void run()}>{next.reset ? t('begin') : t('resume')}</Button>}
  </Stack></Paper>;
}
