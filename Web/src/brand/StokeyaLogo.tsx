import { Box, Stack, Typography } from '@mui/material';

/** Emblème : entrepôt + colis + croissance */
export function StokeyaGlyph({
  size = 40,
  light = false,
}: {
  size?: number;
  light?: boolean;
}) {
  const uid = light ? 'l' : 'd';
  return (
    <Box
      component="svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      sx={{
        flexShrink: 0,
        display: 'block',
        filter: light ? 'drop-shadow(0 4px 12px rgba(56,189,248,0.28))' : 'drop-shadow(0 4px 10px rgba(29,78,216,0.22))',
      }}
    >
      <defs>
        <linearGradient id={`roof-${uid}`} x1="8" y1="8" x2="56" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#60A5FA" />
          <stop offset="1" stopColor="#1D4ED8" />
        </linearGradient>
        <linearGradient id={`wall-${uid}`} x1="12" y1="24" x2="52" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3B82F6" />
          <stop offset="1" stopColor="#1E40AF" />
        </linearGradient>
        <linearGradient id={`arrow-${uid}`} x1="6" y1="52" x2="58" y2="10" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22D3EE" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
      </defs>
      <path
        d="M10 30.5 32 10l22 20.5v4.2L32 14.8 10 34.7v-4.2Z"
        fill={`url(#roof-${uid})`}
      />
      <path
        d="M12 32.2 32 14.5l20 17.7V52.5c0 2.4-1.8 4-4.2 4H16.2c-2.4 0-4.2-1.6-4.2-4V32.2Z"
        fill={`url(#wall-${uid})`}
      />
      <path d="M32 18.2 46.5 31.5H17.5L32 18.2Z" fill={light ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.18)'} />
      {/* cube isométrique */}
      <path d="M32 27.2 42.2 33.2 32 39.2 21.8 33.2Z" fill="#E8F1FF" />
      <path d="M21.8 33.2 32 39.2v10.4L21.8 43.6Z" fill="#1E3A8A" />
      <path d="M32 39.2 42.2 33.2v10.4L32 49.6Z" fill="#2563EB" />
      {/* barres de croissance */}
      <rect x="45.2" y="36.5" width="3.1" height="7.2" rx="0.8" fill="#34D399" />
      <rect x="49.2" y="32.6" width="3.1" height="11.1" rx="0.8" fill="#10B981" />
      <rect x="53.2" y="28.2" width="3.1" height="15.5" rx="0.8" fill="#22C55E" />
      {/* flèche orbitale */}
      <path
        d="M15.2 44.5c-4.6-6.4-3.4-16.2 3.8-21.6"
        fill="none"
        stroke={`url(#arrow-${uid})`}
        strokeWidth="3.1"
        strokeLinecap="round"
      />
      <path d="M16.6 19.4 24.8 18.2 20.2 25.6Z" fill="#22C55E" />
    </Box>
  );
}

export function StokeyaMark({
  size = 40,
  light = false,
  wordmark = true,
  tagline,
}: {
  size?: number;
  light?: boolean;
  wordmark?: boolean;
  tagline?: string;
}) {
  const ink = light ? '#FFFFFF' : '#0B1F3A';
  const muted = light ? 'rgba(248,250,252,0.7)' : '#64748B';
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <StokeyaGlyph size={size} light={light} />
      {wordmark && (
        <Box sx={{ lineHeight: 1 }}>
          <Typography
            component="span"
            sx={{
              position: 'relative',
              display: 'inline-block',
              fontFamily: '"Outfit", "Segoe UI", sans-serif',
              fontWeight: 800,
              fontSize: size * 0.5,
              letterSpacing: '-0.04em',
              color: ink,
              lineHeight: 1,
              pr: 0.9,
            }}
          >
            Stokeya
            <Box
              component="span"
              sx={{
                position: 'absolute',
                right: 0,
                bottom: size * 0.04,
                width: Math.max(5, size * 0.12),
                height: Math.max(5, size * 0.12),
                borderRadius: 0.4,
                bgcolor: '#22C55E',
              }}
            />
          </Typography>
          {tagline ? (
            <Typography
              sx={{
                mt: 0.4,
                fontSize: Math.max(10, size * 0.22),
                color: muted,
                fontFamily: '"Outfit", sans-serif',
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              {tagline}
            </Typography>
          ) : null}
        </Box>
      )}
    </Stack>
  );
}
