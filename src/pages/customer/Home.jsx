import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import jblSpeaker from "../../assets/Images/jbl-speaker.png";

import ProductCard from "../../components/ProductCard";
import { formatProductCategoryLabel } from "../../api/productApi";
import { useProductsQuery } from "../../hooks/useProductsQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./Home.css";

const timerItems = [
  { label: "Days", value: "03" },
  { label: "Hours", value: "23" },
  { label: "Minutes", value: "59" },
  { label: "Seconds", value: "59" },
];

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function buildProductSearchIndex(product) {
  const title = String(product?.title ?? "");
  const categoryValue = String(product?.category ?? "");
  const categoryLabel = formatProductCategoryLabel(categoryValue);

  return [title, categoryValue, categoryLabel]
    .map(normalizeSearchText)
    .filter(Boolean)
    .join(" ");
}

function Home() {
  const [searchParams] = useSearchParams();

  const { data: products = [], isLoading, isError, error } = useProductsQuery();
  const { data: users = [] } = useUsersQuery();

  const errorMessage = error?.message ?? "Unable to load products.";

  const keyword = (searchParams.get("q") ?? "").trim().toLowerCase();
  const category = searchParams.get("category") ?? "";
  const normalizedKeyword = useMemo(
    () => normalizeSearchText(keyword),
    [keyword],
  );
  const normalizedCategory = useMemo(
    () =>
      String(category ?? "")
        .trim()
        .toLowerCase(),
    [category],
  );

  const vendorMap = useMemo(
    () =>
      new Map(
        users.map((item) => [
          String(item?.email ?? "")
            .trim()
            .toLowerCase(),
          item,
        ]),
      ),
    [users],
  );

  const preparedProducts = useMemo(
    () =>
      products.map((product) => {
        const vendorEmail = String(product?.vendorEmail ?? "")
          .trim()
          .toLowerCase();
        const vendorProfile = vendorMap.get(vendorEmail);
        const resolvedShopName =
          vendorProfile?.shopName || vendorProfile?.name || product?.shopName;
        const resolvedVendorAvatarUrl =
          vendorProfile?.avatarUrl || product?.vendorAvatarUrl;
        const hasVendorOverrides =
          resolvedShopName !== product?.shopName ||
          resolvedVendorAvatarUrl !== product?.vendorAvatarUrl;

        return {
          product: hasVendorOverrides
            ? {
                ...product,
                shopName: resolvedShopName,
                vendorAvatarUrl: resolvedVendorAvatarUrl,
              }
            : product,
          normalizedCategory: String(product?.category ?? "").toLowerCase(),
          searchIndex: buildProductSearchIndex(product),
        };
      }),
    [products, vendorMap],
  );

  const filteredProducts = useMemo(() => {
    return preparedProducts
      .filter(({ normalizedCategory: productCategory, searchIndex }) => {
        const keywordMatch = normalizedKeyword
          ? searchIndex.includes(normalizedKeyword)
          : true;
        const categoryMatch = normalizedCategory
          ? productCategory === normalizedCategory
          : true;

        return keywordMatch && categoryMatch;
      })
      .map(({ product }) => product);
  }, [preparedProducts, normalizedKeyword, normalizedCategory]);
  const ip17 = filteredProducts.find(
    (product) => product.title === "Iphone 17 Pro Max 256GB",
  );
  const ip17Id = ip17?.id;
  const heroBannerProductLink = ip17 ? `/product/${ip17Id}` : "/";

  const flashSalesProducts = filteredProducts.slice(0, 8);
  const bestSellingProducts = filteredProducts.slice(0, 4);
  const exploreProducts = filteredProducts.slice(0, 8);

  const searchSummary = useMemo(() => {
    if (!keyword && !category) return "";

    const labels = [];
    if (keyword) labels.push(`keyword "${keyword}"`);
    if (category)
      labels.push(`category "${formatProductCategoryLabel(category)}"`);

    return labels.join(" | ");
  }, [keyword, category]);

  const renderProductGrid = (items) => {
    if (isLoading) {
      return (
        <div className="home-grid home-grid--loading">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="home-card-skeleton"></div>
          ))}
        </div>
      );
    }

    if (isError) {
      return <p className="home-message home-message--error">{errorMessage}</p>;
    }

    if (items.length === 0) {
      return (
        <div className="home-message">
          <p>No product yet.</p>
          <small>
            Data source: /api/resources/ecommerce-products?apiKey=...
          </small>
        </div>
      );
    }

    return (
      <div className="home-grid">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    );
  };

  return (
    <main className="home-page o-container">
      <section className="hero-banner">
        <div className="hero-banner__content">
          <div className="hero-banner__label">iPhone 17 Series</div>
          <h1>Up to 10% off Voucher</h1>
          <Link className="hero-banner__cta" to={heroBannerProductLink}>
            Shop Now
          </Link>
        </div>

        <Link
          className="hero-banner__visual"
          to={heroBannerProductLink}
          aria-label="View Iphone 17 Pro Max 256GB details"
        >
          <img
            src="https://www.apple.com/v/iphone-17-pro/e/images/meta/iphone-17-pro_overview__eumhhclcpuaa_og.png"
            alt="Iphone 17 Pro Max 256GB"
          />
        </Link>
        <div className="hero-dots" aria-hidden="true">
          <span></span>
          <span className="is-active"></span>
          <span></span>
        </div>
      </section>

      {searchSummary && (
        <p className="home-search-summary">Filtering by: {searchSummary}</p>
      )}

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="section-subtitle">Today's</p>
            <h2 className="section-title">Flash Sales</h2>
          </div>

          <div className="sale-timer" aria-label="Countdown">
            {timerItems.map((item, index) => (
              <div className="sale-timer__group" key={item.label}>
                <div className="sale-timer__item">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>

                {index < timerItems.length - 1 && (
                  <span className="sale-timer__separator" aria-hidden="true">
                    :
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {renderProductGrid(flashSalesProducts)}

        <div className="section-actions">
          <button type="button" className="btn-view-all">
            View All Products
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="section-subtitle">This Month</p>
            <h2 className="section-title">Best Selling Products</h2>
          </div>

          <button type="button" className="btn-compact">
            View All
          </button>
        </div>

        {renderProductGrid(bestSellingProducts)}
      </section>

      <section className="music-banner">
        <div className="music-banner__content">
          <p>Categories</p>
          <h3>Enhance Your Music Experience</h3>

          <div className="music-banner__countdown" aria-hidden="true">
            <span>23h</span>
            <span>05m</span>
            <span>59s</span>
          </div>

          <button type="button" className="btn-buy-now">
            Buy Now
          </button>
        </div>

        <div className="music-banner__visual" aria-hidden="true">
          <img src={jblSpeaker} alt="JBL Speaker" />
        </div>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="section-subtitle">Our Products</p>
            <h2 className="section-title">Explore Our Products</h2>
          </div>
        </div>

        {renderProductGrid(exploreProducts)}

        <div className="section-actions">
          <button type="button" className="btn-view-all">
            View All Products
          </button>
        </div>
      </section>

      <section className="home-section">
        <div className="section-title-row">
          <div>
            <p className="section-subtitle">Featured</p>
            <h2 className="section-title">New Arrival</h2>
          </div>
        </div>

        <div className="arrival-layout">
          <article className="arrival-card arrival-card--large">
            <div className="arrival-card__content">
              <h3>PlayStation 5</h3>
              <p>Black and White version of the PS5 coming out on sale.</p>
              <a href="#">Shop Now</a>
            </div>
            <img
              className="arrival-card__image arrival-card__image--large"
              src="https://i.ibb.co/BH917f3C/playstation-5.jpg"
              alt="PlayStation 5"
              loading="lazy"
            />
          </article>

          <article className="arrival-card arrival-card--medium">
            <div className="arrival-card__content">
              <h3>Women's Collections</h3>
              <p>Featured woman collections that give you another vibe.</p>
              <a href="#">Shop Now</a>
            </div>
            <img
              className="arrival-card__image arrival-card__image--medium"
              src="https://i.ibb.co/HDnjtfYM/woman-hat.jpg"
              alt="Women's Collections"
              loading="lazy"
            />
          </article>

          <article className="arrival-card">
            <div className="arrival-card__content">
              <h3>Speakers</h3>
              <p>Amazon wireless speakers.</p>
              <a href="#">Shop Now</a>
            </div>
            <img
              className="arrival-card__image"
              src="https://i.ibb.co/d4y3bHvP/speakers-jpg.jpg"
              alt="Speakers"
              loading="lazy"
            />
          </article>

          <article className="arrival-card">
            <div className="arrival-card__content">
              <h3>Perfume</h3>
              <p>Gucci intense oud perfume.</p>
              <a href="#">Shop Now</a>
            </div>
            <img
              className="arrival-card__image"
              src="https://i.ibb.co/M5tdHQDb/perfume.jpg"
              alt="Perfume"
              loading="lazy"
            />
          </article>
        </div>
      </section>

      <section className="service-list" aria-label="Services">
        <article>
          <h4>FREE AND FAST DELIVERY</h4>
          <p>Free delivery for all orders over $140</p>
        </article>

        <article>
          <h4>24/7 CUSTOMER SERVICE</h4>
          <p>Friendly 24/7 customer support</p>
        </article>

        <article>
          <h4>MONEY BACK GUARANTEE</h4>
          <p>We return money within 30 days</p>
        </article>
      </section>
    </main>
  );
}

export default Home;
