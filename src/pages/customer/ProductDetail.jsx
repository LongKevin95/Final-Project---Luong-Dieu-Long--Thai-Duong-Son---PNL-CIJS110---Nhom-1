import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import ProductCard from "../../components/ProductCard";
import { useAuth } from "../../hooks/useAuth";
import { useProductsQuery } from "../../hooks/useProductsQuery";
import "./ProductDetail.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const fallbackImage = "/favicon.svg";

function ProductDetail() {
  const { id } = useParams();
  const { user, isCustomer } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: products = [], isLoading, isError } = useProductsQuery();

  const [quantity, setQuantity] = useState(1);
  const [selectedColorByProduct, setSelectedColorByProduct] = useState({});
  const [selectedSizeByProduct, setSelectedSizeByProduct] = useState({});

  const product = useMemo(
    () => products.find((item) => String(item.id) === String(id)) ?? null,
    [products, id],
  );

  const relatedProducts = useMemo(
    () => products.filter((item) => String(item.id) !== String(id)).slice(0, 4),
    [products, id],
  );

  const selectedColor =
    selectedColorByProduct[id] ?? product?.colors?.[0] ?? "#111111";

  const selectedSize =
    selectedSizeByProduct[id] ??
    product?.sizes?.[2] ??
    product?.sizes?.[0] ??
    "M";

  const galleryImages = useMemo(() => {
    if (!product) return [];

    const images = [
      ...(Array.isArray(product.images) ? product.images : []),
      product.image,
    ].filter(Boolean);

    if (images.length === 0) {
      return [fallbackImage];
    }

    return images.slice(0, 4);
  }, [product]);

  const requireCustomerAccess = () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return false;
    }

    if (!isCustomer) {
      window.alert(
        "Chỉ tài khoản customer mới có thể thêm vào giỏ hàng, mua ngay hoặc lưu yêu thích.",
      );
      return false;
    }

    return true;
  };

  const handleAddToCart = () => {
    if (!requireCustomerAccess()) return;
    window.alert("Added to cart");
  };

  const handleBuyNow = () => {
    if (!requireCustomerAccess()) return;
    window.alert("Proceed to checkout");
  };

  const handleWishlist = () => {
    if (!requireCustomerAccess()) return;
    window.alert("Added to wishlist");
  };

  if (isLoading) {
    return (
      <main className="product-detail-page o-container">
        <div className="product-detail-loader">Loading product detail...</div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="product-detail-page o-container">
        <div className="product-detail-loader product-detail-loader--error">
          Unable to load product data.
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-detail-page o-container">
        <div className="product-detail-loader">
          Product not found. Data source:
          /api/resources/ecommerce-products?apiKey=...
        </div>
      </main>
    );
  }

  return (
    <main className="product-detail-page o-container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Account</Link>
        <span>&gt;</span>
        <span>{product.category}</span>
        <span>&gt;</span>
        <strong>{product.title}</strong>
      </nav>

      <section className="product-detail-layout">
        <div className="product-gallery">
          <div className="product-gallery__thumbs" aria-hidden="true">
            {galleryImages.map((image, index) => (
              <button
                key={`thumb-${index}`}
                type="button"
                className="product-gallery__thumb"
              >
                <img src={image} alt="" />
              </button>
            ))}
          </div>

          <div className="product-gallery__main">
            <img src={galleryImages[0]} alt={product.title} />
          </div>
        </div>

        <div className="product-info">
          <h1>{product.title}</h1>

          <div className="product-info__rating-row">
            <span className="rating-stars">
              {"*".repeat(Math.max(1, Math.round(product.rating || 0)))}
            </span>
            <span className="rating-count">
              ({product.reviews || 0} Reviews)
            </span>
            <span className="stock-state">
              {product.stock > 0 ? "In Stock" : "Out of Stock"}
            </span>
          </div>

          <div className="product-info__price">
            {currency.format(product.price)}
          </div>

          <p className="product-info__description">{product.description}</p>

          <div className="option-row">
            <h3>Colours:</h3>
            <div className="color-options">
              {product.colors.map((colorValue) => (
                <button
                  key={colorValue}
                  type="button"
                  className={`color-option ${
                    selectedColor === colorValue ? "is-active" : ""
                  }`}
                  style={{ "--swatch-color": colorValue }}
                  onClick={() =>
                    setSelectedColorByProduct((prevState) => ({
                      ...prevState,
                      [id]: colorValue,
                    }))
                  }
                >
                  <span className="sr-only">{colorValue}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="option-row">
            <h3>Size:</h3>
            <div className="size-options">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  type="button"
                  className={selectedSize === size ? "is-active" : ""}
                  onClick={() =>
                    setSelectedSizeByProduct((prevState) => ({
                      ...prevState,
                      [id]: size,
                    }))
                  }
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <div className="actions-row">
            <div
              className="quantity-box"
              role="group"
              aria-label="Quantity selector"
            >
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              >
                -
              </button>
              <span>{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((value) => value + 1)}
              >
                +
              </button>
            </div>

            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={handleBuyNow}
            >
              Buy Now
            </button>

            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={handleAddToCart}
            >
              Add To Cart
            </button>

            <button
              type="button"
              className="action-btn action-btn--icon"
              onClick={handleWishlist}
            >
              Fav
            </button>
          </div>

          {!user && (
            <p className="product-detail-helper">
              Bạn có thể xem chi tiết trước. Hãy đăng nhập customer để mua hàng,
              thêm vào giỏ hoặc lưu vào danh sách yêu thích.
            </p>
          )}

          {user && !isCustomer && (
            <p className="product-detail-helper product-detail-helper--warning">
              Tài khoản {user.role} không thể thực hiện các thao tác mua hàng
              của customer.
            </p>
          )}

          <div className="delivery-box">
            <div className="delivery-box__item">
              <h4>Free Delivery</h4>
              <p>Enter your postal code for Delivery Availability</p>
            </div>
            <div className="delivery-box__item">
              <h4>Return Delivery</h4>
              <p>Free 30 Days Delivery Returns.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="related-section">
        <h2>Related Item</h2>

        {relatedProducts.length === 0 ? (
          <p className="related-section__empty">No related items yet.</p>
        ) : (
          <div className="related-grid">
            {relatedProducts.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ProductDetail;
