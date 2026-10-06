import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme/colors';

export function StokeyaGlyph({ size = 48, light = false }: { size?: number; light?: boolean }) {
  const uid = light ? 'ml' : 'md';
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id={`roof-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#60A5FA" />
          <Stop offset="1" stopColor="#1D4ED8" />
        </LinearGradient>
        <LinearGradient id={`wall-${uid}`} x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor="#3B82F6" />
          <Stop offset="1" stopColor="#1E40AF" />
        </LinearGradient>
        <LinearGradient id={`arrow-${uid}`} x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor="#22D3EE" />
          <Stop offset="1" stopColor="#22C55E" />
        </LinearGradient>
      </Defs>
      <Path d="M10 30.5 32 10l22 20.5v4.2L32 14.8 10 34.7v-4.2Z" fill={`url(#roof-${uid})`} />
      <Path
        d="M12 32.2 32 14.5l20 17.7V52.5c0 2.4-1.8 4-4.2 4H16.2c-2.4 0-4.2-1.6-4.2-4V32.2Z"
        fill={`url(#wall-${uid})`}
      />
      <Path d="M32 18.2 46.5 31.5H17.5L32 18.2Z" fill="rgba(255,255,255,0.2)" />
      <Path d="M32 27.2 42.2 33.2 32 39.2 21.8 33.2Z" fill="#E8F1FF" />
      <Path d="M21.8 33.2 32 39.2v10.4L21.8 43.6Z" fill="#1E3A8A" />
      <Path d="M32 39.2 42.2 33.2v10.4L32 49.6Z" fill="#2563EB" />
      <Rect x="45.2" y="36.5" width="3.1" height="7.2" rx="0.8" fill="#34D399" />
      <Rect x="49.2" y="32.6" width="3.1" height="11.1" rx="0.8" fill="#10B981" />
      <Rect x="53.2" y="28.2" width="3.1" height="15.5" rx="0.8" fill="#22C55E" />
      <Path
        d="M15.2 44.5c-4.6-6.4-3.4-16.2 3.8-21.6"
        fill="none"
        stroke={`url(#arrow-${uid})`}
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <Path d="M16.6 19.4 24.8 18.2 20.2 25.6Z" fill="#22C55E" />
    </Svg>
  );
}

export default function StokeyaLogo({
  size = 48,
  light = false,
  wordmark = true,
  tagline,
}: {
  size?: number;
  light?: boolean;
  wordmark?: boolean;
  tagline?: string;
}) {
  const ink = light ? '#FFFFFF' : colors.secondary;
  return (
    <View style={styles.row}>
      <StokeyaGlyph size={size} light={light} />
      {wordmark ? (
        <View style={styles.textCol}>
          <View style={styles.wordWrap}>
            <Text style={[styles.word, { color: ink, fontSize: size * 0.42 }]}>Stokeya</Text>
            <View style={[styles.accent, { width: Math.max(5, size * 0.1), height: Math.max(5, size * 0.1) }]} />
          </View>
          {tagline ? (
            <Text style={[styles.tag, { color: light ? 'rgba(248,250,252,0.72)' : colors.textMuted }]}>
              {tagline}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  textCol: { justifyContent: 'center' },
  wordWrap: { position: 'relative', paddingRight: 8 },
  word: { fontWeight: '800', letterSpacing: -0.8 },
  accent: {
    position: 'absolute',
    right: -2,
    bottom: 3,
    borderRadius: 1.5,
    backgroundColor: '#22C55E',
  },
  tag: { marginTop: 3, fontSize: 11, fontWeight: '500' },
});
