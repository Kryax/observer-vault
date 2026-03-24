/**
 * MotifTemplate — generated lexical indicator template derived from a motif's
 * structural description, domain-independent formulation, and known instances.
 *
 * Templates are serializable to/from JSON so that Tier A filtering can load
 * them without parsing motif markdown at runtime.
 */
export interface MotifTemplate {
  motifId: string;
  motifName: string;
  tier: number;
  axis: 'differentiate' | 'integrate' | 'recurse';
  derivativeOrder: number;
  indicators: Array<{ term: string; weight: number }>;
  structuralDescription: string;
  instances: string[];
  sourceFile: string;
  generatedAt: string;
  contentHash: string; // SHA-256 of source motif file for incremental refresh
}

/**
 * MotifTemplateCache — the serialized form of all generated templates,
 * written to and read from a single JSON file.
 */
export interface MotifTemplateCache {
  version: number;
  generatedAt: string;
  templates: MotifTemplate[];
}
