import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function RoleRoute({ children, role }) {
  const { user } = useAuth();

  if (user?.role !== role) {
    return <Navigate to="/" />;
  }

  return children;
}
