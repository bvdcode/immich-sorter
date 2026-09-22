'use client';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack,
  Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { Album } from '@/lib/contracts';
import type { AssetPlan, GroupPlan, LocationValue, SkipReason } from '@/lib/group-contracts';
import type { MessageKey } from '@/lib/messages';
import { useErrorText, useLocale } from './providers';

function reasonKey(reason: SkipReason): MessageKey {
  switch (reason) {
    case 'alreadySet': return 'reasonAlreadySet';
    case 'identical': return 'reasonIdentical';
    case 'noCurrentDate': return 'reasonNoCurrentDate';
    case 'invalidDate': return 'reasonInvalidDate';
    case 'ambiguousDate': return 'reasonAmbiguousDate';
  }
}

function point(value: LocationValue | null) {
  return value === null ? '—' : `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`;
}

function moment(value: string | null) {
  return value === null ? '—' : value.replace('T', ' ');
}

export function GroupPreviewDialog({ plan, albums, applying, error, close, onApply }: {
  plan: GroupPlan; albums: Album[]; applying: boolean; error: Error | null;
  close: () => void; onApply: () => void;
}) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const shows = (pick: (entry: AssetPlan) => object | undefined) => plan.assets.some((entry) => pick(entry) !== undefined);
  const columns = { location: shows((entry) => entry.location), date: shows((entry) => entry.date),
    description: shows((entry) => entry.description) };
  const nothing = plan.changed === 0 && albums.length === 0;

  function skipped(reason: SkipReason) {
    return <Typography variant="caption" color="text.secondary">{t(reasonKey(reason))}</Typography>;
  }

  return <Dialog open fullScreen={fullScreen} fullWidth maxWidth="lg" onClose={applying ? undefined : close}>
    <DialogTitle>{t('previewTitle')}</DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip size="small" color={plan.changed > 0 ? 'primary' : 'default'}
            label={`${t('willChange')} ${plan.changed} / ${plan.assets.length}`} />
          {plan.timeZone && <Chip size="small" variant="outlined" label={plan.timeZone} />}
          {albums.map((album) => <Chip key={album.id} size="small" variant="outlined" label={album.albumName} />)}
        </Stack>
        {albums.length > 0 && <Typography variant="caption" color="text.secondary">{t('groupAlbumHint')}</Typography>}
        {nothing && <Alert severity="info">{t('previewEmpty')}</Alert>}
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ whiteSpace: 'nowrap' }}>
            <TableHead><TableRow>
              <TableCell>{t('columnFrame')}</TableCell>
              {columns.location && <TableCell>{t('location')}</TableCell>}
              {columns.date && <TableCell>{t('date')}</TableCell>}
              {columns.description && <TableCell>{t('description')}</TableCell>}
            </TableRow></TableHead>
            <TableBody>
              {plan.assets.map((entry) => <TableRow key={entry.id}>
                <TableCell>
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', minWidth: 0 }}>
                    <Box component="img" src={`/api/media?id=${entry.id}&kind=preview`} alt={entry.filename}
                      loading="lazy" sx={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 1, flexShrink: 0 }} />
                    <Typography variant="caption" title={entry.filename}>{entry.filename}</Typography>
                  </Stack>
                </TableCell>
                {columns.location && <TableCell>
                  {entry.location?.kind === 'change' && <Typography variant="caption">
                    {point(entry.location.from)} → {point(entry.location.to)}
                  </Typography>}
                  {entry.location?.kind === 'skip' && skipped(entry.location.reason)}
                </TableCell>}
                {columns.date && <TableCell>
                  {entry.date?.kind === 'change' && <Typography variant="caption">
                    {moment(entry.date.from)} → {moment(entry.date.to)}
                  </Typography>}
                  {entry.date?.kind === 'skip' && skipped(entry.date.reason)}
                </TableCell>}
                {columns.description && <TableCell>
                  {entry.description?.kind === 'change' && <Typography variant="caption">{entry.description.to}</Typography>}
                  {entry.description?.kind === 'skip' && skipped(entry.description.reason)}
                </TableCell>}
              </TableRow>)}
            </TableBody>
          </Table>
        </Box>
        {error && <Alert severity="error">{errorText(error)}</Alert>}
        <Typography variant="caption" color="text.secondary">{t('processedHint')}</Typography>
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={close} disabled={applying}>{t('cancel')}</Button>
      <Button variant="contained" disabled={applying || nothing} onClick={onApply}>
        {applying ? t('applying') : `${t('applyGroup')} · ${plan.assets.length}`}
      </Button>
    </DialogActions>
  </Dialog>;
}
