/**
 * River Types — R1: PairedRecord and supporting types
 *
 * The atomic unit of river payload. Noun and verb bound by provenance.
 * Starts minimal per Progressive Formalization; fields accrete as slices require them.
 */

// ---------------------------------------------------------------------------
// Noun Component — what exists
// ---------------------------------------------------------------------------

export interface NounComponent {
  readonly entityType: string;
  readonly domain: string;
  readonly description: string;
  readonly rawContent: string;
}

// ---------------------------------------------------------------------------
// Verb Component — what it does
// ---------------------------------------------------------------------------

export interface VerbComponent {
  readonly processShape: string;
  readonly operators: readonly string[];
  readonly axis: "differentiate" | "integrate" | "recurse";
  readonly derivativeOrder: number;
}

// ---------------------------------------------------------------------------
// Alignment Component — how noun and verb relate
// ---------------------------------------------------------------------------

export type AlignmentMethod =
  | "provenance"
  | "structural"
  | "model-assigned"
  | "human-verified";

export interface AlignmentComponent {
  readonly confidence: number;
  readonly method: AlignmentMethod;
  readonly motifId?: string;
}

// ---------------------------------------------------------------------------
// River Position — where this record is now
// ---------------------------------------------------------------------------

export type RiverName = "intake" | "processing" | "reflection";
export type ChannelSpeed = "fast" | "slow";

export interface RiverPosition {
  readonly river: RiverName;
  readonly channel: ChannelSpeed;
  readonly stage: string;
  readonly enteredAt: string;
}

// ---------------------------------------------------------------------------
// PairedRecord — the atomic river payload
// ---------------------------------------------------------------------------

export interface PairedRecord {
  readonly id: string;
  readonly sourceProvenance: string;
  readonly timestamp: string;
  readonly noun: NounComponent | null;
  readonly verb: VerbComponent | null;
  readonly alignment: AlignmentComponent;
  readonly position: RiverPosition;
}

// ---------------------------------------------------------------------------
// Degenerate Form Classification
// ---------------------------------------------------------------------------

export type DegenerateForm =
  | "full_pair"
  | "noun_only"
  | "verb_only"
  | "unaligned_pair";
