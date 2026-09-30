export type AnalysisConfidence = 'high' | 'medium' | 'low';

export type BristolType = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type StoolColor =
  | 'light_brown'
  | 'medium_brown'
  | 'dark_brown'
  | 'yellow'
  | 'green'
  | 'black'
  | 'red'
  | 'clay'
  | 'other';
export type StoolShape = 'pellets' | 'lumpy' | 'cracked' | 'smooth' | 'soft_blobs' | 'mushy' | 'watery' | 'uncertain';
export type StoolTexture = 'dry' | 'firm' | 'smooth' | 'soft' | 'liquid' | 'uncertain';
export type OriginalRetentionPolicy = 'keep' | 'delete_after_analysis' | 'delete_after_7_days';
export type ExtraJournalContextValue = string | number | boolean | null;

export type StoolAnalysis = {
  bristolType: BristolType;
  color: StoolColor;
  shape: StoolShape;
  texture: StoolTexture;
  confidence: number;
  confidenceBand: AnalysisConfidence;
  requiresRetake: boolean;
  provider: string;
  modelName?: string;
  modelVersion?: string;
  promptVersion?: string;
  analysisVersion?: string;
  analysisSource?: 'ai' | 'user_correction' | 'manual_fallback';
  correctedByUser?: boolean;
  originalBristolType?: BristolType;
};

export type ArtworkSpec = {
  engineVersion: '1.0';
  seed: number;
  form: 'mineral' | 'ribbon' | 'petal' | 'liquid';
  palette: 'clay' | 'moss' | 'amber';
  fluidity: number;
  complexity: number;
  /** Future artwork generators can write their stored output here without changing the UI layer. */
  generatedImageUri?: string;
};

export type BristolFamily = 'CRAG' | 'CHUNK' | 'RIDGE' | 'FLOW' | 'PUFF' | 'MELT' | 'TIDE';

export type CollectibleTraits = {
  family: BristolFamily;
  headMaterial: string;
  bodyStyle: string;
  accessory: string;
  background: string;
  expression: string;
  surfacePattern: string;
  palette: ArtworkSpec['palette'];
};

export type CollectibleOverlaySpec = {
  version: 'gutverse-overlay-v1';
  /** The AI leaves this zone blank; the deterministic renderer replaces it. */
  gutCore: 'gut-core-v1';
  accessoryBadge: 'wave-v1' | null;
  serialPlacement: 'outside-artwork';
};

export type ArtworkGenerationContract = {
  promptVersion: 'gutverse-character-base-v1';
  aiLayer: 'character-base-only';
  aiForbiddenElements: readonly ['text', 'letters', 'numbers', 'logos', 'brand-marks', 'badge-symbols', 'serials'];
  requireOcrRejection: true;
  overlay: CollectibleOverlaySpec;
};

export type CollectibleIdentity = {
  /** Stable off-chain collection namespace; can become the NFT contract collection later. */
  collectionId: 'GUTVERSE-ORIGINS';
  /** Permanent sequence number. It must never be derived from the current list position. */
  serial: number;
  displayId: string;
  generationId: string;
  dnaVersion: '1.0';
  traits: CollectibleTraits;
  renderContract: ArtworkGenerationContract;
  /** Deterministic fingerprint of the complete trait set, used for pre-generation collision checks. */
  traitFingerprint: string;
  /** Filled by the backend after an AI image is stored. */
  assetSha256?: string;
  /** Filled by the backend for near-duplicate visual checks. */
  perceptualHash?: string;
  status: 'off_chain' | 'mint_ready' | 'minted';
};

export type JournalContext = {
  hydration: 'low' | 'moderate' | 'high';
  fiber: 'low' | 'moderate' | 'high';
  sleepHours: number;
  stress: 'low' | 'moderate' | 'high';
  comfort: 'comfortable' | 'slight_strain' | 'urgent';
  note?: string;
  extraContext?: Record<string, ExtraJournalContextValue>;
};

export type PrivateAssetReference = {
  bucketId: 'originals-private' | 'artworks-private' | 'reports-private';
  objectPath: string;
};

export type JournalEntry = {
  id: string;
  createdAt: string;
  analysis: StoolAnalysis;
  artwork: ArtworkSpec;
  collectible?: CollectibleIdentity;
  originalImageUri?: string;
  originalAsset?: PrivateAssetReference;
  originalImageStatus?: 'device_private' | 'cloud_private' | 'session' | 'demo' | 'unavailable' | 'deleted';
  /** Kept optional so journals created by the earlier prototype still load. */
  photoDeleted?: boolean;
  userConfirmed: boolean;
  source?: 'capture' | 'import' | 'demo' | 'sample';
  context?: JournalContext;
};
