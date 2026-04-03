import { Routes, Route } from "react-router-dom";

import Home from "../pages/customer/Home";
import ProductDetail from "../pages/customer/ProductDetail";
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
import PublicLayout from "../components/PublicLayout";
import PrivateRoute from "./PrivateRoute";
import RoleRoute from "./RoleRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/product/:id" element={<ProductDetail />} />
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
        <Route path="users" element={<UsersManager />} />
      </Route>

      <Route
        path="/vendor/dashboard"
        element={
          <PrivateRoute>
            <RoleRoute role="vendor">
              <VendorDashboard />
            </RoleRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/vendor/products"
        element={
          <PrivateRoute>
            <RoleRoute role="vendor">
              <VendorProducts />
            </RoleRoute>
          </PrivateRoute>
        }
      />
    </Routes>
  );
}
