import type { JournalEntry, StoolAnalysis } from '../types';
import { createArtworkSpec } from '../services/analysis/provider';

const SAMPLE_BLUEPRINTS: Array<{
  dayOffset: number;
  analysis: StoolAnalysis;
  context: NonNullable<JournalEntry['context']>;
}> = [
  {
    dayOffset: 0,
    analysis: { bristolType: 4, color: 'medium_brown', shape: 'smooth', texture: 'smooth', confidence: 0.94, confidenceBand: 'high', requiresRetake: false, provider: 'sample-reviewed-v1' },
    context: { hydration: 'high', fiber: 'moderate', sleepHours: 7.5, stress: 'low', comfort: 'comfortable', note: '早餐後自然排便，狀態穩定。' },
  },
  {
    dayOffset: 1,
    analysis: { bristolType: 3, color: 'dark_brown', shape: 'cracked', texture: 'firm', confidence: 0.89, confidenceBand: 'high', requiresRetake: false, provider: 'sample-reviewed-v1' },
    context: { hydration: 'moderate', fiber: 'moderate', sleepHours: 6.5, stress: 'moderate', comfort: 'slight_strain', note: '工作較忙，喝水比平常少。' },
  },
  {
    dayOffset: 2,
    analysis: { bristolType: 4, color: 'light_brown', shape: 'smooth', texture: 'smooth', confidence: 0.92, confidenceBand: 'high', requiresRetake: false, provider: 'sample-reviewed-v1' },
    context: { hydration: 'high', fiber: 'high', sleepHours: 8, stress: 'low', comfort: 'comfortable', note: '蔬菜與水果較多的一天。' },
  },
  {
    dayOffset: 4,
    analysis: { bristolType: 5, color: 'medium_brown', shape: 'soft_blobs', texture: 'soft', confidence: 0.84, confidenceBand: 'medium', requiresRetake: false, provider: 'sample-reviewed-v1' },
    context: { hydration: 'moderate', fiber: 'high', sleepHours: 7, stress: 'moderate', comfort: 'urgent', note: '午餐較油，排便時間比平常早。' },
  },
  {
    dayOffset: 6,
    analysis: { bristolType: 2, color: 'dark_brown', shape: 'lumpy', texture: 'firm', confidence: 0.81, confidenceBand: 'medium', requiresRetake: false, provider: 'sample-reviewed-v1' },
    context: { hydration: 'low', fiber: 'low', sleepHours: 5.5, stress: 'high', comfort: 'slight_strain', note: '睡眠不足，整天喝水不多。' },
  },
];

export function createSampleEntries(referenceDate = new Date()): JournalEntry[] {
  return SAMPLE_BLUEPRINTS.map((blueprint, index) => {
    const createdAt = new Date(referenceDate);
    createdAt.setDate(createdAt.getDate() - blueprint.dayOffset);
    createdAt.setHours(8 + index, 12 + index * 3, 0, 0);
    const id = `sample-${String(index + 1).padStart(2, '0')}`;
    return {
      id,
      createdAt: createdAt.toISOString(),
      analysis: blueprint.analysis,
      artwork: createArtworkSpec(blueprint.analysis, id),
      originalImageStatus: 'demo',
      userConfirmed: true,
      source: 'sample',
      context: blueprint.context,
    };
  });
}
