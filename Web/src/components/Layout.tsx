import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Popover,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import DashboardIcon from '@mui/icons-material/DashboardOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import WarehouseIcon from '@mui/icons-material/WarehouseOutlined';
import PeopleIcon from '@mui/icons-material/PeopleAltOutlined';
import LocalShippingIcon from '@mui/icons-material/LocalShippingOutlined';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCartOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import BarChartIcon from '@mui/icons-material/BarChartOutlined';
import WorkspacePremiumIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import GroupIcon from '@mui/icons-material/GroupOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import CategoryIcon from '@mui/icons-material/CategoryOutlined';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LabelIcon from '@mui/icons-material/LabelOutlined';
import TimelineIcon from '@mui/icons-material/TimelineOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBagOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/PersonOutline';
import NotificationsIcon from '@mui/icons-material/NotificationsOutlined';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logoutThunk } from '../store/authSlice';
import { canAccessNavItem, hasFlag, hasModuleAccess } from '../utils/permissions';
import { fetchSubscription, type Subscription } from '../api/subscription';
import { FEATURE_ONLINE_SHOP, hasPlanFeature } from '../utils/planFeatures';
import { fetchPendingShopOrdersCount } from '../api/shop';
import { fetchStockAlertsSummary } from '../api/stock';
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from '../api/notifications';
import { formatDate, formatNumber, localizeDigits } from '../utils/format';
import { useLocale } from '../locale/useLocale';
import { StokeyaMark } from '../brand/StokeyaLogo';
import { fadeIn } from '../theme/motion';

const DRAWER_WIDTH = 260;
const POLL_MS = 30000;

interface NavItem {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  module?: string;
  adminOnly?: boolean;
  sectionKey?: string;
  planFeature?: string;
  flag?: string;
  hideForCashier?: boolean;
  badgeKey?: 'pendingOrders' | 'stockAlerts' | 'subscription';
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'dashboard', path: '/', icon: <DashboardIcon />, sectionKey: 'Principal' },
  { labelKey: 'pos', path: '/pos', icon: <PointOfSaleIcon />, module: 'sales', flag: 'can_sell', sectionKey: 'Ventes' },
  { labelKey: 'sales', path: '/sales', icon: <ReceiptLongIcon />, module: 'sales', sectionKey: 'Ventes' },
  { labelKey: 'products', path: '/products', icon: <InventoryIcon />, module: 'products', hideForCashier: true, sectionKey: 'Catalogue' },
  { labelKey: 'categories', path: '/categories', icon: <CategoryIcon />, module: 'products', hideForCashier: true, sectionKey: 'Catalogue' },
  { labelKey: 'labels', path: '/labels', icon: <LabelIcon />, module: 'products', hideForCashier: true, sectionKey: 'Catalogue' },
  { labelKey: 'sites', path: '/sites', icon: <StorefrontIcon />, module: 'stock', hideForCashier: true, sectionKey: 'Stock' },
  { labelKey: 'scan', path: '/scan', icon: <QrCodeScannerIcon />, module: 'stock', flag: 'can_modify_stock', hideForCashier: true, sectionKey: 'Stock' },
  { labelKey: 'traceability', path: '/traceability', icon: <TimelineIcon />, module: 'stock', hideForCashier: true, sectionKey: 'Stock' },
  { labelKey: 'requests', path: '/requests', icon: <AssignmentIcon />, flag: 'can_request_stock', sectionKey: 'Stock' },
  { labelKey: 'transfers', path: '/transfers', icon: <SwapHorizIcon />, module: 'stock', flag: 'can_transfer', hideForCashier: true, sectionKey: 'Stock' },
  {
    labelKey: 'orders', path: '/orders', icon: <ShoppingBagIcon />,
    module: 'sales', sectionKey: 'Ventes', planFeature: FEATURE_ONLINE_SHOP, badgeKey: 'pendingOrders',
    hideForCashier: true,
  },
  { labelKey: 'stock', path: '/stock', icon: <WarehouseIcon />, module: 'stock', hideForCashier: true, sectionKey: 'Stock', badgeKey: 'stockAlerts' },
  { labelKey: 'customers', path: '/customers', icon: <PeopleIcon />, module: 'customers', sectionKey: 'Relations' },
  { labelKey: 'suppliers', path: '/suppliers', icon: <LocalShippingIcon />, module: 'suppliers', flag: 'can_view_purchases', hideForCashier: true, sectionKey: 'Relations' },
  { labelKey: 'purchases', path: '/purchases', icon: <ShoppingCartIcon />, module: 'purchases', flag: 'can_view_purchases', hideForCashier: true, sectionKey: 'Finance' },
  { labelKey: 'expenses', path: '/expenses', icon: <PaymentsIcon />, module: 'accounting', flag: 'can_view_expenses', hideForCashier: true, sectionKey: 'Finance' },
  { labelKey: 'reports', path: '/reports', icon: <BarChartIcon />, flag: 'can_view_profit', hideForCashier: true, sectionKey: 'Analyse' },
  { labelKey: 'users', path: '/users', icon: <GroupIcon />, adminOnly: true, sectionKey: 'Administration' },
  { labelKey: 'preferences', path: '/preferences', icon: <SettingsIcon />, flag: 'can_edit_settings', sectionKey: 'Administration' },
  { labelKey: 'subscription', path: '/subscription', icon: <WorkspacePremiumIcon />, flag: 'can_edit_settings', sectionKey: 'Administration', badgeKey: 'subscription' },
];

