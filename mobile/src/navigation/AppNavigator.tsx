import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MainTabNavigator from './MainTabNavigator';
import ProductCreateScreen from '../screens/ProductCreateScreen';
import ProductEditScreen from '../screens/ProductEditScreen';
import ProductImportScreen from '../screens/ProductImportScreen';
import CustomersScreen from '../screens/CustomersScreen';
import SuppliersScreen from '../screens/SuppliersScreen';
import PurchasesScreen from '../screens/PurchasesScreen';
import ExpensesScreen from '../screens/ExpensesScreen';
import ReportsScreen from '../screens/ReportsScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import UsersScreen from '../screens/UsersScreen';
import SitesScreen from '../screens/SitesScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import ScanScreen from '../screens/ScanScreen';
import LabelsScreen from '../screens/LabelsScreen';
import TraceabilityScreen from '../screens/TraceabilityScreen';
import StockRequestsScreen from '../screens/StockRequestsScreen';
import { colors } from '../theme/colors';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

const modalHeader = { headerStyle: { backgroundColor: colors.surface } };

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      <Stack.Screen name="ProductCreate" component={ProductCreateScreen}
        options={{ presentation: 'modal', headerShown: true, title: 'Nouveau produit', ...modalHeader }} />
      <Stack.Screen name="ProductEdit" component={ProductEditScreen}
        options={{ headerShown: true, title: 'Modifier produit', ...modalHeader }} />
      <Stack.Screen name="ProductImport" component={ProductImportScreen}
        options={{ headerShown: true, title: 'Importer des produits', ...modalHeader }} />
      <Stack.Screen name="Customers" component={CustomersScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Suppliers" component={SuppliersScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Purchases" component={PurchasesScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Expenses" component={ExpensesScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Reports" component={ReportsScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Subscription" component={SubscriptionScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={ProfileScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Users" component={UsersScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Sites" component={SitesScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Categories" component={CategoriesScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Scan" component={ScanScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Labels" component={LabelsScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="Traceability" component={TraceabilityScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="StockRequests" component={StockRequestsScreen}
        options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
