# Gutverse collectible uniqueness

The product is off-chain today. These rules preserve a clean path to a future NFT collection without putting health data or original photos on-chain.

## Uniqueness is four different checks

1. **Identity uniqueness** — one immutable `generationId`; the production database owns the global collection serial.
2. **Trait uniqueness** — `traitFingerprint` is calculated from the complete visual DNA. A database unique constraint rejects collisions before generation.
3. **Exact-file uniqueness** — calculate SHA-256 after storing the final image. A duplicate hash is rejected.
4. **Visual uniqueness** — calculate a perceptual hash or image embedding. Reject and regenerate when a new image is too similar to an existing piece even if its bytes differ.

A random seed alone is not a uniqueness guarantee. An image model can create similar-looking results from different seeds, and two different files can contain effectively the same picture.

## Production generation transaction

1. The server creates a pending generation and reserves its global serial.
2. It selects a trait DNA and inserts its fingerprint under a unique database constraint.
3. It generates the image using the stored model, prompt template version, seed, and traits.
4. It saves the original generated asset to permanent object storage.
5. It calculates SHA-256 and a perceptual hash.
6. Exact or near collision: mark the attempt rejected, change the DNA nonce, and retry.
7. Pass: store immutable metadata and mark the piece `mint_ready` or leave it `off_chain`.

## Stable hybrid rendering contract

AI is allowed to generate only the large character base: head shape, material, face, clothing silhouette, pose, lighting, and background. It is explicitly forbidden from generating text, letters, numbers, signatures, serials, logos, brand marks, or badge symbols.

The base prompt reserves a blank circular area at the upper chest and, when needed, a second blank area on a headband. The final renderer first covers these areas with an opaque, geometrically exact badge and then draws the versioned Gut Core or wave SVG above it. Because the replacement layer is opaque, malformed AI details underneath cannot remain visible.

The collectible serial and every other piece of typography stay outside the artwork bitmap in the app UI. A future export or mint worker must composite them using the same deterministic overlay specification rather than sending them back through an image model.

Prompt version: `gutverse-character-base-v1`
Overlay version: `gutverse-overlay-v1`

After generation, the server must reject an image if OCR detects any text outside the reserved replacement zones or if an unexpected logo is detected. This validation is mandatory even when the prompt says “no text,” because prompting alone is not an enforcement boundary.

Serial reservation and trait insertion must happen on the server in a database transaction. Client-only numbering cannot guarantee uniqueness across devices or simultaneous users.

## Minimum database constraints

```sql
create unique index collectibles_collection_serial_unique
  on collectibles (collection_id, serial);

create unique index collectibles_trait_fingerprint_unique
  on collectibles (collection_id, dna_version, trait_fingerprint);

create unique index collectibles_asset_sha256_unique
  on collectibles (asset_sha256)
  where asset_sha256 is not null;

create unique index collectibles_generation_id_unique
  on collectibles (generation_id);
```

Perceptual similarity is a distance comparison rather than a normal unique constraint. Run it in the generation worker before publication.

## Metadata to keep from day one

- collection ID and serial
- generation ID and owning user ID
- DNA and DNA version
- analysis-to-art mapping version
- prompt template version, model, provider, and seed
- final asset URL, MIME type, width, and height
- SHA-256 and perceptual hash
- generation attempts, cost, timestamps, and status
- consent scope for sharing or minting

Do not place the original stool photo, Bristol analysis, notes, dates, user identity, or other health-adjacent data in public NFT metadata. On-chain data is effectively irreversible; only the derived artwork and deliberately public collectible traits should be eligible for minting after separate opt-in consent.

## Current prototype boundary

The app currently provides stable local serials, generation IDs, trait DNA, collision retries, and fingerprints. `assetSha256` and `perceptualHash` are already represented in the data model but remain empty until the AI image backend stores a final file. Global serial reservation and cross-user collision checks begin when Supabase/server generation is connected.
