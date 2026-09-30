import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import type { ArtworkSpec } from '../types';

type SeriesArtwork = {
  name: string;
  source: ImageSourcePropType;
};

const GUT_CREATURE_SERIES_01: readonly SeriesArtwork[] = [
  { name: 'Crystal Explorer', source: require('../../assets/gut-creatures/01-crystal-explorer.jpg') },
  { name: 'Mint Visor', source: require('../../assets/gut-creatures/02-mint-visor.jpg') },
  { name: 'Aqua Runner', source: require('../../assets/gut-creatures/03-aqua-runner.jpg') },
  { name: 'Coral Shades', source: require('../../assets/gut-creatures/04-coral-shades.jpg') },
  { name: 'Orange Headband', source: require('../../assets/gut-creatures/05-orange-headband.jpg') },
  { name: 'Lime Cap', source: require('../../assets/gut-creatures/06-lime-cap.jpg') },
  { name: 'Lilac Headphones', source: require('../../assets/gut-creatures/07-lilac-headphones.jpg') },
  { name: 'Cosmic Visor', source: require('../../assets/gut-creatures/08-cosmic-visor.jpg') },
];

function getSeriesArtwork(spec: ArtworkSpec, serial?: number) {
  const stableNumber = serial && serial > 0 ? serial - 1 : spec.seed;
  return GUT_CREATURE_SERIES_01[Math.abs(stableNumber) % GUT_CREATURE_SERIES_01.length];
}

export function Artwork({ spec, size = 260, serial }: { spec: ArtworkSpec; size?: number; serial?: number }) {
  const curatedArtwork = getSeriesArtwork(spec, serial);
  const source: ImageSourcePropType = spec.generatedImageUri ? { uri: spec.generatedImageUri } : curatedArtwork.source;

  return <View style={[styles.frame, { width: size, height: size, borderRadius: Math.max(12, size * .105) }]}>
    <Image
      accessibilityLabel={`Gut Creature 收藏作品：${curatedArtwork.name}`}
      resizeMode="cover"
      source={source}
      style={styles.image}
    />
  </View>;
}

const styles = StyleSheet.create({
  frame: { backgroundColor: '#17171F', overflow: 'hidden' },
  image: { height: '100%', width: '100%' },
});
