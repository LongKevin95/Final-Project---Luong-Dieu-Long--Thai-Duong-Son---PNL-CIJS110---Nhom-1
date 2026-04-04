import { Navigate, Route, Routes } from "react-router-dom";

import Home from "../pages/customer/Home";
import ProductDetail from "../pages/customer/ProductDetail";
import Cart from "../pages/customer/Cart";
import Checkout from "../pages/customer/Checkout";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import AdminLayout from "../pages/admin/AdminLayout";
import Dashboard from "../pages/admin/Dashboard";
import ProductManager from "../pages/admin/ProductManager";
import VendorManager from "../pages/admin/VendorManager";
import OrdersManager from "../pages/admin/OrdersManager";
import UsersManager from "../pages/admin/UsersManager";
import VendorDashboard from "../pages/vendor/VendorDashboard";
import VendorProducts from "../pages/vendor/VendorProducts";
import VendorOnboarding from "../pages/vendor/VendorOnboarding";
import VendorLayout from "../pages/vendor/VendorLayout";
import VendorOrders from "../pages/vendor/VendorOrders";
import VendorProfile from "../pages/vendor/VendorProfile";
import PublicLayout from "../components/PublicLayout";
import PrivateRoute from "./PrivateRoute";
import RoleRoute from "./RoleRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/checkout" element={<Checkout />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route
        path="/vendor/onboarding"
        element={
          <PrivateRoute>
            <RoleRoute role="customer">
              <VendorOnboarding />
            </RoleRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <PrivateRoute>
            <RoleRoute role="admin">
              <AdminLayout />
            </RoleRoute>
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<ProductManager />} />
        <Route path="vendors" element={<VendorManager />} />
        <Route path="orders" element={<OrdersManager />} />
        <Route path="customers" element={<UsersManager />} />
      </Route>

      <Route
        path="/vendor"
        element={
          <PrivateRoute>
            <RoleRoute role="vendor">
              <VendorLayout />
            </RoleRoute>
          </PrivateRoute>
        }
      >
        <Route index element={<VendorDashboard />} />
        <Route path="products" element={<VendorProducts />} />
        <Route path="orders" element={<VendorOrders />} />
        <Route path="profile" element={<VendorProfile />} />
      </Route>

      <Route
        path="/vendor/dashboard"
        element={<Navigate to="/vendor" replace />}
      />
    </Routes>
  );
}
