import { useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import logo from "../assets/Images/logo.png";
import logoWhite from "../assets/Images/logo-white.png";

import iconSearch from "../assets/Icons/icons8-search.svg";
import {
  PRODUCT_CATEGORIES,
  formatProductCategoryLabel,
} from "../api/productApi";
import { useAuth } from "../hooks/useAuth";
import { useCart } from "../hooks/useCart";
import { useProductsQuery } from "../hooks/useProductsQuery";
import { useTheme } from "../hooks/useTheme";
import { useWishlist } from "../hooks/useWishlist";
import "./Header.css";

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function Header() {
  const { user, logout, isCustomer, isVendor } = useAuth();
  const { data: products = [] } = useProductsQuery();
  const { totalItems } = useCart();
  const { totalItems: wishlistTotal } = useWishlist();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const headerLogo = isDark ? logoWhite : logo;

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const activeCategory = searchParams.get("category") ?? "";
  const activeKeyword = searchParams.get("q") ?? "";

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(activeKeyword);
  const [isSearchSuggestionsOpen, setIsSearchSuggestionsOpen] = useState(false);
  const categoryMenuRef = useRef(null);
  const userMenuRef = useRef(null);

  useEffect(() => {
    setSearchInput(activeKeyword);
  }, [activeKeyword]);

  useEffect(() => {
    if (!isCategoryOpen && !isUserMenuOpen) {
      return undefined;
    }

    const handlePointerDownOutside = (event) => {
      const target = event.target;

      if (
        isCategoryOpen &&
        categoryMenuRef.current &&
        !categoryMenuRef.current.contains(target)
      ) {
        setIsCategoryOpen(false);
      }

      if (
        isUserMenuOpen &&
        userMenuRef.current &&
        !userMenuRef.current.contains(target)
      ) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [isCategoryOpen, isUserMenuOpen]);

  const categories = useMemo(() => {
    const productCategoryValues = products
      .map((product) =>
        String(product?.category ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    const uniqueValues = [
      ...new Set([...PRODUCT_CATEGORIES, ...productCategoryValues]),
    ];

    return [
      { value: "", label: "All" },
      ...uniqueValues.map((value) => ({
        value,
        label: formatProductCategoryLabel(value),
      })),
    ];
  }, [products]);

  const searchSuggestions = useMemo(() => {
    const normalizedInput = normalizeSearchText(searchInput);
    const suggestionMap = new Map();

    products.forEach((product) => {
      const title = String(product?.title ?? "").trim();
      const categoryValue = String(product?.category ?? "")
        .trim()
        .toLowerCase();
      const categoryLabel = formatProductCategoryLabel(categoryValue);

      if (title) {
        const titleKey = `product:${normalizeSearchText(title)}`;
        if (!suggestionMap.has(titleKey)) {
          suggestionMap.set(titleKey, {
            type: "product",
            value: title,
            label: title,
            helperText: "Sản phẩm",
          });
        }
      }

      if (categoryValue) {
        const categoryKey = `category:${categoryValue}`;
        if (!suggestionMap.has(categoryKey)) {
          suggestionMap.set(categoryKey, {
            type: "category",
            value: categoryValue,
            label: categoryLabel,
            helperText: "Danh mục",
          });
        }
      }
    });

    const suggestions = [...suggestionMap.values()];

    if (!normalizedInput) {
      return suggestions.slice(0, 6);
    }

    return suggestions
      .filter((suggestion) => {
        const searchableLabel = normalizeSearchText(suggestion.label);
        const searchableValue = normalizeSearchText(suggestion.value);
        return (
          searchableLabel.includes(normalizedInput) ||
          searchableValue.includes(normalizedInput)
        );
      })
      .slice(0, 6);
  }, [products, searchInput]);

  const showSearchSuggestions =
    isSearchSuggestionsOpen &&
    searchInput.trim().length > 0 &&
    searchSuggestions.length > 0;

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
    setIsSearchSuggestionsOpen(false);

    navigate(buildHomeQuery(activeCategory, searchInput));
  };

  const handleSearchChange = (event) => {
    const nextValue = event.target.value;
    setSearchInput(nextValue);
    setIsSearchSuggestionsOpen(Boolean(nextValue.trim()));
  };

  const handleSearchFocus = () => {
    if (searchInput.trim()) {
      setIsSearchSuggestionsOpen(true);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    setIsSearchSuggestionsOpen(false);

    if (suggestion.type === "category") {
      setSearchInput(suggestion.label);
      navigate(buildHomeQuery(suggestion.value, ""));
      return;
    }

    setSearchInput(suggestion.value);
    navigate(buildHomeQuery(activeCategory, suggestion.value));
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

    if (user?.roles?.includes("admin")) {
      window.alert("Tài khoản admin không đăng ký trở thành vendor.");
      return;
    }

    if (user?.roles?.includes("vendor")) {
      navigate("/vendor/dashboard");
      return;
    }

    navigate("/vendor/onboarding");
  };

  const canPurchase = isCustomer && !isVendor;

  const requireCustomerAccess = () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return false;
    }

    if (!canPurchase) {
      window.alert(
        "Chi tai khoan customer moi co the mua hang, dung gio hang va wishlist.",
      );
      return false;
    }

    return true;
  };

  const handleCustomerShortcut = (label) => {
    if (!requireCustomerAccess()) {
      return;
    }

    if (label === "Giỏ hàng") {
      navigate("/cart");
      return;
    }

    if (label === "Wishlist") {
      navigate("/wishlist");
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
          <button type="button" onClick={toggleTheme} className="topbar-theme">
            {isDark ? "Light" : "Dark"}
          </button>
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

      <header className="site-header">
        <div className="header-container">
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
                <img className="header-logo-image" src={headerLogo} alt="L&S" />
              </Link>
            </div>
          </div>

          <div className="header-wrapper">
            <div className="header-top">
              <form className="header-search" onSubmit={handleSearch}>
                <div className="header-search__field">
                  <input
                    name="keyword"
                    type="text"
                    placeholder="Search by product name or category..."
                    value={searchInput}
                    autoComplete="off"
                    onChange={handleSearchChange}
                    onFocus={handleSearchFocus}
                    onBlur={() => {
                      window.setTimeout(() => {
                        setIsSearchSuggestionsOpen(false);
                      }, 120);
                    }}
                  />

                  {showSearchSuggestions && (
                    <div
                      className="header-search__suggestions"
                      role="listbox"
                      aria-label="Search suggestions"
                    >
                      {searchSuggestions.map((suggestion) => (
                        <button
                          key={`${suggestion.type}-${suggestion.value}`}
                          type="button"
                          className="header-search__suggestion"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            handleSuggestionSelect(suggestion);
                          }}
                        >
                          <span className="header-search__suggestion-label">
                            {suggestion.label}
                          </span>
                          <span className="header-search__suggestion-type">
                            {suggestion.helperText}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" className="header-search__btn">
                  <img
                    className="header-search__icon"
                    src={iconSearch}
                    alt="Search"
                  />
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
                  <span className="header-action__badge">{totalItems}</span>
                </button>

                <button
                  type="button"
                  className="header-action header-action--wishlist"
                  aria-label="Wishlist"
                  onClick={() => handleCustomerShortcut("Wishlist")}
                >
                  <span className="header-action__label">Wishlist</span>
                  <span className="header-action__badge header-action__badge--wishlist">
                    {wishlistTotal}
                  </span>
                </button>

                <div className="header-user" id="headerUser" ref={userMenuRef}>
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

                    {user?.roles?.includes("admin") && (
                      <Link className="user-menu__item" to="/admin">
                        Admin Dashboard
                      </Link>
                    )}

                    {user?.roles?.includes("vendor") && (
                      <Link className="user-menu__item" to="/vendor/dashboard">
                        Vendor Dashboard
                      </Link>
                    )}

                    {user && canPurchase && (
                      <Link className="user-menu__item" to="/my-orders">
                        My Orders
                      </Link>
                    )}

                    {user && (
                      <Link className="user-menu__item" to="/profile">
                        Profile Settings
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

                <li>
                  <NavLink
                    to="/shops"
                    className={({ isActive }) =>
                      isActive
                        ? "header-nav__link is-active"
                        : "header-nav__link"
                    }
                  >
                    Shops
                  </NavLink>
                </li>

                <li
                  className="header-nav__item header-nav__item--categories"
                  ref={categoryMenuRef}
                >
                  <button
                    className="header-nav__link header-nav__categories-btn"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={isCategoryOpen}
                    onClick={() => setIsCategoryOpen((value) => !value)}
                  >
                    Categories
                  </button>

                  <div
                    className="header-nav__dropdown"
                    hidden={!isCategoryOpen}
                  >
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

                {user?.roles?.includes("admin") && (
                  <li>
                    <NavLink
                      to="/admin"
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
                      isActive
                        ? "header-nav__link is-active"
                        : "header-nav__link"
                    }
                  >
                    About
                  </NavLink>
                </li>

                <li>
                  <NavLink
                    to="/support"
                    className={({ isActive }) =>
                      isActive
                        ? "header-nav__link is-active"
                        : "header-nav__link"
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
        </div>
      </header>
    </>
  );
}

export default Header;
