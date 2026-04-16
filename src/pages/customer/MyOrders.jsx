import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { updateOrderById } from "../../api/ordersApi";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import { useAuth } from "../../hooks/useAuth";
import { useOrdersQuery } from "../../hooks/useOrdersQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./MyOrders.css";

const currency = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("vi-VN");
}

const ORDER_TABS = [
  { key: "all", label: "All" },
  { key: "to_confirm", label: "To Confirm" },
  { key: "to_ship", label: "To Ship" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const ORDER_STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
};

function normalizeOrderStatus(value) {
  const rawStatus = String(value ?? "pending")
    .trim()
    .toLowerCase();

  if (rawStatus === "delivery" || rawStatus === "delivered") {
    return "completed";
  }

  if (rawStatus === "canceled") {
    return "cancelled";
  }

  if (["pending", "processing", "completed", "cancelled"].includes(rawStatus)) {
    return rawStatus;
  }

  return "pending";
}

function getOrderTabKey(status) {
  const normalizedStatus = normalizeOrderStatus(status);

  if (normalizedStatus === "pending") {
    return "to_confirm";
  }

  if (normalizedStatus === "processing") {
    return "to_ship";
  }

  if (normalizedStatus === "completed" || normalizedStatus === "cancelled") {
    return normalizedStatus;
  }

  return "all";
}

function getOrderStatusLabel(status) {
  return ORDER_STATUS_LABELS[normalizeOrderStatus(status)] ?? "Pending";
}

function buildShopList(orderItems, vendorMapByEmail) {
  const uniqueShopMap = new Map();

  for (const orderItem of orderItems) {
    const vendorEmail = String(orderItem?.vendorEmail ?? "")
      .trim()
      .toLowerCase();
    const vendorProfile = vendorMapByEmail.get(vendorEmail);
    const shopName =
      vendorProfile?.shopName ||
      vendorProfile?.name ||
      orderItem?.shopName ||
      (vendorEmail ? vendorEmail.split("@")[0] : "Shop");
    const avatarUrl = String(vendorProfile?.avatarUrl ?? "").trim();
    const shopKey = vendorEmail || String(shopName).trim().toLowerCase();

    if (!shopKey || uniqueShopMap.has(shopKey)) {
      continue;
    }

    uniqueShopMap.set(shopKey, {
      vendorEmail,
      shopName,
      avatarUrl,
    });
  }

  return Array.from(uniqueShopMap.values());
}

function buildOrderSearchText(order, orderItems, shops, statusLabel) {
  const shippingAddress =
    order?.shippingAddress && typeof order.shippingAddress === "object"
      ? order.shippingAddress
      : {};

  return [
    order?.id,
    order?.customerName,
    order?.customerEmail,
    order?.contactEmail,
    order?.customerPhone,
    shippingAddress.fullName,
    shippingAddress.address,
    shippingAddress.city,
    shippingAddress.state,
    shops.map((shop) => shop.shopName).join(" "),
    orderItems
      .map((item) => [item?.title, item?.sku, item?.color, item?.size])
      .flat()
      .filter(Boolean)
      .join(" "),
    statusLabel,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function MyOrders() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orders = [], isLoading: isOrdersLoading } = useOrdersQuery();
  const { data: users = [], isLoading: isUsersLoading } = useUsersQuery();
  const [cancelReasonByOrder, setCancelReasonByOrder] = useState({});
  const [cancelReasonErrorByOrder, setCancelReasonErrorByOrder] = useState({});
  const cancelReasonInputRefs = useRef({});
  const [processingOrderId, setProcessingOrderId] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

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

  const userEmail = String(user?.email ?? "")
    .trim()
    .toLowerCase();

  const myOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderEmail = String(order?.customerEmail ?? "")
        .trim()
        .toLowerCase();
      return orderEmail && orderEmail === userEmail;
    });
  }, [orders, userEmail]);

  const ordersWithMeta = useMemo(() => {
    return myOrders.map((order) => {
      const orderId = String(order?.id ?? "").trim();
      const status = normalizeOrderStatus(order?.status);
      const statusLabel = getOrderStatusLabel(status);
      const statusGroup = getOrderTabKey(status);
      const orderItems = Array.isArray(order?.items) ? order.items : [];
      const shops = buildShopList(orderItems, vendorMapByEmail);
      const firstShop = shops[0] ?? null;
      const visibleItems = orderItems.slice(0, 3);
      const hiddenItemsCount = Math.max(
        0,
        orderItems.length - visibleItems.length,
      );

      return {
        ...order,
        orderId,
        status,
        statusLabel,
        statusGroup,
        orderItems,
        shops,
        firstShopName: firstShop?.shopName || "Shop",
        firstShopAvatar: firstShop?.avatarUrl || "",
        firstShopEmail: firstShop?.vendorEmail || "",
        visibleItems,
        hiddenItemsCount,
        canCancel: status === "pending",
        searchText: buildOrderSearchText(order, orderItems, shops, statusLabel),
        createdAtTime: new Date(
          order?.createdAt ?? order?.updatedAt ?? 0,
        ).getTime(),
        updatedAtTime: new Date(
          order?.updatedAt ?? order?.createdAt ?? 0,
        ).getTime(),
        orderTotal: Number(order?.total ?? 0),
        cancellationReason: String(order?.cancellation?.reason ?? "").trim(),
        cancellationAt: order?.cancellation?.at ?? null,
        displayDate: formatDate(order?.createdAt),
      };
    });
  }, [myOrders, vendorMapByEmail]);

  const tabCounts = useMemo(() => {
    const counts = {
      all: ordersWithMeta.length,
      to_confirm: 0,
      to_ship: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const order of ordersWithMeta) {
      if (counts[order.statusGroup] !== undefined) {
        counts[order.statusGroup] += 1;
      }
    }

    return counts;
  }, [ordersWithMeta]);

  const visibleOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...ordersWithMeta]
      .filter((order) => {
        if (activeTab !== "all" && order.statusGroup !== activeTab) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return order.searchText.includes(normalizedSearch);
      })
      .sort((left, right) => {
        const leftTime = Number.isFinite(left.updatedAtTime)
          ? left.updatedAtTime
          : left.createdAtTime;
        const rightTime = Number.isFinite(right.updatedAtTime)
          ? right.updatedAtTime
          : right.createdAtTime;

        return rightTime - leftTime;
      });
  }, [activeTab, ordersWithMeta, searchTerm]);

  const isPageLoading = isOrdersLoading || isUsersLoading;

  const handleCustomerCancelOrder = async (order) => {
    const orderId = String(order?.id ?? "").trim();
    const status = String(order?.status ?? "")
      .trim()
      .toLowerCase();

    if (!orderId || status !== "pending") {
      return;
    }

    const reason = String(cancelReasonByOrder[orderId] ?? "").trim();

    if (!reason) {
      setCancelReasonErrorByOrder((previous) => ({
        ...previous,
        [orderId]: true,
      }));

      cancelReasonInputRefs.current[orderId]?.focus();
      return;
    }

    try {
      setProcessingOrderId(orderId);

      await updateOrderById({
        id: orderId,
        actor: "customer",
        updates: {
          status: "cancelled",
          cancellation: {
            by: "customer",
            reason,
            at: new Date().toISOString(),
          },
        },
      });

      setCancelReasonByOrder((previous) => ({
        ...previous,
        [orderId]: "",
      }));
      setCancelReasonErrorByOrder((previous) => ({
        ...previous,
        [orderId]: false,
      }));

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      window.alert(error?.message ?? "Khong the huy don hang.");
    } finally {
      setProcessingOrderId("");
    }
  };

  return (
    <>
      <Header />

      <main className="my-orders-page o-container">
        <nav className="my-orders-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span>&gt;</span>
          <strong>Đơn mua</strong>
        </nav>

        <section className="my-orders-panel">
          <div className="my-orders-header-wrapper">
            <div>
              <h1>Đơn hàng của bạn</h1>
              <p>
                Theo dõi trạng thái đơn, xem nhanh sản phẩm và hủy đơn khi còn
                có thể.
              </p>
            </div>
            <div className="my-orders-hero__stat">
              <strong>{myOrders.length}</strong>
              <span>đơn hàng</span>
            </div>
          </div>
          <div className="my-orders-toolbar">
            <label
              className="my-orders-search"
              htmlFor="my-orders-search-input"
            >
              <span className="my-orders-search__icon" aria-hidden="true">
                ⌕
              </span>
              <input
                id="my-orders-search-input"
                type="search"
                placeholder="Tìm theo mã đơn, tên shop hoặc sản phẩm"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>

            <div
              className="my-orders-tabs"
              role="tablist"
              aria-label="Order status tabs"
            >
              {ORDER_TABS.map((tab) => {
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`my-orders-tab${isActive ? " is-active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <span>{tab.label}</span>
                    <span className="my-orders-tab__count">
                      {tabCounts[tab.key] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {isPageLoading ? (
            <section className="my-orders-loading" aria-live="polite">
              <p>Đang tải đơn hàng</p>
            </section>
          ) : myOrders.length === 0 ? (
            <div className="my-orders-empty-state">
              <div className="my-orders-empty-state__icon" aria-hidden="true">
                🛍️
              </div>
              <h2>Bạn chưa có đơn hàng nào</h2>
              <p>Hãy mua sắm để các đơn hàng của bạn xuất hiện tại đây.</p>
              <Link
                to="/"
                className="my-orders-button my-orders-button--primary"
              >
                Mua sắm ngay
              </Link>
            </div>
          ) : visibleOrders.length === 0 ? (
            <div className="my-orders-empty-state">
              <div className="my-orders-empty-state__icon" aria-hidden="true">
                🔎
              </div>
              <h2>Không tìm thấy đơn hàng phù hợp</h2>
              <p>Thử đổi tab hoặc xóa từ khóa tìm kiếm để xem các đơn khác.</p>
              <button
                type="button"
                className="my-orders-button my-orders-button--secondary"
                onClick={() => {
                  setActiveTab("all");
                  setSearchTerm("");
                }}
              >
                Xóa bộ lọc
              </button>
            </div>
          ) : (
            <div className="my-orders-list">
              {visibleOrders.map((order, index) => {
                const orderId = order.orderId || `#${index + 1}`;
                const isCancelled = order.status === "cancelled";
                const isCompleted = order.status === "completed";
                const canCancel = order.canCancel && !isCancelled;
                const cancelReason = String(
                  cancelReasonByOrder[order.orderId] ?? "",
                );
                const hasCancelReasonError = Boolean(
                  cancelReasonErrorByOrder[order.orderId],
                );
                const cancelReasonErrorId = hasCancelReasonError
                  ? `cancel-reason-error-${order.orderId}`
                  : undefined;
                const shopHref = order.firstShopEmail
                  ? `/shops/${encodeURIComponent(order.firstShopEmail)}`
                  : "/shops";
                const isCancelling = processingOrderId === order.orderId;

                return (
                  <article
                    key={order.orderId || `my-order-${index}`}
                    className="my-orders-card"
                  >
                    <header className="my-orders-card__top">
                      <div className="my-orders-card__shop">
                        <div
                          className="my-orders-card__avatar"
                          aria-hidden="true"
                        >
                          {order.firstShopAvatar ? (
                            <img
                              src={order.firstShopAvatar}
                              alt=""
                              loading="lazy"
                            />
                          ) : (
                            <span>
                              {String(order.firstShopName || "S")
                                .trim()
                                .charAt(0)
                                .toUpperCase() || "S"}
                            </span>
                          )}
                        </div>

                        <div className="my-orders-card__shop-copy">
                          <div className="my-orders-card__shop-line">
                            <strong>{order.firstShopName}</strong>
                            <Link to={shopHref} className="my-orders-shop-link">
                              Xem shop
                            </Link>
                          </div>
                          <p>
                            Đơn hàng {orderId} · {order.displayDate}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`my-orders-status-pill my-orders-status-pill--${order.status}`}
                      >
                        {order.statusLabel}
                      </span>
                    </header>

                    <div className="my-orders-card__items">
                      {order.visibleItems.map((item, itemIndex) => {
                        const itemQuantity = Number(item?.quantity ?? 0);
                        const safeQuantity =
                          Number.isFinite(itemQuantity) && itemQuantity > 0
                            ? itemQuantity
                            : 1;
                        const itemVariant = [
                          item?.color ? `Màu ${item.color}` : null,
                          item?.size ? `Size ${item.size}` : null,
                          item?.sku ? `SKU ${item.sku}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ");

                        return (
                          <div
                            key={`${order.orderId}-${item?.productId ?? itemIndex}`}
                            className="my-orders-item"
                          >
                            <div
                              className="my-orders-item__thumb"
                              aria-hidden="true"
                            >
                              <img
                                src={item?.image || "/favicon.svg"}
                                alt=""
                                loading="lazy"
                              />
                            </div>

                            <div className="my-orders-item__content">
                              <h3>{item?.title || "Product"}</h3>
                              <div className="my-orders-item__meta">
                                <span>
                                  {itemVariant || "Phân loại mặc định"}
                                </span>
                                <span>x{safeQuantity}</span>
                              </div>
                            </div>

                            <div className="my-orders-item__price">
                              {currency.format(Number(item?.price ?? 0))}
                            </div>
                          </div>
                        );
                      })}

                      {order.hiddenItemsCount > 0 ? (
                        <p className="my-orders-card__more-items">
                          +{order.hiddenItemsCount} sản phẩm khác
                        </p>
                      ) : null}
                    </div>

                    <footer className="my-orders-card__footer">
                      <div className="my-orders-card__note">
                        {isCancelled ? (
                          <>
                            <span className="my-orders-card__note-label">
                              Đã hủy
                            </span>
                            <p>
                              {order.cancellationReason ||
                                "Đơn hàng đã được hủy."}
                            </p>
                            {order.cancellationAt ? (
                              <small>
                                Hủy lúc {formatDate(order.cancellationAt)}
                              </small>
                            ) : null}
                          </>
                        ) : isCompleted ? (
                          <p>
                            Đơn hàng đã hoàn tất. Bạn có thể xem lại bất cứ lúc
                            nào.
                          </p>
                        ) : order.status === "pending" ? (
                          <p>
                            Đơn đang ở trạng thái chờ xác nhận. Bạn có thể hủy
                            đơn trong giai đoạn này.
                          </p>
                        ) : (
                          <p>
                            Đơn đang ở trạng thái{" "}
                            {order.statusLabel.toLowerCase()}. Đơn này không thể
                            hủy từ trang này.
                          </p>
                        )}

                        {canCancel ? (
                          <label
                            className="my-orders-cancel"
                            htmlFor={`cancel-${order.orderId}`}
                          >
                            <div className="my-orders-cancel__header">
                              <span>Lý do hủy đơn</span>
                            </div>
                            <textarea
                              id={`cancel-${order.orderId}`}
                              rows="2"
                              placeholder="Nhập lý do hủy đơn"
                              ref={(element) => {
                                if (element) {
                                  cancelReasonInputRefs.current[order.orderId] =
                                    element;
                                } else {
                                  delete cancelReasonInputRefs.current[
                                    order.orderId
                                  ];
                                }
                              }}
                              aria-invalid={hasCancelReasonError}
                              aria-describedby={cancelReasonErrorId}
                              className={`my-orders-cancel__textarea${
                                hasCancelReasonError ? " is-error" : ""
                              }`}
                              value={cancelReason}
                              onBlur={() => {
                                if (hasCancelReasonError) {
                                  setCancelReasonErrorByOrder((current) => ({
                                    ...current,
                                    [order.orderId]: false,
                                  }));
                                }
                              }}
                              onChange={(event) => {
                                const nextValue = event.target.value;

                                setCancelReasonByOrder((previous) => ({
                                  ...previous,
                                  [order.orderId]: nextValue,
                                }));

                                if (hasCancelReasonError) {
                                  setCancelReasonErrorByOrder((current) => ({
                                    ...current,
                                    [order.orderId]: false,
                                  }));
                                }
                              }}
                            />
                          </label>
                        ) : null}
                      </div>

                      <div className="my-orders-card__summary">
                        <div className="my-orders-card__total">
                          <span>Tổng thanh toán</span>
                          <strong>{currency.format(order.orderTotal)}</strong>
                        </div>

                        <div className="my-orders-card__actions">
                          <Link
                            to={shopHref}
                            className="my-orders-button my-orders-button--secondary"
                          >
                            Xem shop
                          </Link>

                          {canCancel ? (
                            <button
                              type="button"
                              className="my-orders-button my-orders-button--danger"
                              disabled={isCancelling}
                              onClick={() => handleCustomerCancelOrder(order)}
                            >
                              {isCancelling ? "Đang hủy..." : "Hủy đơn"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}
