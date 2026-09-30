import type { CollectibleIdentity, JournalEntry } from '../types';

export const ARTWORK_PROMPT_VERSION = 'gutverse-character-base-v1' as const;

export type ReservedOverlayZone = {
  id: 'gut-core' | 'accessory-badge';
  shape: 'circle';
  /** Normalized 0–1 coordinates in the square output. */
  centerX: number;
  centerY: number;
  radius: number;
};

export type BaseArtworkGenerationRequest = {
  generationId: string;
  promptVersion: typeof ARTWORK_PROMPT_VERSION;
  prompt: string;
  seed: number;
  output: {
    aspectRatio: '1:1';
    layer: 'character-base-only';
    transparentTextLayer: false;
    reservedOverlayZones: ReservedOverlayZone[];
  };
  validation: {
    rejectIfOcrFindsText: true;
    rejectIfUnexpectedLogoDetected: true;
    exactHashRequired: true;
    perceptualHashRequired: true;
  };
};

const familyDirection: Record<CollectibleIdentity['traits']['family'], string> = {
  CRAG: 'short angular head made from clustered mineral fragments',
  CHUNK: 'wide heavy low-center head with compact rounded chunks',
  RIDGE: 'long ridged head with intentional surface crack lines',
  FLOW: 'balanced classic smooth flowing swirl head',
  PUFF: 'soft segmented cloud-like head',
  MELT: 'loosely melting head with controlled soft edges',
  TIDE: 'fluid floating wave-shaped head with translucent layers',
};

function requireCollectible(entry: JournalEntry) {
  if (!entry.collectible) throw new Error('Collectible identity must be assigned before artwork generation.');
  return entry.collectible;
}

/**
 * The only supported contract for calling the future AI image service.
 * AI produces the character base. Small symbols, brand marks, serials, and all
 * typography are deliberately absent and are added by deterministic rendering.
 */
export function buildBaseArtworkGenerationRequest(entry: JournalEntry): BaseArtworkGenerationRequest {
  const collectible = requireCollectible(entry);
  const { traits, renderContract } = collectible;
  const hasAccessoryBadge = renderContract.overlay.accessoryBadge !== null;
  const reservedOverlayZones: ReservedOverlayZone[] = [
    { id: 'gut-core', shape: 'circle', centerX: 0.5, centerY: 0.72, radius: 0.085 },
  ];
  if (hasAccessoryBadge) reservedOverlayZones.push({ id: 'accessory-badge', shape: 'circle', centerX: 0.5, centerY: 0.235, radius: 0.04 });

  const prompt = [
    'Create one polished square 2D Gutverse collectible character base.',
    `Family: ${traits.family}; ${familyDirection[traits.family]}.`,
    `Head material: ${traits.headMaterial}; surface pattern: ${traits.surfacePattern}; expression: ${traits.expression}.`,
    `Visible clothed shoulders, arms, and torso covering 40–45% of the portrait; outfit: ${traits.bodyStyle}; accessory: ${traits.accessory}.`,
    `Background: ${traits.background}; palette: ${traits.palette}; thick clean black contours and controlled cel shading.`,
    'Place one plain empty circular chest medallion at the exact center of the upper chest. Its interior must be a single flat color with no symbol.',
    hasAccessoryBadge ? 'Place one plain empty circular badge at the center of the headband. Its interior must be a single flat color with no symbol.' : '',
    'Do not draw text, letters, numbers, signatures, watermarks, logos, brand marks, serial numbers, badge symbols, tiny emblems, or pseudo-writing anywhere.',
    'Do not draw the Gut Core glyph. Do not draw any icon inside either reserved circle. These details are added later by deterministic vector overlays.',
    'Exactly one character; centered bust composition; no photorealism; friendly and stylish, not gross.',
  ].filter(Boolean).join(' ');

  return {
    generationId: collectible.generationId,
    promptVersion: ARTWORK_PROMPT_VERSION,
    prompt,
    seed: entry.artwork.seed,
    output: {
      aspectRatio: '1:1',
      layer: 'character-base-only',
      transparentTextLayer: false,
      reservedOverlayZones,
    },
    validation: {
      rejectIfOcrFindsText: true,
      rejectIfUnexpectedLogoDetected: true,
      exactHashRequired: true,
      perceptualHashRequired: true,
    },
  };
}
