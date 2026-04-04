import type { TemporalMarkers } from "../types/index.js";

export const TEMPORAL_MARKERS: TemporalMarkers = {
  sequential: ["then", "next", "subsequently", "afterward", "following", "finally"],
  concurrent: ["while", "during", "meanwhile", "simultaneously", "concurrently", "parallel"],
  cyclic: ["cycle", "loop", "iterate", "periodic", "recurring", "repeat"],
  recursive: ["recursive", "meta", "nested", "self-referential", "reflexive", "introspect"],
};
