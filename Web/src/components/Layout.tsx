import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Avatar,
  Box,
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
import ReceiptLongIcon from '@mui/icons-material/ReceiptLongOutlined';
import StorefrontIcon from '@mui/icons-material/StorefrontOutlined';
import CategoryIcon from '@mui/icons-material/CategoryOutlined';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import LabelIcon from '@mui/icons-material/LabelOutlined';
import TimelineIcon from '@mui/icons-material/TimelineOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/PersonOutline';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logoutThunk } from '../store/authSlice';
import { hasModuleAccess } from '../utils/permissions';

const DRAWER_WIDTH = 260;

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  module?: string;
  adminOnly?: boolean;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tableau de bord', path: '/', icon: <DashboardIcon />, section: 'Principal' },
  { label: 'Caisse (POS)', path: '/pos', icon: <PointOfSaleIcon />, module: 'sales', section: 'Ventes' },
  { label: 'Historique ventes', path: '/sales', icon: <ReceiptLongIcon />, module: 'sales', section: 'Ventes' },
  { label: 'Produits', path: '/products', icon: <InventoryIcon />, module: 'products', section: 'Catalogue' },
  { label: 'Catégories & tags', path: '/categories', icon: <CategoryIcon />, module: 'products', section: 'Catalogue' },
  { label: 'Étiquettes', path: '/labels', icon: <LabelIcon />, module: 'products', section: 'Catalogue' },
  { label: 'Stock', path: '/stock', icon: <WarehouseIcon />, module: 'stock', section: 'Stock' },
  { label: 'Sites & magasins', path: '/sites', icon: <StorefrontIcon />, module: 'stock', section: 'Stock' },
  { label: 'Scan direct', path: '/scan', icon: <QrCodeScannerIcon />, module: 'stock', section: 'Stock' },
  { label: 'Traçabilité', path: '/traceability', icon: <TimelineIcon />, module: 'stock', section: 'Stock' },
  { label: 'Requêtes stock', path: '/requests', icon: <AssignmentIcon />, module: 'stock', section: 'Stock' },
  { label: 'Clients', path: '/customers', icon: <PeopleIcon />, module: 'customers', section: 'Relations' },
  { label: 'Fournisseurs', path: '/suppliers', icon: <LocalShippingIcon />, module: 'suppliers', section: 'Relations' },
  { label: 'Achats', path: '/purchases', icon: <ShoppingCartIcon />, module: 'purchases', section: 'Finance' },
  { label: 'Dépenses', path: '/expenses', icon: <PaymentsIcon />, module: 'accounting', section: 'Finance' },
  { label: 'Statistiques', path: '/reports', icon: <BarChartIcon />, section: 'Analyse' },
  { label: 'Utilisateurs', path: '/users', icon: <GroupIcon />, adminOnly: true, section: 'Administration' },
  { label: 'Abonnement', path: '/subscription', icon: <WorkspacePremiumIcon />, section: 'Administration' },
];

export default function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);

  const initials = (user?.full_name || user?.email || '?')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.adminOnly && !user?.is_company_admin) return false;
    if (item.module && !hasModuleAccess(user?.permissions, item.module)) return false;
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

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#FAFBFC' }}>
      <Toolbar sx={{ px: 2.5, py: 1.5 }}>
        <Box>
          <Typography variant="h6" color="primary" fontWeight={800} letterSpacing="-0.02em">
            Inventra
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Gestion commerciale
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, px: 1.5, py: 1.5, overflow: 'auto' }}>
        {['Principal', 'Ventes', 'Catalogue', 'Stock', 'Relations', 'Finance', 'Analyse', 'Administration'].map((section) => {
          const sectionItems = visibleItems.filter((i) => i.section === section);
          if (!sectionItems.length) return null;
          return (
            <Box key={section} sx={{ mb: 1 }}>
              <ListSubheader sx={{ bgcolor: 'transparent', lineHeight: '28px', fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', px: 1 }}>
                {section}
              </ListSubheader>
              {sectionItems.map((item) => {
                const active =
                  item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                return (
                  <ListItemButton
                    key={item.path}
                    selected={active}
                    onClick={() => go(item.path)}
                    sx={{
                      borderRadius: 1.5,
                      mb: 0.25,
                      py: 0.75,
                      '&.Mui-selected': {
                        bgcolor: 'primary.main',
                        color: '#fff',
                        '& .MuiListItemIcon-root': { color: '#fff' },
                        '&:hover': { bgcolor: 'primary.dark' },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: 13.5, fontWeight: 500 }} />
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
          {user?.company ? `Entreprise active` : ''}
        </Typography>
        <Typography variant="body2" fontWeight={600} noWrap>
          {user?.full_name || user?.email}
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.paper',
          color: 'text.primary',
          borderBottom: '1px solid #EEF1F5',
        }}
      >
        <Toolbar>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Tooltip title="Mon compte">
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
              <Avatar sx={{ bgcolor: 'primary.main', width: 36, height: 36, fontSize: 15 }}>
                {initials}
              </Avatar>
            </IconButton>
          </Tooltip>
          <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography fontWeight={600}>{user?.full_name || 'Utilisateur'}</Typography>
              <Typography variant="body2" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Mon profil
            </MenuItem>
            <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              Se déconnecter
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
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
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, borderRight: '1px solid #EEF1F5' },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Box sx={{ p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
