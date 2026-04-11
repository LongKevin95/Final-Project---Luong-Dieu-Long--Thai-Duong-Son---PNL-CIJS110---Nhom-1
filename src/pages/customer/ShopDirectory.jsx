import { Link } from "react-router-dom";

import { useProductsQuery } from "../../hooks/useProductsQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./Shop.css";

export default function ShopDirectory() {
  const { data: users = [] } = useUsersQuery();
  const { data: products = [] } = useProductsQuery();

  const vendorRows = users
    .map((item) => {
      const roles = Array.isArray(item?.roles)
        ? item.roles
        : item?.role
          ? [item.role]
          : [];

      const email = String(item?.email ?? "")
        .trim()
        .toLowerCase();

      return {
        name: item?.name ?? (email ? email.split("@")[0] : "Vendor"),
        shopName:
          item?.shopName || item?.name || (email ? email.split("@")[0] : "Vendor Shop"),
        avatarUrl: String(item?.avatarUrl ?? "").trim(),
        email,
        roles,
      };
    })
    .filter((item) => item.email && item.roles.includes("vendor"))
    .map((vendor) => {
      const totalProducts = products.filter(
        (product) =>
          String(product?.vendorEmail ?? "")
            .trim()
            .toLowerCase() === vendor.email,
      ).length;

      return {
        ...vendor,
        totalProducts,
      };
    });

  return (
    <main className="shop-page o-container">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>&gt;</span>
        <strong>Shops</strong>
      </nav>

      <div className="shop-header">
        <h1>All Vendor Shops</h1>
        <span>{vendorRows.length} vendors</span>
      </div>

      {vendorRows.length === 0 ? (
        <p className="shop-empty">Chua co tai khoan vendor nao.</p>
      ) : (
        <section className="shop-grid">
          {vendorRows.map((vendor) => (
            <article key={vendor.email} className="shop-card">
              <div className="shop-card__head">
                <div className="shop-card__avatar" aria-hidden="true">
                  {vendor.avatarUrl ? (
                    <img src={vendor.avatarUrl} alt={vendor.shopName} />
                  ) : (
                    <span>{String(vendor.shopName).charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h3>{vendor.shopName}</h3>
                  <small>{vendor.name}</small>
                </div>
              </div>
              <p>{vendor.email}</p>
              <small>{vendor.totalProducts} products</small>
              <Link to={`/shops/${encodeURIComponent(vendor.email)}`}>
                View shop
              </Link>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
