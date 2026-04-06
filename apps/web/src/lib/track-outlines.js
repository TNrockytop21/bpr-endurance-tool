// Pre-made track outlines as normalized 0-1 coordinate arrays.
// These are used when the track name matches, falling back to auto-generated shapes.

const SPA = [
  // La Source hairpin and down to Eau Rouge
  {x:0.52,y:0.05},{x:0.50,y:0.04},{x:0.48,y:0.05},{x:0.47,y:0.07},
  {x:0.48,y:0.09},{x:0.50,y:0.10},{x:0.52,y:0.09},
  // Down the hill to Eau Rouge
  {x:0.54,y:0.11},{x:0.55,y:0.14},{x:0.56,y:0.17},{x:0.56,y:0.20},
  // Eau Rouge / Raidillon
  {x:0.55,y:0.22},{x:0.54,y:0.24},{x:0.54,y:0.26},{x:0.55,y:0.28},
  // Kemmel straight uphill
  {x:0.57,y:0.30},{x:0.60,y:0.33},{x:0.63,y:0.35},{x:0.67,y:0.37},
  {x:0.71,y:0.38},{x:0.75,y:0.39},{x:0.79,y:0.39},
  // Les Combes
  {x:0.82,y:0.39},{x:0.84,y:0.40},{x:0.86,y:0.42},{x:0.87,y:0.44},
  {x:0.87,y:0.46},
  // Malmedy
  {x:0.86,y:0.48},{x:0.84,y:0.50},{x:0.83,y:0.52},{x:0.83,y:0.54},
  // Rivage
  {x:0.84,y:0.56},{x:0.84,y:0.58},{x:0.83,y:0.60},{x:0.81,y:0.61},
  {x:0.79,y:0.62},
  // Down through the woods
  {x:0.76,y:0.63},{x:0.73,y:0.65},{x:0.70,y:0.67},{x:0.67,y:0.70},
  {x:0.64,y:0.73},{x:0.61,y:0.75},{x:0.58,y:0.77},
  // Pouhon double left
  {x:0.55,y:0.79},{x:0.52,y:0.80},{x:0.49,y:0.80},{x:0.46,y:0.79},
  {x:0.44,y:0.78},
  // Fagnes
  {x:0.42,y:0.77},{x:0.40,y:0.76},{x:0.38,y:0.76},{x:0.36,y:0.77},
  // Campus
  {x:0.34,y:0.78},{x:0.32,y:0.80},{x:0.30,y:0.82},
  // Stavelot
  {x:0.28,y:0.84},{x:0.26,y:0.85},{x:0.24,y:0.85},{x:0.22,y:0.84},
  {x:0.20,y:0.82},
  // Paul Frere / Blanchimont approach
  {x:0.19,y:0.80},{x:0.18,y:0.77},{x:0.17,y:0.74},{x:0.16,y:0.71},
  {x:0.15,y:0.68},{x:0.14,y:0.65},{x:0.13,y:0.62},
  // Blanchimont
  {x:0.12,y:0.58},{x:0.11,y:0.54},{x:0.11,y:0.50},{x:0.11,y:0.46},
  {x:0.12,y:0.42},
  // Bus Stop chicane approach
  {x:0.13,y:0.38},{x:0.15,y:0.34},{x:0.17,y:0.30},{x:0.20,y:0.26},
  {x:0.23,y:0.22},{x:0.26,y:0.19},
  // Bus Stop chicane
  {x:0.29,y:0.16},{x:0.31,y:0.14},{x:0.33,y:0.13},{x:0.35,y:0.14},
  {x:0.36,y:0.12},{x:0.37,y:0.10},{x:0.38,y:0.09},
  // Pit straight back to La Source
  {x:0.40,y:0.08},{x:0.42,y:0.07},{x:0.44,y:0.06},{x:0.47,y:0.05},
  {x:0.50,y:0.04},
];

const SEBRING = [
  // Start/finish straight heading south
  {x:0.75,y:0.10},{x:0.73,y:0.13},{x:0.70,y:0.15},
  // T1 - hard right
  {x:0.67,y:0.17},{x:0.63,y:0.18},{x:0.60,y:0.17},{x:0.58,y:0.15},
  // Short straight to T3
  {x:0.56,y:0.13},{x:0.54,y:0.12},{x:0.52,y:0.12},
  // T3 - hard left
  {x:0.49,y:0.13},{x:0.47,y:0.15},{x:0.46,y:0.18},{x:0.47,y:0.21},
  // T4/5 esses
  {x:0.49,y:0.24},{x:0.50,y:0.27},{x:0.49,y:0.30},
  {x:0.47,y:0.32},{x:0.45,y:0.33},
  // Straight to T7 hairpin
  {x:0.42,y:0.34},{x:0.38,y:0.36},{x:0.35,y:0.38},
  // T7 hairpin
  {x:0.32,y:0.40},{x:0.30,y:0.43},{x:0.30,y:0.46},
  {x:0.32,y:0.49},{x:0.35,y:0.50},
  // Back straight heading east
  {x:0.38,y:0.51},{x:0.42,y:0.52},{x:0.46,y:0.53},
  {x:0.50,y:0.54},{x:0.55,y:0.55},{x:0.60,y:0.55},
  // T10 - right
  {x:0.64,y:0.55},{x:0.67,y:0.54},{x:0.69,y:0.52},
  {x:0.70,y:0.49},
  // T11 - left
  {x:0.70,y:0.46},{x:0.71,y:0.43},{x:0.73,y:0.41},
  // Fast kinks T12/13
  {x:0.76,y:0.40},{x:0.79,y:0.42},{x:0.81,y:0.44},
  {x:0.82,y:0.47},
  // Sunset bend
  {x:0.82,y:0.50},{x:0.81,y:0.53},{x:0.79,y:0.55},
  {x:0.76,y:0.56},
  // Last corners T16/17
  {x:0.73,y:0.56},{x:0.70,y:0.55},{x:0.68,y:0.53},
  // Heading back to pit straight
  {x:0.67,y:0.50},{x:0.68,y:0.47},{x:0.70,y:0.44},
  {x:0.72,y:0.40},{x:0.74,y:0.36},{x:0.76,y:0.32},
  {x:0.77,y:0.28},{x:0.78,y:0.24},{x:0.78,y:0.20},
  {x:0.77,y:0.16},{x:0.76,y:0.12},
];

// Map track names/IDs to outlines
const TRACK_MAP = {
  'spa': SPA,
  'spa-francorchamps': SPA,
  'circuit de spa-francorchamps': SPA,
  'sebring': SEBRING,
  'sebring international raceway': SEBRING,
};

/**
 * Look up a pre-made track outline by name.
 * Returns normalized [{x,y}] array or null if not found.
 */
export function getTrackOutline(trackName) {
  if (!trackName) return null;
  const key = trackName.toLowerCase().trim();
  // Try exact match first, then partial
  if (TRACK_MAP[key]) return TRACK_MAP[key];
  for (const [name, outline] of Object.entries(TRACK_MAP)) {
    if (key.includes(name) || name.includes(key)) return outline;
  }
  return null;
}
