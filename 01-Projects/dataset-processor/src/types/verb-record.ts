/**
 * VerbRecord — process-shaped extraction from dataset processing.
 * Content-addressed by SHA-256 of source passage + extraction params.
 */
export interface VerbRecord {
  id: string;

  // Process description
  process: {
    shape: string;
    operators: string[];
    axis: 'differentiate' | 'integrate' | 'recurse';
    derivativeOrder: 0 | 1 | 2 | 3;
    temporalStructure?: 'sequential' | 'concurrent' | 'cyclic' | 'recursive';
  };

  // Source linkage (Reconstruction Burden)
  source: {
    dataset: string;
    component: string;
    documentId: string;
    charOffset: [number, number];
    contentHash: string;
    rawText: string;
  };

  // Motif matching
  motifMatch?: {
    motifId: string;
    confidence: number;
    matchEvidence: string;
    isNovel: boolean;
  };

  // Formalization stage (Progressive Formalization)
  stage: 'amorphous' | 'structured' | 'typed' | 'crystallized';

  // Quality and trust
  quality: {
    tierAScore: number;
    tierBScore: number;
    tierCScore?: number;
    extractionMethod: 'primed' | 'blind';
  };

  // Domain context
  domain: string;

  // Metadata
  createdAt: string;
  updatedAt: string;
  extractorVersion: string;
}
