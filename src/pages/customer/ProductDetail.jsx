import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import ProductCard from "../../components/ProductCard";
import {
  addProductReview,
  formatProductCategoryLabel,
  upsertVendorReply,
} from "../../api/productApi";
import { useAdminProductsQuery } from "../../hooks/useAdminProductsQuery";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
import { useOrdersQuery } from "../../hooks/useOrdersQuery";
import { useProductsQuery } from "../../hooks/useProductsQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import { useWishlist } from "../../hooks/useWishlist";
import "./ProductDetail.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const fallbackImage = "/favicon.svg";

function ProductDetail() {
  const { id } = useParams();
  const { user, isAdmin, isCustomer, isVendor } = useAuth();
  const { addToCart } = useCart();
  const { hasInWishlist, toggleWishlistItem } = useWishlist();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const canInspectHiddenProducts = isAdmin || isVendor;

  const { data: products = [], isLoading, isError } = useProductsQuery();
  const {
    data: adminProducts = [],
    isLoading: isAdminProductsLoading,
    isError: isAdminProductsError,
  } = useAdminProductsQuery({
    enabled: canInspectHiddenProducts,
  });
  const { data: users = [] } = useUsersQuery();
  const { data: orders = [] } = useOrdersQuery();

  const vendorMapByEmail = useMemo(
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

  const withVendorDisplay = useCallback(
    (productItem) => {
      const vendorEmail = String(productItem?.vendorEmail ?? "")
        .trim()
        .toLowerCase();
      const vendorProfile = vendorMapByEmail.get(vendorEmail);

      if (!vendorProfile) {
        return productItem;
      }

      return {
        ...productItem,
        shopName:
          vendorProfile?.shopName ||
          vendorProfile?.name ||
          productItem?.shopName,
        vendorAvatarUrl:
          vendorProfile?.avatarUrl || productItem?.vendorAvatarUrl,
      };
    },
    [vendorMapByEmail],
  );

  const [quantity, setQuantity] = useState(1);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMessage, setStockMessage] = useState("");
  const [selectedColorByProduct, setSelectedColorByProduct] = useState({});
  const [selectedSizeByProduct, setSelectedSizeByProduct] = useState({});
  const [reviewComment, setReviewComment] = useState("");
  const [reviewStars, setReviewStars] = useState(5);
  const [replyTextByReview, setReplyTextByReview] = useState({});
  const [processingReplyKey, setProcessingReplyKey] = useState("");

  const product = useMemo(() => {
    const matched =
      products.find((item) => String(item.id) === String(id)) ?? null;

    if (matched) {
      return withVendorDisplay(matched);
    }

    if (!canInspectHiddenProducts) {
      return null;
    }

    const adminMatched =
      adminProducts.find((item) => String(item.id) === String(id)) ?? null;

    if (!adminMatched) {
      return null;
    }

    if (isAdmin) {
      return withVendorDisplay(adminMatched);
    }

    const productVendorEmail = String(adminMatched?.vendorEmail ?? "")
      .trim()
      .toLowerCase();
    const currentUserEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();

    if (isVendor && productVendorEmail === currentUserEmail) {
      return withVendorDisplay(adminMatched);
    }

    return null;
  }, [
    adminProducts,
    canInspectHiddenProducts,
    id,
    isAdmin,
    isVendor,
    products,
    user?.email,
    withVendorDisplay,
  ]);

  const relatedProducts = useMemo(
    () =>
      products
        .filter((item) => String(item.id) !== String(id))
        .map((item) => withVendorDisplay(item))
        .slice(0, 4),
    [products, id, withVendorDisplay],
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
      product.image,
      ...(Array.isArray(product.images) ? product.images : []),
    ].filter(Boolean);

    const uniqueImages = [...new Set(images)];

    if (uniqueImages.length === 0) {
      return [fallbackImage];
    }

    return uniqueImages.slice(0, 4);
  }, [product]);

  const productColors = Array.isArray(product?.colors) ? product.colors : [];
  const productSizes = Array.isArray(product?.sizes) ? product.sizes : [];
  const normalizedStatus = String(product?.status ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(" ", "_");
  const isOutOfStock =
    Number(product?.stock) <= 0 || normalizedStatus === "out_of_stock";

  const isCustomerAccount = isCustomer && !isVendor;
  const canPurchase = isCustomerAccount;
  const vendorShopLabel =
    product?.shopName ||
    product?.vendorName ||
    (product?.vendorEmail
      ? String(product.vendorEmail).split("@")[0]
      : "L&S Store");
  const isVendorOwnerOfProduct =
    isVendor &&
    String(user?.email ?? "")
      .trim()
      .toLowerCase() ===
      String(product?.vendorEmail ?? "")
        .trim()
        .toLowerCase();
  const isPurchaseDisabled = isOutOfStock || isAdmin || isVendorOwnerOfProduct;

  const userPurchasedThisProduct = useMemo(() => {
    if (!isCustomerAccount) {
      return false;
    }

    const userEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();

    if (!userEmail) {
      return false;
    }

    return orders.some((order) => {
      const orderCustomerEmail = String(order?.customerEmail ?? "")
        .trim()
        .toLowerCase();
      const orderStatus = String(order?.status ?? "")
        .trim()
        .toLowerCase();

      if (
        orderCustomerEmail !== userEmail ||
        !["completed", "delivered"].includes(orderStatus)
      ) {
        return false;
      }

      const items = Array.isArray(order?.items) ? order.items : [];
      return items.some(
        (item) => String(item?.productId ?? "") === String(product?.id ?? ""),
      );
    });
  }, [isCustomerAccount, orders, product?.id, user?.email]);

  const userReviewedThisProduct = (() => {
    const userEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();

    if (!userEmail || !Array.isArray(product?.reviewsData)) {
      return false;
    }

    return product.reviewsData.some(
      (item) =>
        String(item?.customerEmail ?? "")
          .trim()
          .toLowerCase() === userEmail,
    );
  })();

  const canReview = userPurchasedThisProduct && !userReviewedThisProduct;
  const isFavorite = hasInWishlist(product?.id);

  const requireCustomerAccess = () => {
    if (!user) {
      navigate("/login", { state: { from: location } });
      return false;
    }

    if (!canPurchase) {
      window.alert(
        "Chi tai khoan customer moi co the mua hang, them gio va wishlist.",
      );
      return false;
    }

    return true;
  };

  const handleAddToCart = () => {
    if (!requireCustomerAccess()) return;

    if (isOutOfStock) {
      window.alert("Sản phẩm hiện đang hết hàng.");
      return;
    }

    addToCart(product, quantity, {
      color: selectedColor,
      size: selectedSize,
    });

    window.alert("Đã thêm vào giỏ hàng.");
  };

  const handleBuyNow = () => {
    if (!requireCustomerAccess()) return;

    if (isOutOfStock) {
      window.alert("Sản phẩm hiện đang hết hàng.");
      return;
    }

    addToCart(product, quantity, {
      color: selectedColor,
      size: selectedSize,
    });

    navigate("/checkout");
  };

  const handleWishlist = () => {
    if (!requireCustomerAccess()) return;

    const added = toggleWishlistItem(product);
    window.alert(added ? "Đã thêm vào wishlist." : "Đã xóa khỏi wishlist.");
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();

    if (!user) {
      window.alert("Vui long dang nhap de danh gia san pham.");
      return;
    }

    if (!userPurchasedThisProduct) {
      window.alert("Ban can mua san pham truoc khi de lai danh gia.");
      return;
    }

    if (userReviewedThisProduct) {
      window.alert("Moi tai khoan chi duoc review san pham nay 1 lan.");
      return;
    }

    const trimmedComment = reviewComment.trim();

    if (!trimmedComment) {
      window.alert("Vui long nhap binh luan truoc khi gui.");
      return;
    }

    try {
      await addProductReview({
        productId: product.id,
        review: {
          customerEmail: user.email,
          customerName: user.name ?? user.email,
          comment: trimmedComment,
          stars: reviewStars,
        },
      });

      setReviewComment("");
      setReviewStars(5);
      await queryClient.invalidateQueries({ queryKey: ["products", "public"] });
      await queryClient.invalidateQueries({ queryKey: ["products", "admin"] });
    } catch (error) {
      window.alert(error?.message ?? "Khong the gui danh gia.");
    }
  };

  const handleVendorReply = async (reviewItem) => {
    if (!isVendorOwnerOfProduct) {
      return;
    }

    const reviewKey = `${reviewItem?.customerEmail ?? ""}-${reviewItem?.createdAt ?? ""}`;
    const replyText = String(replyTextByReview[reviewKey] ?? "").trim();

    if (!replyText) {
      window.alert("Vui long nhap noi dung phan hoi.");
      return;
    }

    try {
      setProcessingReplyKey(reviewKey);

      await upsertVendorReply({
        productId: product.id,
        reviewCreatedAt: reviewItem.createdAt,
        customerEmail: reviewItem.customerEmail,
        vendorEmail: user?.email,
        replyText,
      });

      setReplyTextByReview((previous) => ({
        ...previous,
        [reviewKey]: "",
      }));

      await queryClient.invalidateQueries({ queryKey: ["products", "public"] });
      await queryClient.invalidateQueries({ queryKey: ["products", "admin"] });
    } catch (error) {
      window.alert(error?.message ?? "Khong the gui phan hoi.");
    } finally {
      setProcessingReplyKey("");
    }
  };

  if (isLoading || (canInspectHiddenProducts && isAdminProductsLoading)) {
    return (
      <main className="product-detail-page o-container">
        <div className="product-detail-loader">Loading product detail...</div>
      </main>
    );
  }

  if (isError || (canInspectHiddenProducts && isAdminProductsError)) {
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
        <span>{formatProductCategoryLabel(product.category)}</span>
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
          <div className="product-info-card">
            <h1>{product.title}</h1>

            <div className="product-info__rating-row">
              <span className="rating-stars">
                {"★".repeat(Math.max(1, Math.round(product.rating || 0)))}
              </span>
              <span className="rating-count">
                ({product.reviews || 0} Reviews)
              </span>
              <span
                className={`stock-state ${
                  isOutOfStock ? "stock-state--out" : "stock-state--in"
                }`}
              >
                {isOutOfStock ? "Out of Stock" : "In Stock"}
              </span>
            </div>

            <div className="product-info__price">
              {currency.format(product.price)}
            </div>

            <p className="product-info__description">{product.description}</p>
            <p className="product-shop-label">Sold by: {vendorShopLabel}</p>

            {productColors.length > 0 && (
              <div className="option-row">
                <h3>Colours:</h3>
                <div className="color-options">
                  {productColors.map((colorValue) => (
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
            )}

            {productSizes.length > 0 && (
              <div className="option-row">
                <h3>Size:</h3>
                <div className="size-options">
                  {productSizes.map((size) => (
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
            )}

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
                  onClick={() => {
                    const currentStock = Number(product?.stock ?? 0);
                    if (quantity >= currentStock) {
                      setStockMessage(`Chỉ còn ${currentStock} sản phẩm.`);
                      setShowStockModal(true);
                    } else {
                      setQuantity((value) => value + 1);
                    }
                  }}
                >
                  +
                </button>
              </div>

              <button
                type="button"
                className="action-btn action-btn--primary"
                disabled={isPurchaseDisabled}
                onClick={handleBuyNow}
              >
                Buy Now
              </button>

              <button
                type="button"
                className="action-btn action-btn--primary"
                disabled={isPurchaseDisabled}
                onClick={handleAddToCart}
              >
                Add To Cart
              </button>

              {isCustomerAccount ? (
                <button
                  type="button"
                  className="action-btn action-btn--icon"
                  onClick={handleWishlist}
                >
                  {isFavorite ? "Unfav" : "Fav"}
                </button>
              ) : isVendorOwnerOfProduct ? (
                <Link
                  className="action-btn action-btn--primary action-btn--link"
                  to={`/vendor/products?edit=${product.id}`}
                >
                  Edit my product
                </Link>
              ) : null}
            </div>

            {!user && (
              <p className="product-detail-helper">
                Bạn có thể xem chi tiết trước. Hãy đăng nhập customer để mua
                hàng, thêm vào giỏ hoặc lưu vào danh sách yêu thích.
              </p>
            )}

            {user && !canPurchase && (
              <p className="product-detail-helper product-detail-helper--warning">
                Tai khoan {(user.roles ?? []).join(", ") || "khong xac dinh"}{" "}
                khong co quyen mua hang. Vendor chi duoc xem chi tiet va quan ly
                san pham cua shop minh.
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
        </div>
      </section>

      <section className="product-reviews">
        <h3>Customer Reviews</h3>

        <div className="product-reviews__layout">
          <div className="product-reviews__list-wrap">
            {Array.isArray(product?.reviewsData) &&
            product.reviewsData.length > 0 ? (
              <div className="product-reviews__list">
                {product.reviewsData.map((reviewItem, index) => (
                  <article
                    key={`${reviewItem.customerEmail}-${reviewItem.createdAt}-${index}`}
                    className="product-review-item"
                  >
                    <header>
                      <strong>{reviewItem.customerName}</strong>
                      <span>{"★".repeat(Number(reviewItem.stars ?? 0))}</span>
                    </header>
                    <p>{reviewItem.comment}</p>
                    {reviewItem?.vendorReply?.text && (
                      <div className="product-review-reply">
                        <strong>Shop reply:</strong>
                        <p>{reviewItem.vendorReply.text}</p>
                      </div>
                    )}

                    {isVendorOwnerOfProduct && (
                      <div className="product-review-reply-form">
                        <textarea
                          rows="2"
                          placeholder="Reply to this customer..."
                          value={
                            replyTextByReview[
                              `${reviewItem.customerEmail}-${reviewItem.createdAt}`
                            ] ?? ""
                          }
                          onChange={(event) =>
                            setReplyTextByReview((previous) => ({
                              ...previous,
                              [`${reviewItem.customerEmail}-${reviewItem.createdAt}`]:
                                event.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          onClick={() => handleVendorReply(reviewItem)}
                          disabled={
                            processingReplyKey ===
                            `${reviewItem.customerEmail}-${reviewItem.createdAt}`
                          }
                        >
                          {processingReplyKey ===
                          `${reviewItem.customerEmail}-${reviewItem.createdAt}`
                            ? "Replying..."
                            : "Reply"}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="product-detail-helper">
                Chua co danh gia nao cho san pham nay.
              </p>
            )}
          </div>

          <form className="product-review-form" onSubmit={handleSubmitReview}>
            <h4>Write a review</h4>
            {isVendor && (
              <p className="product-review-note">
                Vendor khong duoc mua hang va khong duoc review nhu customer.
              </p>
            )}
            {!user && (
              <p className="product-review-note">
                Dang nhap de danh gia san pham.
              </p>
            )}
            {user && !userPurchasedThisProduct && (
              <p className="product-review-note">
                Chi nguoi da mua hang moi co the danh gia.
              </p>
            )}
            {user && userReviewedThisProduct && (
              <p className="product-review-note">
                Ban da danh gia san pham nay, moi tai khoan chi review 1 lan.
              </p>
            )}
            <label>
              Stars
              <select
                value={reviewStars}
                onChange={(event) => setReviewStars(Number(event.target.value))}
                disabled={!canReview}
              >
                <option value={5}>5</option>
                <option value={4}>4</option>
                <option value={3}>3</option>
                <option value={2}>2</option>
                <option value={1}>1</option>
              </select>
            </label>
            <label>
              Comment
              <textarea
                rows="5"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                placeholder={
                  canReview
                    ? "Share your experience..."
                    : userReviewedThisProduct
                      ? "Ban da gui review cho san pham nay"
                      : "Chi nguoi da mua hang moi co the danh gia"
                }
                disabled={!canReview}
              />
            </label>
            <button type="submit" disabled={!canReview}>
              Submit review
            </button>
          </form>
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

      {showStockModal && (
        <div
          className="stock-modal-overlay"
          onClick={() => setShowStockModal(false)}
        >
          <div className="stock-modal" onClick={(e) => e.stopPropagation()}>
            <p>{stockMessage}</p>
            <button onClick={() => setShowStockModal(false)}>Đóng</button>
          </div>
        </div>
      )}
    </main>
  );
}

export default ProductDetail;
