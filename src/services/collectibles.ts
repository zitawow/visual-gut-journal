import type {
  BristolFamily,
  ArtworkGenerationContract,
  CollectibleIdentity,
  CollectibleTraits,
  JournalEntry,
  StoolAnalysis,
} from '../types';

const COLLECTION_ID = 'GUTVERSE-ORIGINS' as const;
const DNA_VERSION = '1.0' as const;

function createRenderContract(traits: CollectibleTraits): ArtworkGenerationContract {
  return {
    promptVersion: 'gutverse-character-base-v1',
    aiLayer: 'character-base-only',
    aiForbiddenElements: ['text', 'letters', 'numbers', 'logos', 'brand-marks', 'badge-symbols', 'serials'],
    requireOcrRejection: true,
    overlay: {
      version: 'gutverse-overlay-v1',
      gutCore: 'gut-core-v1',
      accessoryBadge: traits.accessory === 'headband' ? 'wave-v1' : null,
      serialPlacement: 'outside-artwork',
    },
  };
}

const families: Record<StoolAnalysis['bristolType'], BristolFamily> = {
  1: 'CRAG',
  2: 'CHUNK',
  3: 'RIDGE',
  4: 'FLOW',
  5: 'PUFF',
  6: 'MELT',
  7: 'TIDE',
};

const headMaterials: Record<BristolFamily, readonly string[]> = {
  CRAG: ['faceted-mineral', 'granite-chip', 'quartz-fragment'],
  CHUNK: ['dense-clay', 'soft-stone', 'chunky-vinyl'],
  RIDGE: ['cracked-ceramic', 'ribbed-clay', 'etched-vinyl'],
  FLOW: ['smooth-vinyl', 'polished-gel', 'satin-clay'],
  PUFF: ['cloud-fleece', 'marshmallow-vinyl', 'soft-foam'],
  MELT: ['melting-gel', 'dripping-vinyl', 'loose-slime'],
  TIDE: ['translucent-water', 'wave-glass', 'liquid-gel'],
};

const bodyStyles = ['varsity-jacket', 'utility-hoodie', 'track-jacket', 'fleece-hoodie', 'windbreaker', 'workwear-vest', 'crewneck', 'bomber-jacket'] as const;
const accessories = ['none', 'beanie', 'cap', 'round-glasses', 'visor', 'headband', 'earring', 'neck-charm', 'tiny-backpack', 'scarf'] as const;
const backgrounds = ['cobalt', 'sunny-yellow', 'mint', 'coral', 'lilac', 'aqua', 'cream', 'electric-blue', 'soft-pink', 'lime'] as const;
const expressions = ['calm', 'curious', 'sleepy', 'confident', 'bright', 'mischievous', 'gentle'] as const;
const surfacePatterns = ['clean', 'speckled', 'striped', 'marbled', 'star-dust', 'checker-detail', 'wave-lines', 'patchwork'] as const;

function hash32(value: string, salt: number) {
  let hash = (0x811c9dc5 ^ salt) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
    hash ^= hash >>> 13;
  }
  return hash >>> 0;
}

function fingerprint(value: string) {
  return [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f]
    .map((salt) => hash32(value, salt).toString(16).padStart(8, '0'))
    .join('');
}

function choose<T>(values: readonly T[], seed: number, offset: number) {
  return values[hash32(String(seed), offset) % values.length];
}

function createTraits(entry: JournalEntry, nonce: number): CollectibleTraits {
  const family = families[entry.analysis.bristolType];
  const seed = hash32(`${entry.id}|${entry.createdAt}|${nonce}`, nonce + 17);
  return {
    family,
    headMaterial: choose(headMaterials[family], seed, 11),
    bodyStyle: choose(bodyStyles, seed, 23),
    accessory: choose(accessories, seed, 37),
    background: choose(backgrounds, seed, 43),
    expression: choose(expressions, seed, 59),
    surfacePattern: choose(surfacePatterns, seed, 71),
    palette: entry.artwork.palette,
  };
}

function traitKey(traits: CollectibleTraits) {
  return [
    traits.family,
    traits.headMaterial,
    traits.bodyStyle,
    traits.accessory,
    traits.background,
    traits.expression,
    traits.surfacePattern,
    traits.palette,
  ].join('|');
}

function nextSerial(entries: JournalEntry[]) {
  return entries.reduce((highest, entry) => Math.max(highest, entry.collectible?.serial ?? 0), 0) + 1;
}

/**
 * Assigns off-chain, NFT-ready identity before image generation.
 * The full trait fingerprint is unique within the local collection. The backend
 * must additionally enforce UNIQUE(collection_id, serial), UNIQUE(trait_fingerprint),
 * UNIQUE(asset_sha256), and a perceptual-hash distance check for generated files.
 */
export function assignCollectibleIdentity(entry: JournalEntry, existingEntries: JournalEntry[]): JournalEntry {
  if (entry.collectible) {
    const legacy = entry.collectible as typeof entry.collectible & { renderContract?: ArtworkGenerationContract };
    return legacy.renderContract
      ? entry
      : { ...entry, collectible: { ...entry.collectible, renderContract: createRenderContract(entry.collectible.traits) } };
  }
  const usedFingerprints = new Set(existingEntries.map((item) => item.collectible?.traitFingerprint).filter(Boolean));
  let nonce = 0;
  let traits = createTraits(entry, nonce);
  let traitFingerprint = fingerprint(`${DNA_VERSION}|${traitKey(traits)}`);

  while (usedFingerprints.has(traitFingerprint) && nonce < 4096) {
    nonce += 1;
    traits = createTraits(entry, nonce);
    traitFingerprint = fingerprint(`${DNA_VERSION}|${traitKey(traits)}`);
  }
  if (usedFingerprints.has(traitFingerprint)) throw new Error('Collectible trait space exhausted.');

  const serial = nextSerial(existingEntries);
  const collectible: CollectibleIdentity = {
    collectionId: COLLECTION_ID,
    serial,
    displayId: `GUTVERSE-${String(serial).padStart(6, '0')}`,
    generationId: entry.id,
    dnaVersion: DNA_VERSION,
    traits,
    renderContract: createRenderContract(traits),
    traitFingerprint,
    status: 'off_chain',
  };
  return { ...entry, collectible };
}

/** Backfills older prototype entries without changing entries that already own an identity. */
export function ensureCollectibleIdentities(entries: JournalEntry[]) {
  const chronological = [...entries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const completed: JournalEntry[] = [];
  for (const entry of chronological) completed.push(assignCollectibleIdentity(entry, completed));
  const byId = new Map(completed.map((entry) => [entry.id, entry]));
  return entries.map((entry) => byId.get(entry.id) ?? entry);
}

export function getCollectibleLabel(entry: JournalEntry) {
  return entry.collectible?.displayId ?? `GUT PIECE · ${entry.id.slice(-4).toUpperCase()}`;
}
