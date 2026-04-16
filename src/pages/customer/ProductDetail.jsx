import { useCallback, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import ProductCard from "../../components/ProductCard";
import {
  formatProductCategoryLabel,
  upsertVendorReply,
} from "../../api/productApi";
import { useAdminProductsQuery } from "../../hooks/useAdminProductsQuery";
import { useAuth } from "../../hooks/useAuth";
import { useCart } from "../../hooks/useCart";
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

  const userMapByEmail = useMemo(
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
      const vendorProfile = userMapByEmail.get(vendorEmail);

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
    [userMapByEmail],
  );

  const getReviewCustomerName = useCallback(
    (reviewItem) => {
      const reviewCustomerEmail = String(reviewItem?.customerEmail ?? "")
        .trim()
        .toLowerCase();
      const latestUserName = String(
        userMapByEmail.get(reviewCustomerEmail)?.name ?? "",
      ).trim();
      const storedCustomerName = String(reviewItem?.customerName ?? "").trim();

      return (
        latestUserName ||
        storedCustomerName ||
        reviewCustomerEmail ||
        "Customer"
      );
    },
    [userMapByEmail],
  );

  const [quantity, setQuantity] = useState(1);
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockMessage, setStockMessage] = useState("");
  const [selectedColorByProduct, setSelectedColorByProduct] = useState({});
  const [selectedGalleryImageByProduct, setSelectedGalleryImageByProduct] =
    useState({});
  const [selectedSizeByProduct, setSelectedSizeByProduct] = useState({});
  const [replyTextByReview, setReplyTextByReview] = useState({});
  const [processingReplyKey, setProcessingReplyKey] = useState("");

  const previewProduct = useMemo(() => {
    const locationProduct = location.state?.product;

    if (!locationProduct) {
      return null;
    }

    if (String(locationProduct?.id) !== String(id)) {
      return null;
    }

    return locationProduct;
  }, [id, location.state]);

  const resolvedProduct = useMemo(() => {
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

  const product = resolvedProduct ?? previewProduct;

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

  const selectedGalleryImage =
    galleryImages.find(
      (image) => image === selectedGalleryImageByProduct[id],
    ) ??
    galleryImages[0] ??
    fallbackImage;

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
  const isFavorite = hasInWishlist(product?.id);
  const isPrimaryProductLoading =
    !product &&
    (isLoading || (canInspectHiddenProducts && isAdminProductsLoading));
  const isPrimaryProductSettled =
    !isLoading && (!canInspectHiddenProducts || !isAdminProductsLoading);
  const hasPrimaryProductError =
    isError || (canInspectHiddenProducts && isAdminProductsError);
  const shouldShowProductError =
    !product && hasPrimaryProductError && isPrimaryProductSettled;
  const shouldShowProductNotFound =
    !product && !shouldShowProductError && isPrimaryProductSettled;
  const areRelatedProductsLoading = isLoading && products.length === 0;
  const shouldShowReviewsLoading =
    Boolean(product) &&
    !Array.isArray(product?.reviewsData) &&
    (isLoading || (canInspectHiddenProducts && isAdminProductsLoading));

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

  return (
    <main className="product-detail-page o-container">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Account</Link>
        <span>&gt;</span>
        <span>
          {product ? formatProductCategoryLabel(product.category) : "Product"}
        </span>
        <span>&gt;</span>
        <strong>{product?.title || "Product Detail"}</strong>
      </nav>

      {product ? (
        <>
          <section className="product-detail-layout">
            <div className="product-gallery">
              <div className="product-gallery__thumbs">
                {galleryImages.map((image, index) => (
                  <button
                    key={`thumb-${index}`}
                    type="button"
                    className={`product-gallery__thumb ${
                      selectedGalleryImage === image ? "is-active" : ""
                    }`}
                    onClick={() =>
                      setSelectedGalleryImageByProduct((previous) => ({
                        ...previous,
                        [id]: image,
                      }))
                    }
                    aria-pressed={selectedGalleryImage === image}
                  >
                    <img src={image} alt="" />
                  </button>
                ))}
              </div>

              <div className="product-gallery__main">
                <img src={selectedGalleryImage} alt={product.title} />
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

                <p className="product-info__description">
                  {product.description}
                </p>
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
                      onClick={() =>
                        setQuantity((value) => Math.max(1, value - 1))
                      }
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
                    Tai khoan{" "}
                    {(user.roles ?? []).join(", ") || "khong xac dinh"} khong co
                    quyen mua hang. Vendor chi duoc xem chi tiet va quan ly san
                    pham cua shop minh.
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
                {shouldShowReviewsLoading ? (
                  <div className="product-reviews__list">
                    {Array.from({ length: 2 }).map((_, index) => (
                      <article
                        key={`review-skeleton-${index}`}
                        className="product-review-item"
                        aria-hidden="true"
                      >
                        <div className="product-detail-skeleton product-detail-skeleton--review-title" />
                        <div className="product-detail-skeleton product-detail-skeleton--review-line" />
                        <div className="product-detail-skeleton product-detail-skeleton--review-line product-detail-skeleton--review-line-short" />
                      </article>
                    ))}
                  </div>
                ) : Array.isArray(product?.reviewsData) &&
                  product.reviewsData.length > 0 ? (
                  <div className="product-reviews__list">
                    {product.reviewsData.map((reviewItem, index) => (
                      <article
                        key={`${reviewItem.customerEmail}-${reviewItem.createdAt}-${index}`}
                        className="product-review-item"
                      >
                        <header>
                          <strong>{getReviewCustomerName(reviewItem)}</strong>
                          <span>
                            {"★".repeat(Number(reviewItem.stars ?? 0))}
                          </span>
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
            </div>
          </section>
        </>
      ) : isPrimaryProductLoading ? (
        <section className="product-detail-layout product-detail-layout--loading">
          <div className="product-gallery" aria-hidden="true">
            <div className="product-gallery__thumbs">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={`thumb-skeleton-${index}`}
                  className="product-gallery__thumb product-gallery__thumb--skeleton product-detail-skeleton"
                />
              ))}
            </div>

            <div className="product-gallery__main product-gallery__main--skeleton product-detail-skeleton" />
          </div>

          <div className="product-info">
            <div
              className="product-info-card product-info-card--loading"
              aria-hidden="true"
            >
              <div className="product-info__loading">
                <div className="product-detail-skeleton product-detail-skeleton--title" />
                <div className="product-detail-skeleton product-detail-skeleton--meta" />
                <div className="product-detail-skeleton product-detail-skeleton--price" />
                <div className="product-detail-skeleton product-detail-skeleton--line" />
                <div className="product-detail-skeleton product-detail-skeleton--line" />
                <div className="product-detail-skeleton product-detail-skeleton--line product-detail-skeleton--line-short" />
                <div className="product-detail-skeleton product-detail-skeleton--actions" />
                <div className="product-detail-skeleton product-detail-skeleton--delivery" />
              </div>
            </div>
          </div>
        </section>
      ) : shouldShowProductError ? (
        <div className="product-detail-loader product-detail-loader--error">
          Unable to load product data.
        </div>
      ) : shouldShowProductNotFound ? (
        <div className="product-detail-loader">
          Product not found. Data source:
          /api/resources/ecommerce-products?apiKey=...
        </div>
      ) : null}

      <section className="related-section">
        <h2>Related Item</h2>

        {areRelatedProductsLoading ? (
          <div
            className="related-grid related-grid--loading"
            aria-hidden="true"
          >
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={`related-skeleton-${index}`}
                className="product-detail-card-skeleton"
              />
            ))}
          </div>
        ) : relatedProducts.length === 0 ? (
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
