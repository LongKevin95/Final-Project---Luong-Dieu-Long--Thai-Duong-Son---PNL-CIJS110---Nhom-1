import { useEffect, useMemo, useState } from "react";

import { useQueryClient } from "@tanstack/react-query";

import { updateOrderById } from "../../api/ordersApi";
import { useOrdersQuery } from "../../hooks/useOrdersQuery";
import "./OrdersManager.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const STATUS_OPTIONS = [
  "all",
  "pending",
  "processing",
  "completed",
  "cancelled",
];

const STATUS_LABELS = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  cancelled: "Cancelled",
};

function normalizeStatus(status) {
  const rawStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  if (rawStatus === "delivery") {
    return "completed";
  }

  if (rawStatus === "canceled") {
    return "cancelled";
  }

  if (Object.prototype.hasOwnProperty.call(STATUS_LABELS, rawStatus)) {
    return rawStatus;
  }

  return "pending";
}

function formatDate(value) {
  if (!value) {
    return "N/A";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getOrderText(order) {
  const items = Array.isArray(order?.items) ? order.items : [];

  return [
    order?.id,
    order?.customerName,
    order?.customerEmail,
    order?.contactEmail,
    order?.customerPhone,
    order?.shippingAddress?.fullName,
    order?.shippingAddress?.address,
    normalizeStatus(order?.status),
    ...items.flatMap((item) => [
      item?.title,
      item?.shopName,
      item?.sku,
      item?.vendorEmail,
    ]),
  ]
    .map((value) =>
      String(value ?? "")
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean)
    .join(" ");
}

function getCustomerLabel(order) {
  const customerName = String(
    order?.customerName ?? order?.shippingAddress?.fullName ?? "",
  ).trim();
  const customerEmail = String(
    order?.customerEmail ?? order?.contactEmail ?? "",
  ).trim();
  const customerPhone = String(
    order?.customerPhone ?? order?.shippingAddress?.phone ?? "",
  ).trim();

  return customerName || customerEmail || customerPhone || "N/A";
}

function getStatusLabel(status) {
  return STATUS_LABELS[normalizeStatus(status)] ?? "Pending";
}

function getStatusTone(status) {
  return `admin-orders__pill--${normalizeStatus(status)}`;
}

function getTimestamp(value) {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function OrdersManager() {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, isError, error } = useOrdersQuery();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [cancelReasonByOrder, setCancelReasonByOrder] = useState({});
  const [processingOrderId, setProcessingOrderId] = useState("");

  const sortedOrders = useMemo(() => {
    return [...orders].sort((left, right) => {
      return getTimestamp(right?.createdAt) - getTimestamp(left?.createdAt);
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    return sortedOrders.filter((order) => {
      const normalizedStatus = normalizeStatus(order?.status);

      if (statusFilter !== "all" && normalizedStatus !== statusFilter) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return getOrderText(order).includes(keyword);
    });
  }, [searchTerm, sortedOrders, statusFilter]);

  const selectedOrder = useMemo(() => {
    return (
      filteredOrders.find(
        (order) => String(order?.id ?? "") === selectedOrderId,
      ) ??
      filteredOrders[0] ??
      null
    );
  }, [filteredOrders, selectedOrderId]);

  useEffect(() => {
    if (filteredOrders.length === 0) {
      if (selectedOrderId) {
        setSelectedOrderId("");
      }

      return;
    }

    const hasSelectedOrder = filteredOrders.some(
      (order) => String(order?.id ?? "") === selectedOrderId,
    );

    if (!hasSelectedOrder) {
      setSelectedOrderId(String(filteredOrders[0]?.id ?? ""));
    }
  }, [filteredOrders, selectedOrderId]);

  const summary = useMemo(() => {
    return sortedOrders.reduce(
      (accumulator, order) => {
        const normalizedStatus = normalizeStatus(order?.status);

        accumulator.total += 1;
        if (normalizedStatus === "pending") accumulator.pending += 1;
        if (normalizedStatus === "processing") accumulator.processing += 1;
        if (normalizedStatus === "completed") accumulator.completed += 1;
        if (normalizedStatus === "cancelled") accumulator.cancelled += 1;

        return accumulator;
      },
      {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        cancelled: 0,
      },
    );
  }, [sortedOrders]);

  const selectedOrderStatus = normalizeStatus(selectedOrder?.status);
  const selectedOrderItems = Array.isArray(selectedOrder?.items)
    ? selectedOrder.items
    : [];
  const selectedCancelReason =
    cancelReasonByOrder[String(selectedOrder?.id ?? "")] ?? "";
  const canAdminCancelSelectedOrder =
    Boolean(selectedOrder?.id) && selectedOrderStatus === "processing";
  const isSelectedOrderBusy =
    processingOrderId &&
    String(processingOrderId) === String(selectedOrder?.id ?? "");

  const handleSelectOrder = (orderId) => {
    setSelectedOrderId(String(orderId ?? ""));
  };

  const handleCancelOrder = async (order) => {
    const orderId = String(order?.id ?? "").trim();
    const status = normalizeStatus(order?.status);

    if (!orderId || status !== "processing") {
      return;
    }

    const reason = String(cancelReasonByOrder[orderId] ?? "").trim();

    if (!reason) {
      window.alert("Admin cần nhập lý do khi hủy đơn.");
      return;
    }

    try {
      setProcessingOrderId(orderId);

      await updateOrderById({
        id: orderId,
        actor: "admin",
        updates: {
          status: "cancelled",
          cancellation: {
            by: "admin",
            reason,
            at: new Date().toISOString(),
          },
        },
      });

      setCancelReasonByOrder((previous) => ({
        ...previous,
        [orderId]: "",
      }));

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (updateError) {
      window.alert(updateError?.message ?? "Khong the cap nhat don hang.");
    } finally {
      setProcessingOrderId("");
    }
  };

  return (
    <div className="admin-orders">
      <section className="admin-orders__summary">
        <article className="admin-orders__card">
          <p>Total orders</p>
          <strong>{summary.total}</strong>
        </article>
        <article className="admin-orders__card">
          <p>Pending</p>
          <strong>{summary.pending}</strong>
        </article>
        <article className="admin-orders__card">
          <p>Processing</p>
          <strong>{summary.processing}</strong>
        </article>
        <article className="admin-orders__card">
          <p>Cancelled</p>
          <strong>{summary.cancelled}</strong>
        </article>
      </section>

      <section className="admin-orders__toolbar">
        <div className="admin-orders__filters">
          <label className="admin-orders__field">
            <span>Search</span>
            <input
              type="search"
              placeholder="Order id, customer, phone, email..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <label className="admin-orders__field">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All" : getStatusLabel(option)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="admin-orders__toolbar-meta">
          <span>{filteredOrders.length} orders shown</span>
        </div>
      </section>

      {isError ? (
        <section className="admin-orders__empty admin-orders__empty--error">
          <strong>Không thể tải danh sách đơn hàng.</strong>
          <p>{error?.message ?? "Vui lòng thử lại sau."}</p>
        </section>
      ) : isLoading ? (
        <section className="admin-orders__empty">
          <p>Đang tải đơn hàng...</p>
        </section>
      ) : sortedOrders.length === 0 ? (
        <section className="admin-orders__empty">
          <strong>Chưa có đơn hàng nào.</strong>
          <p>Danh sách đơn sẽ xuất hiện ở đây sau khi khách đặt hàng.</p>
        </section>
      ) : (
        <div className="admin-orders__layout">
          <section className="admin-orders__list">
            <div className="admin-orders__row admin-orders__row--head">
              <span>Order</span>
              <span>Customer</span>
              <span>Status</span>
              <span>Total</span>
              <span>Created</span>
              <span>Action</span>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="admin-orders__empty admin-orders__empty--inline">
                <p>Không tìm thấy đơn hàng phù hợp bộ lọc.</p>
              </div>
            ) : (
              filteredOrders.map((order) => {
                const orderId = String(order?.id ?? "");
                const status = normalizeStatus(order?.status);
                const isActive = String(selectedOrderId ?? "") === orderId;
                const isBusy = String(processingOrderId ?? "") === orderId;

                return (
                  <div
                    key={orderId}
                    className={`admin-orders__row admin-orders__row--button ${
                      isActive ? "is-active" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="admin-orders__row-button"
                      onClick={() => handleSelectOrder(orderId)}
                    >
                      <span>{orderId || "N/A"}</span>
                      <span>{getCustomerLabel(order)}</span>
                      <span>
                        <span
                          className={`admin-orders__pill ${getStatusTone(status)}`}
                        >
                          {getStatusLabel(status)}
                        </span>
                      </span>
                      <span>{currency.format(Number(order?.total ?? 0))}</span>
                      <span>{formatDate(order?.createdAt)}</span>
                      <span>{isBusy ? "Updating..." : "View details"}</span>
                    </button>
                  </div>
                );
              })
            )}
          </section>

          <aside className="admin-orders__detail">
            {selectedOrder ? (
              <>
                <div className="admin-orders__detail-header">
                  <div>
                    <p className="admin-orders__eyebrow">Selected order</p>
                    <h2>{selectedOrder.id}</h2>
                    <span
                      className={`admin-orders__pill ${getStatusTone(selectedOrderStatus)}`}
                    >
                      {getStatusLabel(selectedOrderStatus)}
                    </span>
                  </div>
                  <div className="admin-orders__detail-summary">
                    <strong>
                      {currency.format(Number(selectedOrder?.total ?? 0))}
                    </strong>
                    <span>{selectedOrderItems.length} items</span>
                  </div>
                </div>

                <div className="admin-orders__meta-grid">
                  <article className="admin-orders__meta-card">
                    <p>Customer</p>
                    <strong>{getCustomerLabel(selectedOrder)}</strong>
                  </article>
                  <article className="admin-orders__meta-card">
                    <p>Contact</p>
                    <strong>
                      {selectedOrder?.customerEmail ||
                        selectedOrder?.contactEmail ||
                        "N/A"}
                    </strong>
                    <span>{selectedOrder?.customerPhone || "N/A"}</span>
                  </article>
                  <article className="admin-orders__meta-card">
                    <p>Payment</p>
                    <strong>
                      {String(
                        selectedOrder?.paymentMethod ?? "cod",
                      ).toUpperCase()}
                    </strong>
                    <span>{formatDate(selectedOrder?.createdAt)}</span>
                  </article>
                  <article className="admin-orders__meta-card">
                    <p>Shipping</p>
                    <strong>
                      {selectedOrder?.shippingAddress?.address || "N/A"}
                    </strong>
                    <span>
                      {[
                        selectedOrder?.shippingAddress?.city,
                        selectedOrder?.shippingAddress?.state,
                        selectedOrder?.shippingAddress?.country,
                      ]
                        .filter(Boolean)
                        .join(", ") || "N/A"}
                    </span>
                  </article>
                </div>

                <section className="admin-orders__section">
                  <div className="admin-orders__section-header">
                    <h3>Order items</h3>
                    <span>{selectedOrderItems.length} lines</span>
                  </div>
                  <div className="admin-orders__items">
                    {selectedOrderItems.map((item, index) => {
                      const itemKey = `${selectedOrder.id}-${item?.productId ?? index}`;

                      return (
                        <article key={itemKey} className="admin-orders__item">
                          <div>
                            <strong>{item?.title || "Product"}</strong>
                            <p>
                              {item?.shopName || "Shop"}
                              {item?.sku ? ` · SKU ${item.sku}` : ""}
                            </p>
                          </div>
                          <div className="admin-orders__item-meta">
                            <span>
                              Qty:{" "}
                              <strong>{Number(item?.quantity ?? 0)}</strong>
                            </span>
                            <span>
                              Price:{" "}
                              <strong>
                                {currency.format(Number(item?.price ?? 0))}
                              </strong>
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="admin-orders__section">
                  <div className="admin-orders__section-header">
                    <h3>Status history</h3>
                    <span>
                      {Array.isArray(selectedOrder?.statusHistory)
                        ? selectedOrder.statusHistory.length
                        : 0}{" "}
                      events
                    </span>
                  </div>
                  <div className="admin-orders__timeline">
                    {Array.isArray(selectedOrder?.statusHistory) &&
                    selectedOrder.statusHistory.length > 0 ? (
                      selectedOrder.statusHistory.map((entry, index) => (
                        <article
                          key={`${selectedOrder.id}-${index}`}
                          className="admin-orders__timeline-item"
                        >
                          <div>
                            <strong>
                              {getStatusLabel(entry?.fromStatus)} →{" "}
                              {getStatusLabel(entry?.toStatus)}
                            </strong>
                            <p>By {String(entry?.by ?? "system")}</p>
                          </div>
                          <span>{formatDate(entry?.at)}</span>
                        </article>
                      ))
                    ) : (
                      <p className="admin-orders__empty admin-orders__empty--inline">
                        Chưa có lịch sử trạng thái.
                      </p>
                    )}
                  </div>
                </section>

                <section className="admin-orders__section admin-orders__cancel-section">
                  <div className="admin-orders__section-header">
                    <h3>Admin action</h3>
                    <span>
                      {canAdminCancelSelectedOrder
                        ? "Can cancel only while Processing"
                        : "Cancel is unavailable for this status"}
                    </span>
                  </div>

                  {canAdminCancelSelectedOrder ? (
                    <>
                      <label className="admin-orders__field">
                        <span>Cancellation reason</span>
                        <textarea
                          id="admin-order-cancel-reason"
                          className="admin-orders__textarea"
                          value={selectedCancelReason}
                          onChange={(event) => {
                            const nextValue = event.target.value;
                            setCancelReasonByOrder((previous) => ({
                              ...previous,
                              [String(selectedOrder.id)]: nextValue,
                            }));
                          }}
                          placeholder="Nhập lý do hủy đơn"
                        />
                      </label>

                      <div className="admin-orders__action-row">
                        <p>
                          Admin chỉ được hủy đơn khi đơn đang{" "}
                          <strong>Processing</strong>.
                        </p>
                        <button
                          type="button"
                          className="admin-orders__button admin-orders__button--danger"
                          disabled={isSelectedOrderBusy}
                          onClick={() => handleCancelOrder(selectedOrder)}
                        >
                          {isSelectedOrderBusy
                            ? "Cancelling..."
                            : "Cancel order"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="admin-orders__hint">
                      Đơn này không đủ điều kiện để admin hủy. Chỉ các đơn ở
                      trạng thái Processing mới có thể cancel.
                    </p>
                  )}
                </section>
              </>
            ) : (
              <div className="admin-orders__empty">
                <strong>
                  {filteredOrders.length > 0
                    ? "Chọn một đơn hàng để xem chi tiết."
                    : "Không có đơn hàng phù hợp với bộ lọc."}
                </strong>
                <p>
                  {filteredOrders.length > 0
                    ? "Thông tin chi tiết, lịch sử và thao tác hủy sẽ hiển thị ở đây."
                    : "Hãy thay đổi từ khóa hoặc bộ lọc trạng thái để xem đơn khác."}
                </p>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
