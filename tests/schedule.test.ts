import { expect, it } from 'vitest';
import { distribute, order, type ScheduleItem } from '../src/lib/schedule';

function item(id: string, filename: string, current: string | null): ScheduleItem {
  return { id, filename, current };
}
const frames = [
  item('a', 'IMG_0001.jpg', '2007-08-14T10:00:00'),
  item('b', 'IMG_0002.jpg', '2007-08-14T10:05:00'),
  item('c', 'IMG_0003.jpg', '2007-08-14T10:20:00'),
];

it('keeps the real intervals when shifting a sequence onto a known time', () => {
  const result = distribute(frames, { strategy: 'shift', anchorId: 'a', anchorLocal: '2019-06-01T12:00:00' });
  expect([...result.assigned.values()]).toEqual(['2019-06-01T12:00:00', '2019-06-01T12:05:00', '2019-06-01T12:20:00']);
  expect(result.unschedulable).toEqual([]);
});

it('shifts backwards from an anchor that is not the first frame', () => {
  const result = distribute(frames, { strategy: 'shift', anchorId: 'c', anchorLocal: '2019-06-01T12:20:00' });
  expect(result.assigned.get('a')).toBe('2019-06-01T12:00:00');
});

it('reports frames without a capture time instead of guessing one', () => {
  const result = distribute([...frames, item('d', 'IMG_0004.jpg', null)],
    { strategy: 'shift', anchorId: 'a', anchorLocal: '2019-06-01T12:00:00' });
  expect(result.unschedulable).toEqual(['d']);
  expect(result.assigned.has('d')).toBe(false);
  expect(result.assigned.size).toBe(3);
});

it('refuses to shift when the anchor itself has no capture time', () => {
  expect(() => distribute([item('a', 'IMG_0001.jpg', null)],
    { strategy: 'shift', anchorId: 'a', anchorLocal: '2019-06-01T12:00:00' })).toThrow('anchorMissing');
});

it('steps around the anchor in order, before and after it', () => {
  const result = distribute(frames,
    { strategy: 'step', ordering: 'byFilename', anchorId: 'b', anchorLocal: '2019-06-01T12:00:00', stepSeconds: 30 });
  expect([...result.assigned.values()]).toEqual(['2019-06-01T11:59:30', '2019-06-01T12:00:00', '2019-06-01T12:00:30']);
});

it('steps by filename order even when the stored dates disagree', () => {
  const shuffled = [
    item('a', 'IMG_0001.jpg', '2020-05-05T09:00:00'),
    item('b', 'IMG_0002.jpg', '1999-01-01T00:00:00'),
  ];
  const result = distribute(shuffled,
    { strategy: 'step', ordering: 'byFilename', anchorId: 'a', anchorLocal: '2019-06-01T12:00:00', stepSeconds: 60 });
  expect(result.assigned.get('a')).toBe('2019-06-01T12:00:00');
  expect(result.assigned.get('b')).toBe('2019-06-01T12:01:00');
});

it('spreads a group evenly between the first and the last frame', () => {
  const five = ['a', 'b', 'c', 'd', 'e'].map((id, index) => item(id, `IMG_000${index + 1}.jpg`, null));
  const result = distribute(five,
    { strategy: 'span', ordering: 'byFilename', startLocal: '2019-06-01T12:00:00', endLocal: '2019-06-01T13:00:00' });
  expect([...result.assigned.values()]).toEqual(['2019-06-01T12:00:00', '2019-06-01T12:15:00',
    '2019-06-01T12:30:00', '2019-06-01T12:45:00', '2019-06-01T13:00:00']);
});

it('gives a single frame the start of the span', () => {
  const result = distribute([item('a', 'IMG_0001.jpg', null)],
    { strategy: 'span', ordering: 'byFilename', startLocal: '2019-06-01T12:00:00', endLocal: '2019-06-01T13:00:00' });
  expect(result.assigned.get('a')).toBe('2019-06-01T12:00:00');
});

it('rejects a span that ends before it starts', () => {
  expect(() => distribute(frames,
    { strategy: 'span', ordering: 'byFilename', startLocal: '2019-06-01T13:00:00', endLocal: '2019-06-01T12:00:00' }))
    .toThrow('spanBackwards');
});

it('orders undated frames after dated ones', () => {
  const mixed = [item('a', 'IMG_0002.jpg', null), item('b', 'IMG_0001.jpg', '2007-08-14T10:00:00')];
  expect(order(mixed, 'byDate').map((entry) => entry.id)).toEqual(['b', 'a']);
  expect(order(mixed, 'byFilename').map((entry) => entry.id)).toEqual(['b', 'a']);
});
