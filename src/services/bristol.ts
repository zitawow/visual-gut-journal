import type { StoolAnalysis } from '../types';

export type BristolType = StoolAnalysis['bristolType'];

export type BristolOption = {
  type: BristolType;
  title: string;
  group: string;
  description: string;
  shape: StoolAnalysis['shape'];
  texture: StoolAnalysis['texture'];
};

export const BRISTOL_OPTIONS: readonly BristolOption[] = [
  { type: 1, title: '顆粒偏乾', group: '偏乾', description: '分開的小顆粒，整體較乾。', shape: 'pellets', texture: 'dry' },
  { type: 2, title: '結實成塊', group: '偏乾', description: '連在一起但較硬，表面不太平整。', shape: 'lumpy', texture: 'firm' },
  { type: 3, title: '成形有紋', group: '成形', description: '完整成形，表面可見一些細紋。', shape: 'cracked', texture: 'firm' },
  { type: 4, title: '光滑柔順', group: '成形', description: '完整而光滑，輪廓均勻。', shape: 'smooth', texture: 'smooth' },
  { type: 5, title: '柔軟小塊', group: '偏軟', description: '分成幾個柔軟小塊，邊緣清楚。', shape: 'soft_blobs', texture: 'soft' },
  { type: 6, title: '鬆散偏軟', group: '偏軟', description: '較鬆散，邊緣不太規則。', shape: 'mushy', texture: 'soft' },
  { type: 7, title: '接近水狀', group: '較稀', description: '幾乎沒有固定形態。', shape: 'watery', texture: 'liquid' },
];

export function getBristolOption(type: BristolType) {
  return BRISTOL_OPTIONS[type - 1];
}
