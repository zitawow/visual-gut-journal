import { z } from 'zod';
import type { ArtworkSpec, StoolAnalysis } from '../../types';

const analysisSchema = z.object({
  bristolType: z.number().int().min(1).max(7),
  color: z.enum(['light_brown', 'medium_brown', 'dark_brown', 'yellow', 'green', 'black', 'red', 'clay', 'other']),
  shape: z.enum(['pellets', 'lumpy', 'cracked', 'smooth', 'soft_blobs', 'mushy', 'watery', 'uncertain']),
  texture: z.enum(['dry', 'firm', 'smooth', 'soft', 'liquid', 'uncertain']),
  confidence: z.number().min(0).max(1),
  confidenceBand: z.enum(['high', 'medium', 'low']),
  requiresRetake: z.boolean(),
  provider: z.string(),
  modelName: z.string().optional(),
  modelVersion: z.string().optional(),
  promptVersion: z.string().optional(),
  analysisVersion: z.string().optional(),
});

export interface StoolAnalysisProvider {
  analyze(imageUri: string): Promise<StoolAnalysis>;
}

export class MockStoolAnalysisProvider implements StoolAnalysisProvider {
  async analyze(imageUri: string): Promise<StoolAnalysis> {
    await new Promise((resolve) => setTimeout(resolve, 1450));
    const seed = [...imageUri].reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const type = ((seed % 5) + 2) as 2 | 3 | 4 | 5 | 6;
    const shapes = { 2: 'lumpy', 3: 'cracked', 4: 'smooth', 5: 'soft_blobs', 6: 'mushy' } as const;
    const textures = { 2: 'firm', 3: 'firm', 4: 'smooth', 5: 'soft', 6: 'soft' } as const;

    return analysisSchema.parse({
      bristolType: type,
      color: seed % 3 === 0 ? 'light_brown' : seed % 3 === 1 ? 'medium_brown' : 'dark_brown',
      shape: shapes[type],
      texture: textures[type],
      confidence: 0.87,
      confidenceBand: 'high',
      requiresRetake: false,
      provider: 'mock-v1',
    }) as StoolAnalysis;
  }
}

export const createArtworkSpec = (analysis: StoolAnalysis, id: string): ArtworkSpec => {
  let seed = 0x811c9dc5;
  for (const char of id) {
    seed ^= char.charCodeAt(0);
    seed = Math.imul(seed, 0x01000193);
  }
  seed >>>= 0;
  const form = analysis.bristolType <= 2 ? 'mineral' : analysis.bristolType <= 4 ? 'ribbon' : analysis.bristolType <= 6 ? 'petal' : 'liquid';
  const palette = analysis.color === 'light_brown' ? 'amber' : analysis.color === 'dark_brown' ? 'moss' : 'clay';
  return {
    engineVersion: '1.0',
    seed,
    form,
    palette,
    fluidity: analysis.bristolType / 7,
    complexity: Math.min(1, 0.24 + analysis.bristolType * 0.09),
  };
};

// This provider is only used by the public/device Demo flow. Authenticated
// captures are analyzed by the protected Supabase analyze-stool Edge Function.
export const analysisProvider: StoolAnalysisProvider = new MockStoolAnalysisProvider();
