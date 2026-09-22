'use client';
import { DateTime } from 'luxon';
import { DateTimeField } from '@mui/x-date-pickers/DateTimeField';
import { LOCAL_FORMAT } from '@/lib/dates';

export function LocalTimeField({ label, value, onChange }: {
  label: string; value: string; onChange: (value: string) => void;
}) {
  const parsed = value === '' ? null : DateTime.fromISO(value);
  return <DateTimeField label={label} format="yyyy-MM-dd HH:mm:ss" ampm={false}
    value={parsed !== null && parsed.isValid ? parsed : null}
    onChange={(next) => onChange(next !== null && next.isValid ? next.toFormat(LOCAL_FORMAT) : '')} />;
}
