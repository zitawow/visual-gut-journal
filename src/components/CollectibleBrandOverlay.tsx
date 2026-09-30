import Svg, { Circle, G, Path } from 'react-native-svg';
import type { CollectibleOverlaySpec } from '../types';

type Props = {
  spec: CollectibleOverlaySpec;
  size: number;
};

/**
 * Deterministic brand layer rendered above the AI character base.
 * Filled badge backgrounds intentionally replace anything the AI may have put
 * inside the reserved zones instead of merely drawing translucent marks over it.
 */
export function CollectibleBrandOverlay({ spec, size }: Props) {
  return <Svg
    accessibilityLabel="固定的 Gutverse 品牌圖層"
    pointerEvents="none"
    width={size}
    height={size}
    viewBox="0 0 1024 1024"
  >
    <GutCoreBadge />
    {spec.accessoryBadge === 'wave-v1' ? <WaveBadge /> : null}
  </Svg>;
}

function GutCoreBadge() {
  return <G>
    <Circle cx="512" cy="737" r="87" fill="#FFD85C" stroke="#0B0B10" strokeWidth="12" />
    <Circle cx="512" cy="737" r="61" fill="#2865DC" stroke="#0B0B10" strokeWidth="8" />
    <Path
      d="M512 694 C526 700 530 711 520 720 C548 723 558 740 546 752 C536 763 488 763 478 752 C466 739 478 724 503 720 C493 713 497 701 512 694 Z M486 775 C496 784 528 784 538 775"
      fill="none"
      stroke="#F6F3EC"
      strokeWidth="12"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </G>;
}

function WaveBadge() {
  return <G>
    <Circle cx="512" cy="241" r="43" fill="#6EE7D8" stroke="#0B0B10" strokeWidth="9" />
    <Path
      d="M480 245 C495 224 515 226 527 241 C537 252 550 251 559 240 C554 264 535 276 513 270 C497 266 490 254 480 245 Z"
      fill="#2865DC"
      stroke="#0B0B10"
      strokeWidth="6"
      strokeLinejoin="round"
    />
  </G>;
}
