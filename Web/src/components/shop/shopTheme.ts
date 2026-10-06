/** Palette boutique — cyan / teal (entre bleu et vert) */
export const SHOP = {
  primary: '#0E8A9A',
  primaryDark: '#0C6B7A',
  primaryDeep: '#0A5563',
  cyan: '#0891B2',
  sky: '#0284C7',
  mint: '#5EEAD4',
  ice: '#E0F7FA',
  mist: '#F0FDFA',
  /** Fond page — teal bleuté, clairement distinct du blanc des cartes */
  page: '#D5EEF2',
  pageDeep: '#B8E0E8',
  navy: '#0B2A3A',
  ink: '#0A1F2E',
};

export function shopPrimary(custom?: string | null) {
  return custom || SHOP.primary;
}

export function shopSecondary(custom?: string | null) {
  return custom || SHOP.navy;
}

export function shopHeroGradient(primary: string, secondary: string) {
  return `linear-gradient(125deg, ${SHOP.cyan} 0%, ${primary} 42%, ${secondary} 100%)`;
}

/** Fond global de la boutique (dégradé + texture légère) */
export function shopPageBackground() {
  return {
    backgroundColor: SHOP.page,
    backgroundImage: `
      radial-gradient(ellipse 90% 70% at 0% 0%, rgba(8,145,178,0.22) 0%, transparent 55%),
      radial-gradient(ellipse 80% 60% at 100% 100%, rgba(14,138,154,0.28) 0%, transparent 50%),
      radial-gradient(ellipse 50% 40% at 70% 20%, rgba(2,132,199,0.12) 0%, transparent 45%),
      linear-gradient(165deg, ${SHOP.pageDeep} 0%, ${SHOP.page} 45%, #C5E8EF 100%)
    `,
    backgroundAttachment: 'fixed',
  };
}

/** Zone image produit sans photo */
export function shopPlaceholderBg(primary: string) {
  return `linear-gradient(145deg, ${primary} 0%, ${SHOP.cyan} 48%, ${SHOP.primaryDeep} 100%)`;
}
