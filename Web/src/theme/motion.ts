import { keyframes, type SxProps, type Theme } from '@mui/material';

export const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const softPulse = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
`;

export const shimmer = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

/** Apparition décalée pour les grilles (index 0..n). */
export function staggerFadeUp(index = 0, baseDelayMs = 60): SxProps<Theme> {
  return {
    opacity: 0,
    animation: `${fadeUp} 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
    animationDelay: `${index * baseDelayMs}ms`,
  };
}

export function fadeUpSx(delayMs = 0): SxProps<Theme> {
  return {
    opacity: 0,
    animation: `${fadeUp} 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
    animationDelay: `${delayMs}ms`,
  };
}
