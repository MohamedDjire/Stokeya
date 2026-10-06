import Grid from '@mui/material/Grid2';
import {
  Alert, Box, Button, Chip, IconButton, Stack, Typography, alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import type { ShopInfo, ShopProduct } from '../../api/shop';
import { formatCurrency, formatNumber } from '../../utils/format';
import { shopImageUrl, unitPrice } from './utils';
import { SHOP, shopPlaceholderBg, shopPrimary, shopSecondary } from './shopTheme';
import { useLocale } from '../../locale/useLocale';

interface Props {
  shop: ShopInfo;
  products: ShopProduct[];
  categories: Array<{ id: number; name: string }>;
  categoryId: number | '';
  onCategoryChange: (id: number | '') => void;
  qtys: Record<number, number>;
  onQtyChange: (productId: number, qty: number) => void;
  onAddToCart: (product: ShopProduct, qty?: number) => void;
}

export default function ShopCatalog({
  shop, products, categories, categoryId, onCategoryChange, qtys, onQtyChange, onAddToCart,
}: Props) {
  const { tr, version } = useLocale();
  void version;
  const primary = shopPrimary(shop.primary_color);
  const accent = shopSecondary(shop.secondary_color);

  return (
    <>
      <Stack direction="row" spacing={0.75} sx={{ mb: 2.5, flexWrap: 'wrap' }} useFlexGap>
        <Chip
          size="small"
          label={tr('Toutes')}
          onClick={() => onCategoryChange('')}
          sx={{
            fontWeight: 600, height: 28, borderRadius: 1.5,
            ...(categoryId === '' ? { bgcolor: primary, color: '#fff', '&:hover': { bgcolor: primary } } : {}),
          }}
        />
        {categories.map((c) => (
          <Chip
            key={c.id}
            size="small"
            label={tr(c.name)}
            onClick={() => onCategoryChange(c.id)}
            sx={{
              fontWeight: 600, height: 28, borderRadius: 1.5,
              ...(categoryId === c.id ? { bgcolor: primary, color: '#fff', '&:hover': { bgcolor: primary } } : {}),
            }}
          />
        ))}
      </Stack>

      <Grid container spacing={{ xs: 1.25, md: 1.75 }}>
        {products.map((p) => {
          const status = p.stock_status
            || (p.stock_available != null && p.stock_available <= 0
              ? 'out_of_stock'
              : p.stock_available != null
                && p.min_stock != null
                && p.min_stock > 0
                && p.stock_available <= p.min_stock
                ? 'low'
                : 'ok');
          const out = status === 'out_of_stock' || p.in_stock === false;
          const low = !out && status === 'low';
          const qty = qtys[p.id] ?? 1;
          const price = unitPrice(p, qty);
          const retail = Number(p.price || 0);
          const wholesale = Number(p.wholesale_price || 0);
          const hasWholesale = wholesale > 0;
          const img = shopImageUrl(p.image);
          const saveAmount = hasWholesale && retail > wholesale ? retail - wholesale : 0;

          return (
            <Grid key={p.id} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
              <Box
                sx={{
                  height: '100%',
                  bgcolor: '#fff',
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: alpha(SHOP.cyan, 0.18),
                  boxShadow: `0 2px 10px ${alpha(SHOP.ink, 0.06)}`,
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  opacity: out ? 0.72 : 1,
                  '&:hover': {
                    boxShadow: `0 10px 28px ${alpha(SHOP.ink, 0.14)}`,
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                {/* Image carrée + bouton Acheter */}
                <Box
                  sx={{
                    position: 'relative',
                    aspectRatio: '1 / 1',
                    bgcolor: img ? '#EEF6F8' : undefined,
                    background: img ? undefined : shopPlaceholderBg(primary),
                  }}
                >
                  {img ? (
                    <Box
                      component="img"
                      src={img}
                      alt={p.name}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.75,
                        px: 1,
                      }}
                    >
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 2,
                          bgcolor: alpha('#fff', 0.2),
                          border: `1px solid ${alpha('#fff', 0.35)}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Inventory2OutlinedIcon sx={{ fontSize: 28, color: alpha('#fff', 0.95) }} />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{ color: alpha('#fff', 0.9), fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}
                      >
                        {tr('Sans image')}
                      </Typography>
                    </Box>
                  )}

                  {out && (
                    <Chip
                      label={tr('Rupture')}
                      size="small"
                      sx={{
                        position: 'absolute', top: 8, left: 8, height: 22, fontSize: '0.7rem', fontWeight: 700,
                        bgcolor: '#C62828', color: '#fff',
                      }}
                    />
                  )}
                  {low && !out && (
                    <Chip
                      label={tr('Stock faible')}
                      size="small"
                      sx={{
                        position: 'absolute', top: 8, left: 8, height: 22, fontSize: '0.7rem', fontWeight: 700,
                        bgcolor: '#E65100', color: '#fff',
                      }}
                    />
                  )}
                </Box>

                <Box sx={{ px: 1.25, pt: 1, pb: 1.25 }}>
                  {/* Badges type AliExpress */}
                  <Stack direction="row" spacing={0.5} sx={{ mb: 0.75, minHeight: 22, flexWrap: 'wrap' }} useFlexGap>
                    {hasWholesale && (
                      <Chip
                        label={tr('Gros')}
                        size="small"
                        sx={{
                          height: 20, fontSize: '0.65rem', fontWeight: 800, borderRadius: 0.75,
                          bgcolor: '#FFE566', color: '#111',
                        }}
                      />
                    )}
                    {p.category_name && (
                      <Chip
                        label={tr(p.category_name)}
                        size="small"
                        variant="outlined"
                        sx={{ height: 20, fontSize: '0.65rem', borderRadius: 0.75, maxWidth: 90 }}
                      />
                    )}
                  </Stack>

                  <Typography
                    title={p.name}
                    sx={{
                      fontSize: '0.82rem',
                      fontWeight: 500,
                      lineHeight: 1.3,
                      color: '#191919',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      minHeight: '2.2em',
                      mb: 0.5,
                    }}
                  >
                    {p.name}
                  </Typography>

                  {shop.show_prices && (
                    <Typography
                      sx={{
                        fontSize: { xs: '1rem', sm: '1.1rem' },
                        fontWeight: 800,
                        color: '#191919',
                        lineHeight: 1.2,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {formatCurrency(price)}
                    </Typography>
                  )}

                  {shop.show_prices && saveAmount > 0 && qty < Number(p.wholesale_min_qty || 10) && (
                    <Typography sx={{ fontSize: '0.72rem', color: accent, fontWeight: 600, mt: 0.25 }}>
                      {formatCurrency(wholesale)} {tr('dès')} {Number(p.wholesale_min_qty || 10)} {tr(p.packaging || 'unités')}
                    </Typography>
                  )}

                  <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    {shop.show_stock ? (
                      <Typography sx={{ fontSize: '0.7rem' }}>
                        {out ? tr('Indisponible') : tr(`${p.stock_available ?? 0} vendus dispo.`)}
                      </Typography>
                    ) : (
                      <Typography sx={{ fontSize: '0.7rem' }}>{p.sku || (p.packaging ? tr(p.packaging) : '—')}</Typography>
                    )}
                  </Stack>

                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.35, color: 'text.secondary' }}>
                    <LocalShippingOutlinedIcon sx={{ fontSize: 14 }} />
                    <Typography sx={{ fontSize: '0.68rem' }}>{tr('Livraison ou retrait')}</Typography>
                  </Stack>

                  {/* Quantité + Acheter */}
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1 }}>
                    <IconButton
                      size="small"
                      disabled={out}
                      onClick={() => onQtyChange(p.id, Math.max(1, qty - 1))}
                      sx={{ p: 0.3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                    >
                      <RemoveIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <Box
                      sx={{
                        minWidth: 28, textAlign: 'center', fontWeight: 700, fontSize: '0.8rem',
                      }}
                    >
                      {formatNumber(qty)}
                    </Box>
                    <IconButton
                      size="small"
                      disabled={out}
                      onClick={() => onQtyChange(p.id, qty + 1)}
                      sx={{ p: 0.3, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
                    >
                      <AddIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <Button
                      size="small"
                      disabled={out}
                      onClick={() => onAddToCart(p)}
                      sx={{
                        ml: 'auto',
                        textTransform: 'none',
                        fontWeight: 800,
                        fontSize: '0.75rem',
                        px: 1.25,
                        minWidth: 0,
                        borderRadius: 1.5,
                        bgcolor: primary,
                        color: '#fff',
                        boxShadow: 'none',
                        '&:hover': { bgcolor: primary, filter: 'brightness(0.92)', boxShadow: 'none' },
                      }}
                    >
                      {tr('Acheter')}
                    </Button>
                  </Stack>
                </Box>
              </Box>
            </Grid>
          );
        })}
        {products.length === 0 && (
          <Grid size={12}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              {tr('Aucun produit ne correspond à votre recherche. Essayez un autre mot-clé ou parcourez toutes les catégories.')}
            </Alert>
          </Grid>
        )}
      </Grid>
    </>
  );
}
