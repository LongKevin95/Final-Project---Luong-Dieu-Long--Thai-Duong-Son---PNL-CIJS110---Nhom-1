import { Routes, Route } from "react-router-dom";

import Home from "../pages/customer/Home";
import ProductDetail from "../pages/customer/ProductDetail";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import Dashboard from "../pages/admin/Dashboard";
import ProductManager from "../pages/admin/ProductManager";
import VendorDashboard from "../pages/vendor/VendorDashboard";
import VendorProducts from "../pages/vendor/VendorProducts";
import VendorOnboarding from "../pages/vendor/VendorOnboarding";
import PrivateRoute from "./PrivateRoute";
import RoleRoute from "./RoleRoute";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/product/:id" element={<ProductDetail />} />
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
        path="/admin/dashboard"
        element={
          <PrivateRoute>
            <RoleRoute role="admin">
              <Dashboard />
            </RoleRoute>
          </PrivateRoute>
        }
      />

      <Route
        path="/admin/products"
        element={
          <PrivateRoute>
            <RoleRoute role="admin">
              <ProductManager />
            </RoleRoute>
          </PrivateRoute>
        }
      />

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
