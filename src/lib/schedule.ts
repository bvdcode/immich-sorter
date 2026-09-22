import { DateTime } from 'luxon';
import { LOCAL_FORMAT } from './dates';

export type Ordering = 'byFilename' | 'byDate';
export type ScheduleItem = { id: string; filename: string; current: string | null };
export type ShiftPlan = { strategy: 'shift'; anchorId: string; anchorLocal: string };
export type StepPlan = { strategy: 'step'; ordering: Ordering; anchorId: string; anchorLocal: string; stepSeconds: number };
export type SpanPlan = { strategy: 'span'; ordering: Ordering; startLocal: string; endLocal: string };
export type SchedulePlan = ShiftPlan | StepPlan | SpanPlan;
export type Schedule = { assigned: Map<string, string>; unschedulable: string[] };

function toMillis(local: string): number | null {
  const parsed = DateTime.fromISO(local, { zone: 'UTC' });
  return parsed.isValid ? parsed.toMillis() : null;
}

function fromMillis(value: number): string {
  return DateTime.fromMillis(value, { zone: 'UTC' }).toFormat(LOCAL_FORMAT);
}

function currentMillis(item: ScheduleItem | undefined): number | null {
  if (!item || item.current === null) { return null; }
  return toMillis(item.current);
}

function compareText(left: string, right: string): number {
  if (left < right) { return -1; }
  if (left > right) { return 1; }
  return 0;
}

function compareByFilename(left: ScheduleItem, right: ScheduleItem): number {
  return compareText(left.filename, right.filename) || compareText(left.id, right.id);
}

function compareByDate(left: ScheduleItem, right: ScheduleItem): number {
  const undated = Number.MAX_SAFE_INTEGER;
  return (currentMillis(left) ?? undated) - (currentMillis(right) ?? undated) || compareByFilename(left, right);
}

export function order(items: ScheduleItem[], ordering: Ordering): ScheduleItem[] {
  const sorted = [...items];
  switch (ordering) {
    case 'byFilename': return sorted.sort(compareByFilename);
    case 'byDate': return sorted.sort(compareByDate);
  }
}

function shift(items: ScheduleItem[], plan: ShiftPlan): Schedule {
  const anchorCurrent = currentMillis(items.find((item) => item.id === plan.anchorId));
  const target = toMillis(plan.anchorLocal);
  if (anchorCurrent === null || target === null) { throw new Error('anchorMissing'); }
  const delta = target - anchorCurrent;
  const assigned = new Map<string, string>();
  const unschedulable: string[] = [];
  for (const item of items) {
    const current = currentMillis(item);
    if (current === null) { unschedulable.push(item.id); continue; }
    assigned.set(item.id, fromMillis(current + delta));
  }
  return { assigned, unschedulable };
}

function step(items: ScheduleItem[], plan: StepPlan): Schedule {
  const sorted = order(items, plan.ordering);
  const anchorIndex = sorted.findIndex((item) => item.id === plan.anchorId);
  const target = toMillis(plan.anchorLocal);
  if (anchorIndex < 0 || target === null) { throw new Error('anchorMissing'); }
  const assigned = new Map<string, string>();
  sorted.forEach((item, index) => {
    assigned.set(item.id, fromMillis(target + (index - anchorIndex) * plan.stepSeconds * 1000));
  });
  return { assigned, unschedulable: [] };
}

function span(items: ScheduleItem[], plan: SpanPlan): Schedule {
  const sorted = order(items, plan.ordering);
  const start = toMillis(plan.startLocal);
  const end = toMillis(plan.endLocal);
  if (start === null || end === null) { throw new Error('anchorMissing'); }
  if (end < start) { throw new Error('invalidDate'); }
  const assigned = new Map<string, string>();
  const last = sorted.length - 1;
  sorted.forEach((item, index) => {
    assigned.set(item.id, fromMillis(last === 0 ? start : start + Math.round(((end - start) * index) / last)));
  });
  return { assigned, unschedulable: [] };
}

export function distribute(items: ScheduleItem[], plan: SchedulePlan): Schedule {
  switch (plan.strategy) {
    case 'shift': return shift(items, plan);
    case 'step': return step(items, plan);
    case 'span': return span(items, plan);
  }
}
