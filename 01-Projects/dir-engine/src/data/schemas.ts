import { z } from "zod";

export const IndicatorSchema = z.object({
  term: z.string().min(1),
  weight: z.number().min(0).max(2),
  axis: z.union([z.literal(0), z.literal(1), z.literal(2)]),
});

export const TemporalMarkersSchema = z.object({
  sequential: z.array(z.string()),
  concurrent: z.array(z.string()),
  cyclic: z.array(z.string()),
  recursive: z.array(z.string()),
});

export const IndicatorVocabularySchema = z.object({
  version: z.string(),
  indicators: z.array(IndicatorSchema).min(1),
  temporal_markers: TemporalMarkersSchema,
});

export const CentroidManifestSchema = z.object({
  version: z.string(),
  k: z.number().int().positive(),
  dim: z.number().int().positive(),
  dim_names: z.array(z.string()),
  centroids: z.array(z.array(z.number())).min(1),
  mapping: z.record(z.string(), z.string()),
});

export const MotifEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  composition: z.string(),
  tier: z.number().int().min(0).max(3),
  domains: z.array(z.string()),
  indicators: z.array(z.string()),
  primary_axis: z.enum(["differentiate", "integrate", "recurse"]),
});

export const MotifLibrarySchema = z.object({
  version: z.string(),
  motifs: z.array(MotifEntrySchema).min(1),
});
