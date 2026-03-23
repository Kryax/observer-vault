/**
 * MotifGraphEdge — relationship between two motifs discovered through verb-record evidence.
 */
export interface MotifGraphEdge {
  sourceMotifId: string;
  targetMotifId: string;
  relationshipType: 'complement' | 'tension' | 'composition' | 'derivation' | 'co-occurrence';
  strength: number;
  evidenceCount: number;
  evidenceIds: string[];
  discoveredAt: string;
  lastUpdated: string;
}
