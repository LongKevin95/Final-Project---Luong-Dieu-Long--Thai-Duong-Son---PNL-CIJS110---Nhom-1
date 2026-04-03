import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../hooks/useAuth";
import "./Login.css";

const defaultFormValues = {
  email: "",
  password: "",
};

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formValues, setFormValues] = useState(defaultFormValues);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fromLocation = location.state?.from;
  const defaultTarget = user?.role === "admin" ? "/admin" : "/";
  const redirectTarget = `${fromLocation?.pathname ?? defaultTarget}${fromLocation?.search ?? ""}${fromLocation?.hash ?? ""}`;
  const fromLabel = redirectTarget === "/" ? "trang chủ" : redirectTarget;

  if (user) {
    return <Navigate to={redirectTarget} replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormValues((previousValues) => ({
      ...previousValues,
      [name]: value,
    }));

    if (errorMessage) {
      setErrorMessage("");
    }
  };

  const handleLogin = async (event) => {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const nextUser = await login(formValues);
      const fallbackTarget = nextUser?.role === "admin" ? "/admin" : "/";
      const nextTarget = `${fromLocation?.pathname ?? fallbackTarget}${fromLocation?.search ?? ""}${fromLocation?.hash ?? ""}`;
      navigate(nextTarget, { replace: true });
    } catch (error) {
      setErrorMessage(
        error?.message ??
          "Đăng nhập tạm thời chưa thành công. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="signin-container">
      <form className="signin" onSubmit={handleLogin}>
        <h2 className="signin-title">Sign In</h2>

        <div className="signin-group">
          <input
            type="email"
            name="email"
            placeholder="Email"
            className="signin-input"
            autoComplete="email"
            value={formValues.email}
            onChange={handleChange}
            required
          />
        </div>

        <div className="signin-group signin-group--icon">
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="signin-input"
            autoComplete="current-password"
            value={formValues.password}
            onChange={handleChange}
            required
          />
          <span className="signin-eye" aria-hidden="true">
            👁
          </span>
        </div>

        <div className="signin-options">
          <label className="signin-remember">
            <input type="checkbox" />
            Remember Me
          </label>
          <span className="signin-forgot">Forget Password</span>
        </div>

        {errorMessage && (
          <p className="login-error" role="alert">
            {errorMessage}
          </p>
        )}

        <button type="submit" className="signin-btn" disabled={isSubmitting}>
          {isSubmitting ? "Signing In..." : "Sign In →"}
        </button>

        <p className="signin-hint">
          Đăng nhập để tiếp tục tới <strong>{fromLabel}</strong>
        </p>
      </form>
    </div>
  );
}