const SECTION_KEYS = ['Principal', 'Ventes', 'Catalogue', 'Stock', 'Relations', 'Finance', 'Analyse', 'Administration'];

export default function Layout() {
  const theme = useTheme();
  const { t, tr, version, currency: activeCurrency, rtl } = useLocale();
  void version;
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const drawerAnchor = rtl ? 'right' : 'left';
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchor, setNotifAnchor] = useState<null | HTMLElement>(null);
  const [planFeatures, setPlanFeatures] = useState<string[]>([]);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [stockAlerts, setStockAlerts] = useState(0);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const canSeeOrders =
    hasModuleAccess(user?.permissions, 'sales')
    && hasPlanFeature(planFeatures, FEATURE_ONLINE_SHOP);
  const canSeeStock = hasModuleAccess(user?.permissions, 'stock');
  const subscriptionAlert = Boolean(subscription?.expiring_soon || (subscription && !subscription.is_valid));

  const subscriptionBannerMessage = (() => {
    if (!subscription) return '';
    const days = subscription.days_remaining;
    const name = subscription.plan_name;
    const end = formatDate(subscription.end_date);
    if (!subscription.is_valid || (days != null && days < 0)) {
      return tr(`Votre abonnement ${name} a expiré. Renouvelez maintenant pour continuer — vos données sont conservées.`);
    }
    if (days != null && days <= 3) {
      return tr(`Attention ! Votre abonnement ${name} expire dans ${days} jour(s) (le ${end}).`);
    }
    if (days != null && days <= 7) {
      return tr(`Plus que ${days} jour(s) avant expiration de ${name} (le ${end}).`);
    }
    if (days != null && days <= 15) {
      return tr(`Votre abonnement expire dans ${days} jour(s) (le ${end}). Pensez à renouveler.`);
    }
    return tr(`Votre abonnement ${name} arrive à échéance le ${end}.`);
  })();

  const refreshBadges = useCallback(async () => {
    try {
      const unread = await fetchUnreadNotificationCount();
      setUnreadCount(unread);
    } catch {
      /* ignore */
    }
    try {
      const sub = await fetchSubscription();
      setSubscription(sub);
      setPlanFeatures(sub.features || []);
    } catch {
      setSubscription(null);
    }
    if (canSeeOrders) {
      try {
        setPendingOrders(await fetchPendingShopOrdersCount());
      } catch {
        setPendingOrders(0);
      }
    } else {
      setPendingOrders(0);
    }
    if (canSeeStock) {
      try {
        const summary = await fetchStockAlertsSummary();
        setStockAlerts(summary.count || 0);
      } catch {
        setStockAlerts(0);
      }
    } else {
      setStockAlerts(0);
    }
  }, [canSeeOrders, canSeeStock]);

  useEffect(() => {
    if (!user) return;
    void refreshBadges();
    const id = window.setInterval(() => { void refreshBadges(); }, POLL_MS);
    return () => window.clearInterval(id);
  }, [user, refreshBadges, location.pathname]);

  const openNotifications = async (el: HTMLElement) => {
    setNotifAnchor(el);
    try {
      const rows = await fetchNotifications();
      setNotifications(rows.slice(0, 30));
    } catch {
      setNotifications([]);
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (!n.is_read) {
      try {
        await markNotificationRead(n.id);
        setUnreadCount((c) => Math.max(0, c - 1));
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      } catch {
        /* ignore */
      }
    }
    setNotifAnchor(null);
    const link = (n.data?.link as string) || (n.notification_type === 'shop_order' ? '/orders' : '');
    if (link) navigate(link);
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch {
      /* ignore */
    }
  };

  const initials = (user?.full_name || user?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const avatarSrc = user?.avatar || user?.company_logo || undefined;

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!canAccessNavItem(user, {
      module: item.module,
      adminOnly: item.adminOnly,
      flag: item.flag,
      hideForCashier: item.hideForCashier,
    })) return false;
    if (item.planFeature && !hasPlanFeature(planFeatures, item.planFeature)) return false;
    return true;
  });

  const go = (path: string) => {
    navigate(path);
    if (isMobile) setMobileOpen(false);
  };

  const handleLogout = async () => {
    setAnchorEl(null);
    await dispatch(logoutThunk());
    navigate('/login');
  };

  const badgeFor = (item: NavItem) => {
    if (item.badgeKey === 'pendingOrders' && pendingOrders > 0) return pendingOrders;
    if (item.badgeKey === 'stockAlerts' && stockAlerts > 0) return stockAlerts;
    if (item.badgeKey === 'subscription' && subscriptionAlert) return 1;
    return 0;
  };

  const showCountPill = (item: NavItem, badge: number) =>
    item.badgeKey === 'pendingOrders' && badge > 0;

  const drawer = (
    <Box
      dir={rtl ? 'rtl' : 'ltr'}
      sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#FAFBFC' }}
    >
      <Toolbar
        sx={{
          px: 2,
          py: 1.5,
          minHeight: 72,
          bgcolor: '#FAFBFC',
          backgroundImage: 'linear-gradient(180deg, #FFFFFF 0%, #F3FAF8 100%)',
        }}
      >
        <StokeyaMark size={34} tagline={t('common.commercialMgmt')} />
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, px: 1.5, py: 1.5, overflow: 'auto' }}>
        {SECTION_KEYS.map((section) => {
          const sectionItems = visibleItems.filter((i) => i.sectionKey === section);
          if (!sectionItems.length) return null;
          return (
            <Box key={section} sx={{ mb: 1 }}>
              <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', px: 1 }}>
                {t(`nav.section.${section}`)}
              </ListSubheader>
              {sectionItems.map((item) => {
                const active =
                  item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                const badge = badgeFor(item);
                return (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => go(item.path)}
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.25,
                      py: 0.75,
                      transition: 'background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
                      '&:hover': {
                        bgcolor: 'rgba(13,148,136,0.08)',
                      },
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: '#fff',
                        boxShadow: '0 6px 16px rgba(13,148,136,0.35)',
                        '& .MuiListItemIcon-root': { color: '#fff' },
                        '& .MuiBadge-badge': { border: '1px solid #fff' },
                        '&:hover': { bgcolor: 'primary.dark' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Badge
                        variant="dot"
                        color="error"
                        invisible={!badge}
                        overlap="circular"
                        sx={{
                          '& .MuiBadge-badge': {
                            width: 8,
                            height: 8,
                            minWidth: 8,
                            borderRadius: '50%',
                            ...(active ? { border: '1px solid #fff' } : {}),
                          },
                        }}
                      >
                        {item.icon}
                      </Badge>
                    </ListItemIcon>
                    <ListItemText primary={t(`nav.${item.labelKey}`)} primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }} />
                    {showCountPill(item, badge) && (
                      <Typography
                        variant="caption"
                        fontWeight={700}
                        sx={{
                          minWidth: 22,
                          height: 22,
                          px: 0.75,
                          borderRadius: 999,
                          bgcolor: active ? 'rgba(255,255,255,0.25)' : 'error.main',
                          color: '#fff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                        }}
                      >
                        {badge > 99 ? localizeDigits('99+') : formatNumber(badge)}
                      </Typography>
                    )}
                  </ListItemButton>
                );
              })}
            </Box>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {user?.company ? tr('Entreprise active') : ''}
        </Typography>
        <Typography variant="body2" fontWeight={600} noWrap>
          {user?.full_name || user?.email}
        </Typography>
        {(user?.company_name || user?.company) && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.company_name || tr('Entreprise')}
          </Typography>
        )}
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        // dir=rtl sur <html> inverse déjà le flex : nav à droite, contenu à gauche
        flexDirection: 'row',
      }}
    >
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          left: rtl ? 'auto' : 0,
          right: rtl ? 0 : 'auto',
          // Marges physiques (pas de stylis) selon le côté du drawer
          ml: { md: rtl ? 0 : `${DRAWER_WIDTH}px` },
          mr: { md: rtl ? `${DRAWER_WIDTH}px` : 0 },
          bgcolor: '#FAFBFC',
          backgroundImage: 'linear-gradient(90deg, #FFFFFF 0%, #F3FAF8 42%, #F4F9FC 100%)',
          color: 'text.primary',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        <Toolbar>
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{
                display: { md: 'none' },
                color: 'text.primary',
                ml: rtl ? 2 : 0,
                mr: rtl ? 0 : 2,
              }}
            >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title={tr('Notifications')}>
            <IconButton
              onClick={(e) => void openNotifications(e.currentTarget)}
              sx={{ color: 'text.primary', ml: rtl ? 0.5 : 0, mr: rtl ? 0 : 0.5 }}
            >
              <Badge
                badgeContent={
                  unreadCount > 0
                    ? (unreadCount > 99 ? localizeDigits('99+') : formatNumber(unreadCount))
                    : 0
                }
                color="error"
                showZero={false}
              >
                <NotificationsIcon />
              </Badge>
            </IconButton>
          </Tooltip>
          <Tooltip title={tr('Mon compte')}>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ color: 'text.primary' }}>
              <Avatar
                src={avatarSrc}
                sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 15 }}
              >
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchorEl}
            open={!!anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: rtl ? 'left' : 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: rtl ? 'left' : 'right' }}
          >
            <Box sx={{ px: 2, py: 1, textAlign: rtl ? 'right' : 'left' }}>
              <Typography fontWeight={600}>{user?.full_name || tr('Utilisateur')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              {t('common.profile')}
            </MenuItem>
            {(user?.is_company_admin || hasFlag(user, 'can_edit_settings')) && (
              <MenuItem onClick={() => { setAnchorEl(null); navigate('/preferences'); }}>
                <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
                {t('common.preferences')}
              </MenuItem>
            )}
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/subscription'); }}>
              <ListItemIcon><WorkspacePremiumIcon fontSize="small" /></ListItemIcon>
              {t('nav.subscription')}
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              {t('common.logout')}
            </MenuItem>
          </Menu>

          <Popover
            open={!!notifAnchor}
            anchorEl={notifAnchor}
            onClose={() => setNotifAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: rtl ? 'left' : 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: rtl ? 'left' : 'right' }}
            PaperProps={{ sx: { width: 360, maxHeight: 440 } }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
              <Typography fontWeight={700}>{tr('Notifications')}</Typography>
              {unreadCount > 0 && (
                <Button size="small" onClick={() => void handleMarkAllRead()}>{tr('Tout lu')}</Button>
              )}
            </Stack>
            <Divider />
            <List dense sx={{ py: 0, maxHeight: 360, overflow: 'auto' }}>
              {notifications.length === 0 && (
                <Box sx={{ px: 2, py: 3 }}>
                  <Typography variant="body2" color="text.secondary" align="center">
                    {tr('Aucune notification')}
                  </Typography>
                </Box>
              )}
              {notifications.map((n) => (
                <ListItemButton
                  key={n.id}
                  onClick={() => void handleNotificationClick(n)}
                  sx={{
                    alignItems: 'flex-start',
                    bgcolor: n.is_read ? 'transparent' : 'action.hover',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <ListItemText
                    primary={n.title}
                    secondary={`${n.message}\n${formatDate(n.created_at)}`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: n.is_read ? 500 : 700 }}
                    secondaryTypographyProps={{ variant: 'caption', whiteSpace: 'pre-line' }}
                  />
                </ListItemButton>
              ))}
            </List>
            {canSeeOrders && pendingOrders > 0 && (
              <>
                <Divider />
                <Box sx={{ p: 1.5 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="small"
                    onClick={() => { setNotifAnchor(null); navigate('/orders'); }}
                  >
                    {tr(`${pendingOrders} commande(s) en attente`)}
                  </Button>
                </Box>
              </>
            )}
          </Popover>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{
          width: { md: DRAWER_WIDTH },
          flexShrink: { md: 0 },
        }}
      >
        <Drawer
          variant="temporary"
          anchor={drawerAnchor}
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          anchor={drawerAnchor}
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': {
              width: DRAWER_WIDTH,
              boxSizing: 'border-box',
              borderRight: rtl ? 'none' : '1px solid #EEF1F5',
              borderLeft: rtl ? '1px solid #EEF1F5' : 'none',
            },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        dir={rtl ? 'rtl' : 'ltr'}
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          maxWidth: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
          minWidth: 0,
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 }, overflowX: 'auto' }}>
          {subscriptionAlert && location.pathname !== '/subscription' && (
            <Alert
              severity={subscription?.is_valid ? (Number(subscription.days_remaining) <= 3 ? 'error' : 'warning') : 'error'}
              sx={{ mb: 2 }}
              action={(
                <Button color="inherit" size="small" onClick={() => navigate('/subscription')}>
                  {tr('Gérer mon abonnement')}
                </Button>
              )}
            >
              {subscriptionBannerMessage}
            </Alert>
          )}
          <Box
            key={location.pathname}
            component="div"
            data-locale={`${activeCurrency}-${version}`}
            sx={{
              animation: `${fadeIn} 0.35s ease`,
            }}
          >
            <Outlet />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
