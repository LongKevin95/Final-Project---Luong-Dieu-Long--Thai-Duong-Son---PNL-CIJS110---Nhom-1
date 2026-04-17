import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";

import ProductCard from "../../components/ProductCard";
import { useProductsQuery } from "../../hooks/useProductsQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./Shop.css";

export default function ShopStore() {
  const { vendorKey } = useParams();
  const { data: users = [] } = useUsersQuery();
  const { data: products = [] } = useProductsQuery();

  const decodedVendorEmail = decodeURIComponent(String(vendorKey ?? ""))
    .trim()
    .toLowerCase();

  const vendor = users.find((item) => {
    const email = String(item?.email ?? "")
      .trim()
      .toLowerCase();
    return email === decodedVendorEmail;
  });

  const vendorProducts = useMemo(() => {
    return products
      .filter((product) => {
        const email = String(product?.vendorEmail ?? "")
          .trim()
          .toLowerCase();
        return email === decodedVendorEmail;
      })
      .map((product) => ({
        ...product,
        shopName: vendor?.shopName || vendor?.name || product?.shopName,
        vendorAvatarUrl: vendor?.avatarUrl || product?.vendorAvatarUrl,
      }));
  }, [products, decodedVendorEmail, vendor]);

  return (
    <main className="shop-page o-container">
      <nav className="shop-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>&gt;</span>
        <Link to="/shops">Shops</Link>
        <span>&gt;</span>
        <strong>{vendor?.name ?? (decodedVendorEmail || "Shop")}</strong>
      </nav>

      <div className="shop-header">
        <div className="shop-header__title">
          <div className="shop-card__avatar" aria-hidden="true">
            {vendor?.avatarUrl ? (
              <img src={vendor.avatarUrl} alt={vendor?.shopName || vendor?.name || "Shop"} />
            ) : (
              <span>
                {String(vendor?.shopName || vendor?.name || decodedVendorEmail || "S")
                  .charAt(0)
                  .toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <h1>{vendor?.shopName || vendor?.name || "Vendor Shop"}</h1>
            <small>{vendor?.email || decodedVendorEmail || "N/A"}</small>
          </div>
        </div>
        <span>{vendorProducts.length} products</span>
      </div>

      {vendorProducts.length === 0 ? (
        <p className="shop-empty">Shop nay chua co san pham.</p>
      ) : (
        <section className="related-grid">
          {vendorProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </section>
      )}
    </main>
  );
}
