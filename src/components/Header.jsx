import { useMemo, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import "./Header.css";

const categories = [
  { value: "", label: "All" },
  { value: "Fashion Women", label: "Woman's Fashion" },
  { value: "Fashion Men", label: "Men's Fashion" },
  { value: "Electronics", label: "Electronics" },
  { value: "Home", label: "Home & Lifestyle" },
  { value: "Beauty", label: "Health & Beauty" },
];

function Header() {
  const { user, logout, isCustomer } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const activeCategory = searchParams.get("category") ?? "";
  const activeKeyword = searchParams.get("q") ?? "";

  const buildHomeQuery = (
    nextCategory = activeCategory,
    nextKeyword = activeKeyword,
  ) => {
    const nextParams = new URLSearchParams();
    const keyword = nextKeyword.trim();

    if (keyword) nextParams.set("q", keyword);
    if (nextCategory) nextParams.set("category", nextCategory);

    const queryString = nextParams.toString();
    return queryString ? `/?${queryString}` : "/";
  };

  const handleSearch = (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const keyword = String(formData.get("keyword") ?? "");

    navigate(buildHomeQuery(activeCategory, keyword));
  };

  const handleCategorySelect = (categoryValue) => {
    setIsCategoryOpen(false);
    navigate(buildHomeQuery(categoryValue));
  };

  const handleLogout = (event) => {
    event.preventDefault();
    logout();
    navigate("/");
  };

  const handleVendorCenter = (event) => {
    event.preventDefault();

    if (!user) {
      navigate("/login", { state: { from: "/vendor/onboarding" } });
      return;
    }

    if (user.role === "admin") {
      window.alert("Tài khoản admin không đăng ký trở thành vendor.");
      return;
    }

    if (user.role === "vendor") {
      navigate("/vendor/dashboard");
      return;
    }

    navigate("/vendor/onboarding");
  };

  const requireCustomerAccess = () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return false;
    }

    if (!isCustomer) {
      window.alert(
        "Chỉ tài khoản customer mới có thể dùng giỏ hàng và wishlist.",
      );
      return false;
    }

    return true;
  };

  const handleCustomerShortcut = (label) => {
    if (!requireCustomerAccess()) {
      return;
    }

    window.alert(`${label} sẽ được hoàn thiện ở bước tiếp theo.`);
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="topbar-vendor"
            onClick={handleVendorCenter}
          >
            Vendor Center
          </button>
          <span>Free Shipping On All Orders Over $50</span>
        </div>

        <div className="topbar-links">
          <button type="button">Eng</button>
          <button type="button">Faqs</button>

          {!user && <Link to="/login">Sign In</Link>}
          {!user && <Link to="/signup">Sign Up</Link>}

          <button type="button">Need Help</button>
          {user && (
            <button type="button" onClick={handleLogout}>
              Logout
            </button>
          )}
        </div>
      </div>

      <header className="site-header o-container">
        <div className="header-left">
          <button
            className="mobile-menu-btn"
            type="button"
            aria-label="Open menu"
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobileMenuPanel"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            Menu
          </button>

          <div className="header-logo">
            <Link className="header-logo__link" to="/" aria-label="Home">
              L&amp;S
            </Link>
          </div>
        </div>

        <div className="header-wrapper">
          <div className="header-top">
            <form className="header-search" onSubmit={handleSearch}>
              <input
                key={activeKeyword}
                name="keyword"
                type="text"
                placeholder="Search here..."
                defaultValue={activeKeyword}
              />

              <button type="submit" className="header-search__btn">
                Search
              </button>
            </form>

            <div className="header-actions">
              <Link
                className="header-action mobile-search-btn"
                to={buildHomeQuery()}
                aria-label="Search"
              >
                Search
              </Link>

              <button
                type="button"
                className="header-action header-action--cart"
                aria-label="Cart"
                onClick={() => handleCustomerShortcut("Giỏ hàng")}
              >
                <span className="header-action__label">Cart</span>
                <span className="header-action__badge">0</span>
              </button>

              <button
                type="button"
                className="header-action header-action--wishlist"
                aria-label="Wishlist"
                onClick={() => handleCustomerShortcut("Wishlist")}
              >
                <span className="header-action__label">Wishlist</span>
                <span className="header-action__badge header-action__badge--wishlist">
                  0
                </span>
              </button>

              <div className="header-user" id="headerUser">
                <button
                  className="header-action header-action--user"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  onClick={() => setIsUserMenuOpen((value) => !value)}
                >
                  {user ? (user.name ?? "Account") : "Guest"}
                </button>

                <div className="user-menu" hidden={!isUserMenuOpen}>
                  <div className="user-menu__head">
                    <div className="user-menu__meta">
                      <div className="user-menu__name">
                        {user ? (user.name ?? "Customer") : "Guest account"}
                      </div>
                      <div className="user-menu__email">
                        {user?.email ?? "Login to access your dashboard"}
                      </div>
                    </div>
                  </div>

                  <div className="user-menu__divider"></div>

                  {!user && (
                    <Link className="user-menu__item" to="/login">
                      Sign in
                    </Link>
                  )}

                  {user?.role === "admin" && (
                    <Link className="user-menu__item" to="/admin/dashboard">
                      Admin Dashboard
                    </Link>
                  )}

                  {user?.role === "vendor" && (
                    <Link className="user-menu__item" to="/vendor/dashboard">
                      Vendor Dashboard
                    </Link>
                  )}

                  {user && (
                    <button
                      className="user-menu__item"
                      type="button"
                      onClick={handleLogout}
                    >
                      Log Out
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <nav className="header-nav">
            <ul className="header-nav__list">
              <li>
                <NavLink to="/">Home</NavLink>
              </li>

              <li className="header-nav__item header-nav__item--categories">
                <button
                  className="header-nav__link header-nav__categories-btn"
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={isCategoryOpen}
                  onClick={() => setIsCategoryOpen((value) => !value)}
                >
                  Categories
                </button>

                <div className="header-nav__dropdown" hidden={!isCategoryOpen}>
                  <ul className="menu-list">
                    {categories.map((category) => (
                      <li
                        key={category.value || "all"}
                        className={`menu-list-item ${
                          activeCategory === category.value ? "is-active" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleCategorySelect(category.value)}
                        >
                          {category.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>

              {user?.role === "admin" && (
                <li>
                  <NavLink
                    to="/admin/dashboard"
                    className={({ isActive }) =>
                      isActive
                        ? "header-nav__link is-active"
                        : "header-nav__link"
                    }
                  >
                    Admin
                  </NavLink>
                </li>
              )}

              <li>
                <NavLink
                  to="/about"
                  className={({ isActive }) =>
                    isActive ? "header-nav__link is-active" : "header-nav__link"
                  }
                >
                  About
                </NavLink>
              </li>

              <li>
                <NavLink
                  to="/support"
                  className={({ isActive }) =>
                    isActive ? "header-nav__link is-active" : "header-nav__link"
                  }
                >
                  Support
                </NavLink>
              </li>
            </ul>

            <div className="header-contact">
              Contact: <strong>(123.456.7894)</strong>
            </div>
          </nav>
        </div>

        <div
          className="mobile-menu__overlay"
          hidden={!isMobileMenuOpen}
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        ></div>

        <aside
          id="mobileMenuPanel"
          className="mobile-menu"
          hidden={!isMobileMenuOpen}
        >
          <div className="mobile-menu__header">
            <div className="mobile-menu__title">Categories</div>
            <button
              className="mobile-menu__close"
              type="button"
              aria-label="Close menu"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              X
            </button>
          </div>

          <ul className="menu-list">
            {categories.map((category) => (
              <li
                key={`mobile-${category.value || "all"}`}
                className={`menu-list-item ${
                  activeCategory === category.value ? "is-active" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    handleCategorySelect(category.value);
                    setIsMobileMenuOpen(false);
                  }}
                >
                  {category.label}
                </button>
              </li>
            ))}
          </ul>
        </aside>
      </header>
    </>
  );
}

export default Header;
