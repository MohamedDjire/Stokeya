export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  ResetPassword: { uid: string; token: string; email?: string };
};

export type MainTabParamList = {
  Accueil: undefined;
  Produits: undefined;
  Caisse: undefined;
  Stock: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  ProductCreate: undefined;
  ProductEdit: { productId: number };
  ProductImport: undefined;
  Customers: undefined;
  Suppliers: undefined;
  Purchases: undefined;
  Expenses: undefined;
  Reports: undefined;
  Subscription: undefined;
  Profile: undefined;
  Users: undefined;
  Sites: undefined;
  Categories: undefined;
  Scan: undefined;
  Labels: undefined;
  Traceability: undefined;
  StockRequests: undefined;
  ShopOrders: undefined;
};
