import { memo, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";

import { formatProductCategoryLabel } from "../../api/productApi";
import { useProductsQuery } from "../../hooks/useProductsQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./Shop.css";

const SHOPS_SNAPSHOT_KEY = "ls-shops-vendors-snapshot";

function readStoredArray(storageKey) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawData = window.localStorage.getItem(storageKey);

    if (!rawData) {
      return [];
    }

    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

function writeStoredArray(storageKey, items) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    return;
  }
}

function normalizeEmail(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeCategory(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function resolveUserRoles(user) {
  if (Array.isArray(user?.roles)) {
    return user.roles;
  }

  if (user?.role) {
    return [user.role];
  }

  return [];
}

const ShopCard = memo(({ vendor }) => {
  return (
    <article className="shop-card">
      <div className="shop-card__head">
        <div className="shop-card__avatar" aria-hidden="true">
          {vendor.avatarUrl ? (
            <img src={vendor.avatarUrl} alt={vendor.shopName} />
          ) : (
            <span>{String(vendor.shopName).charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div className="shop-card__identity">
          <h3>{vendor.shopName}</h3>
          <small>{vendor.name}</small>
        </div>
      </div>
      <p className="shop-card__email">{vendor.email}</p>
      <div className="shop-card__categories">
        <strong className="shop-card__categories-title">Categories</strong>
        <div className="shop-card__categories-list">
          {vendor.categories.length > 0 ? (
            vendor.categories.map((category) => (
              <span
                key={`${vendor.email}-${category}`}
                className="shop-card__meta"
              >
                {category}
              </span>
            ))
          ) : (
            <small className="shop-card__categories-empty">
              No categories yet
            </small>
          )}
        </div>
      </div>
      <small className="shop-card__meta shop-card__meta--products">
        {vendor.totalProducts} products
      </small>
      <Link
        className="shop-card__action"
        to={`/shops/${encodeURIComponent(vendor.email)}`}
      >
        View shop
      </Link>
    </article>
  );
});

const ShopCardSkeleton = () => {
  return (
    <article className="shop-card shop-card--skeleton">
      <div className="shop-card__head">
        <div className="shop-card__avatar" aria-hidden="true">
          <span />
        </div>
        <div className="shop-card__identity">
          <h3 />
          <small />
        </div>
      </div>
      <p className="shop-card__email" />
      <div className="shop-card__categories">
        <strong className="shop-card__categories-title" />
        <div className="shop-card__categories-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <span
              key={`skeleton-category-${index}`}
              className="shop-card__meta"
            />
          ))}
        </div>
      </div>
      <small className="shop-card__meta shop-card__meta--products" />
      <Link className="shop-card__action" to="#" />
    </article>
  );
};

export default function ShopDirectory() {
  const storedVendorRows = useMemo(
    () => readStoredArray(SHOPS_SNAPSHOT_KEY),
    [],
  );

  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
    error: usersError,
  } = useUsersQuery();
  const {
    data: productsData,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productsError,
  } = useProductsQuery();

  const users = useMemo(
    () => (Array.isArray(usersData) ? usersData : []),
    [usersData],
  );
  const products = useMemo(
    () => (Array.isArray(productsData) ? productsData : []),
    [productsData],
  );
  const hasFreshData = useMemo(
    () => Array.isArray(usersData) && Array.isArray(productsData),
    [usersData, productsData],
  );

  const productSummaryByVendor = useMemo(() => {
    const summaryMap = new Map();

    products.forEach((product) => {
      const vendorEmail = normalizeEmail(product?.vendorEmail);

      if (!vendorEmail) {
        return;
      }

      const currentSummary = summaryMap.get(vendorEmail) ?? {
        totalProducts: 0,
        categories: new Set(),
      };

      currentSummary.totalProducts += 1;

      const category = normalizeCategory(product?.category);
      if (category) {
        currentSummary.categories.add(category);
      }

      summaryMap.set(vendorEmail, currentSummary);
    });

    return summaryMap;
  }, [products]);

  const liveVendorRows = useMemo(() => {
    return users
      .map((item) => {
        const roles = resolveUserRoles(item);
        const email = normalizeEmail(item?.email);
        const productSummary = productSummaryByVendor.get(email);

        return {
          name: item?.name ?? (email ? email.split("@")[0] : "Vendor"),
          shopName:
            item?.shopName ||
            item?.name ||
            (email ? email.split("@")[0] : "Vendor Shop"),
          avatarUrl: String(item?.avatarUrl ?? "").trim(),
          email,
          roles,
          totalProducts: productSummary?.totalProducts ?? 0,
          categories: Array.from(productSummary?.categories ?? []).map(
            (category) => formatProductCategoryLabel(category),
          ),
        };
      })
      .filter((item) => item.email && item.roles.includes("vendor"));
  }, [users, productSummaryByVendor]);

  useEffect(() => {
    if (!hasFreshData) {
      return;
    }

    writeStoredArray(SHOPS_SNAPSHOT_KEY, liveVendorRows);
  }, [hasFreshData, liveVendorRows]);

  const vendorRows = hasFreshData ? liveVendorRows : storedVendorRows;
  const hasSnapshotRows = storedVendorRows.length > 0;
  const isPageLoading = !hasFreshData && (isUsersLoading || isProductsLoading);
  const shouldShowSkeletons = isPageLoading && !hasSnapshotRows;
  const shouldShowError =
    !vendorRows.length && !isPageLoading && (isUsersError || isProductsError);
  const shouldShowEmpty =
    !vendorRows.length && !isPageLoading && !isUsersError && !isProductsError;
  const headerCountLabel = shouldShowSkeletons
    ? "..."
    : `${vendorRows.length} vendors`;
  const errorMessage =
    usersError?.message ??
    productsError?.message ??
    "Khong the tai danh sach shop.";

  return (
    <main className="shop-page o-container">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>&gt;</span>
        <strong>Shops</strong>
      </nav>

      <div className="shop-header">
        <h1>All Vendor Shops</h1>
        <span>{headerCountLabel}</span>
      </div>

      {shouldShowError ? (
        <p className="shop-empty">{errorMessage}</p>
      ) : shouldShowEmpty ? (
        <p className="shop-empty">Chua co shop nao kha dung.</p>
      ) : (
        <section
          className={`shop-grid ${shouldShowSkeletons ? "shop-grid--loading" : ""}`}
        >
          {vendorRows.map((vendor) => (
            <ShopCard key={vendor.email} vendor={vendor} />
          ))}
          {shouldShowSkeletons
            ? Array.from({ length: 6 }).map((_, index) => (
                <ShopCardSkeleton key={`shop-skeleton-${index}`} />
              ))
            : null}
        </section>
      )}
    </main>
  );
}
