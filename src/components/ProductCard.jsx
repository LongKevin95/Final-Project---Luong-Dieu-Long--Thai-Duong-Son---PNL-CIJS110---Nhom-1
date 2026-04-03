import { Link } from "react-router-dom";

import "./ProductCard.css";

const fallbackImage = "/favicon.svg";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function ProductCard({ product }) {
  const image = product?.image || fallbackImage;
  const isOnSale = Number(product?.discountPercentage) > 0;

  return (
    <article className="product-card">
      <Link className="product-card__media" to={`/product/${product.id}`}>
        {isOnSale && (
          <span className="product-card__badge">
            -{product.discountPercentage}%
          </span>
        )}
        <img src={image} alt={product.title} loading="lazy" />
      </Link>

      <div className="product-card__content">
        <Link className="product-card__title" to={`/product/${product.id}`}>
          {product.title}
        </Link>

        <div className="product-card__price-row">
          <span className="product-card__price">
            {currency.format(product.price)}
          </span>
          {product.oldPrice > product.price && (
            <span className="product-card__old-price">
              {currency.format(product.oldPrice)}
            </span>
          )}
        </div>

        <div className="product-card__meta">
          <span className="product-card__rating">
            {"*".repeat(Math.max(1, Math.round(product.rating || 0)))}
          </span>
          <span className="product-card__reviews">
            ({product.reviews || 0})
          </span>
        </div>
      </div>
    </article>
  );
}

export default ProductCard;
