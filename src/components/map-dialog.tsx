'use client';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Map, { Marker, NavigationControl, type MapLayerMouseEvent, type MarkerEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress,
  MenuItem, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { api, mapConfigSchema, markersSchema } from '@/lib/api';
import { placeSchema, type Asset, type MapMarker } from '@/lib/contracts';
import type { LocationValue } from '@/lib/group-contracts';
import { useErrorText, useLocale } from './providers';

const WINDOWS = [1, 3, 14];
const MARKER_LIMIT = 500;
const DAY = 86400000;

type Bounds = [[number, number], [number, number]];

function span(assets: Asset[], days: number) {
  const times = assets.map((asset) => Date.parse(asset.fileCreatedAt)).filter(Number.isFinite);
  const centre = times.length > 0 ? times : [Date.now()];
  return { from: new Date(Math.min(...centre) - days * DAY).toISOString(),
    to: new Date(Math.max(...centre) + days * DAY).toISOString() };
}

function bounds(points: LocationValue[]): Bounds | null {
  if (points.length === 0) { return null; }
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const pad = 0.02;
  return [[Math.min(...longitudes) - pad, Math.min(...latitudes) - pad],
    [Math.max(...longitudes) + pad, Math.max(...latitudes) + pad]];
}

function located(assets: Asset[]): LocationValue[] {
  return assets.flatMap((asset) => {
    const latitude = asset.exifInfo?.latitude;
    const longitude = asset.exifInfo?.longitude;
    return latitude == null || longitude == null ? [] : [{ latitude, longitude }];
  });
}

export function MapDialog({ assets, close, onPick }: {
  assets: Asset[]; close: () => void; onPick: (value: LocationValue, label: string) => void;
}) {
  const { t } = useLocale();
  const errorText = useErrorText();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [days, setDays] = useState(3);
  const [point, setPoint] = useState<LocationValue | null>(null);
  const range = useMemo(() => span(assets, days), [assets, days]);
  const config = useQuery({ queryKey: ['map', 'config'], queryFn: () => api('map/config', mapConfigSchema), staleTime: Infinity });
  const markers = useQuery({ queryKey: ['map', 'markers', range.from, range.to], staleTime: 300000,
    queryFn: () => api(`map/markers?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`, markersSchema) });
  const place = useQuery({ queryKey: ['map', 'place', point?.latitude, point?.longitude], enabled: point !== null,
    queryFn: () => api(`map/place?lat=${point?.latitude}&lon=${point?.longitude}`, placeSchema) });
  const shown = (markers.data?.markers ?? []).slice(0, MARKER_LIMIT);
  const label = [place.data?.city, place.data?.state, place.data?.country].filter((part) => part).join(', ');
  const fitted = bounds(located(assets)) ?? bounds(shown.map((marker) => ({ latitude: marker.lat, longitude: marker.lon })));
  const view = fitted === null
    ? { longitude: 0, latitude: 20, zoom: 1 }
    : { bounds: fitted, fitBoundsOptions: { padding: 48, maxZoom: 14 } };

  function pickMarker(event: MarkerEvent<MouseEvent>, marker: MapMarker) {
    event.originalEvent.stopPropagation();
    setPoint({ latitude: marker.lat, longitude: marker.lon });
  }

  const loading = config.isPending || markers.isPending;
  return <Dialog open fullScreen={fullScreen} fullWidth maxWidth="lg" onClose={close}>
    <DialogTitle>{t('mapTitle')}</DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">{t('mapHint')}</Typography>
        <TextField select size="small" label={t('windowDays')} value={days} sx={{ maxWidth: 200 }}
          onChange={(event) => setDays(Number(event.target.value))}>
          {WINDOWS.map((value) => <MenuItem key={value} value={value}>± {value} {t('daysShort')}</MenuItem>)}
        </TextField>
        {loading && <LinearProgress />}
        {(config.error || markers.error) && <Alert severity="error">{errorText(config.error ?? markers.error)}</Alert>}
        {!loading && config.data && <Box sx={{ height: { xs: 360, sm: 440, md: 520 }, borderRadius: 1, overflow: 'hidden' }}>
          <Map mapStyle={config.data.styleUrl} initialViewState={view} reuseMaps
            onClick={(event: MapLayerMouseEvent) => setPoint({ latitude: event.lngLat.lat, longitude: event.lngLat.lng })}>
            <NavigationControl position="top-right" showCompass={false} />
            {shown.map((marker) => <Marker key={marker.id} longitude={marker.lon} latitude={marker.lat}
              onClick={(event) => pickMarker(event, marker)}>
              <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: 'success.main',
                border: 2, borderColor: 'background.paper', cursor: 'pointer' }} />
            </Marker>)}
            {point && <Marker longitude={point.longitude} latitude={point.latitude}>
              <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: 'primary.main',
                border: 3, borderColor: 'background.paper' }} />
            </Marker>}
          </Map>
        </Box>}
        {!loading && shown.length === 0 && <Alert severity="info">{t('mapEmpty')}</Alert>}
        {point && <Typography variant="body2">
          {t('chosenPoint')}: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)} {label}
        </Typography>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={close}>{t('cancel')}</Button>
      <Button variant="contained" disabled={point === null}
        onClick={() => { if (point) { onPick(point, label); } }}>{t('useThisPoint')}</Button>
    </DialogActions>
  </Dialog>;
}
