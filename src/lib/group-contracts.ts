import { z } from 'zod';

export const GROUP_LIMIT = 100;
export const DEFAULT_STEP_SECONDS = 30;

const zone = z.string().trim().min(1).max(100);
const local = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
const offset = z.number().int().min(-1080).max(1080).optional();

export const neighbourSourceSchema = z.enum(['similar', 'time', 'filename']);
export const orderingSchema = z.enum(['byFilename', 'byDate']);
export const strategySchema = z.enum(['shift', 'step', 'span']);
export const locationValueSchema = z.object({
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) });

export const dateIntentSchema = z.discriminatedUnion('strategy', [
  z.object({ strategy: z.literal('shift'), timeZone: zone, offset, anchorId: z.uuid(), anchorLocal: local }),
  z.object({ strategy: z.literal('step'), timeZone: zone, offset, ordering: orderingSchema,
    anchorId: z.uuid(), anchorLocal: local, stepSeconds: z.number().int().min(1).max(86400) }),
  z.object({ strategy: z.literal('span'), timeZone: zone, offset, ordering: orderingSchema,
    startLocal: local, endLocal: local }),
]);

export const groupIntentSchema = z.object({
  assetIds: z.array(z.uuid()).min(1).max(GROUP_LIMIT),
  location: locationValueSchema.optional(),
  date: dateIntentSchema.optional(),
  albumIds: z.array(z.uuid()).max(100),
  description: z.string().trim().max(20000).optional(),
  overwrite: z.object({ location: z.boolean(), date: z.boolean(), description: z.boolean() }),
});

export const skipReasonSchema = z.enum(['alreadySet', 'identical', 'noCurrentDate', 'invalidDate', 'ambiguousDate']);
export const locationPlanSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('change'), from: locationValueSchema.nullable(), to: locationValueSchema }),
  z.object({ kind: z.literal('skip'), reason: skipReasonSchema, from: locationValueSchema.nullable() }),
]);
export const datePlanSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('change'), from: z.string().nullable(), to: z.string() }),
  z.object({ kind: z.literal('skip'), reason: skipReasonSchema, from: z.string().nullable() }),
]);
export const descriptionPlanSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('change'), from: z.string(), to: z.string() }),
  z.object({ kind: z.literal('skip'), reason: skipReasonSchema, from: z.string() }),
]);
export const assetPlanSchema = z.object({
  id: z.uuid(), filename: z.string(),
  location: locationPlanSchema.optional(), date: datePlanSchema.optional(),
  description: descriptionPlanSchema.optional(),
});
export const groupPlanSchema = z.object({
  revision: z.string(), changed: z.number(), timeZone: z.string().nullable(),
  albumIds: z.array(z.uuid()), assets: z.array(assetPlanSchema),
});
export const groupApplySchema = z.object({ intent: groupIntentSchema, revision: z.string() });
export const groupResultSchema = z.object({
  processed: z.array(z.uuid()), failed: z.array(z.object({ id: z.uuid(), error: z.string() })),
});

export type NeighbourSource = z.infer<typeof neighbourSourceSchema>;
export type Ordering = z.infer<typeof orderingSchema>;
export type Strategy = z.infer<typeof strategySchema>;
export type LocationValue = z.infer<typeof locationValueSchema>;
export type DateIntent = z.infer<typeof dateIntentSchema>;
export type GroupIntent = z.infer<typeof groupIntentSchema>;
export type SkipReason = z.infer<typeof skipReasonSchema>;
export type AssetPlan = z.infer<typeof assetPlanSchema>;
export type GroupPlan = z.infer<typeof groupPlanSchema>;
export type GroupResult = z.infer<typeof groupResultSchema>;
