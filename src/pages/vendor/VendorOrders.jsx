import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useAdminProductsQuery } from "../../hooks/useAdminProductsQuery";
import { useAuth } from "../../hooks/useAuth";
import { useOrdersQuery } from "../../hooks/useOrdersQuery";
import { updateOrderById } from "../../api/ordersApi";
import {
  extractOrderItems,
  getItemProductId,
  isOrderOfVendor,
  normalizeOrderStatus,
  resolveOrderCustomer,
  resolveOrderDate,
  resolveOrderTotal,
} from "./vendorDataUtils";
import "./VendorDashboard.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
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

  return date.toLocaleDateString("en-GB");
}

export default function VendorOrders() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: products = [] } = useAdminProductsQuery();
  const { data: orders = [] } = useOrdersQuery();
  const [cancelReasonByOrder, setCancelReasonByOrder] = useState({});
  const [processingOrderId, setProcessingOrderId] = useState("");

  const vendorEmail = String(user?.email ?? "")
    .trim()
    .toLowerCase();

  const vendorProducts = useMemo(() => {
    return products.filter((product) => {
      const productOwner = String(product?.vendorEmail ?? "")
        .trim()
        .toLowerCase();
      return productOwner === vendorEmail;
    });
  }, [products, vendorEmail]);

  const vendorProductIds = useMemo(
    () => new Set(vendorProducts.map((product) => String(product?.id ?? "").trim())),
    [vendorProducts],
  );

  const vendorOrders = useMemo(() => {
    return orders
      .filter((order) =>
        isOrderOfVendor({
          order,
          vendorEmail,
          vendorProductIds,
        }),
      )
      .map((order) => {
        const items = extractOrderItems(order).filter((item) =>
          vendorProductIds.has(getItemProductId(item)),
        );

        return {
          ...order,
          items,
          status: normalizeOrderStatus(order?.status),
          total: resolveOrderTotal(order),
          customer: resolveOrderCustomer(order),
          date: resolveOrderDate(order),
          cancellation:
            order?.cancellation && typeof order.cancellation === "object"
              ? order.cancellation
              : null,
        };
      });
  }, [orders, vendorEmail, vendorProductIds]);

  const handleVendorCancelOrder = async (order) => {
    const orderId = String(order?.id ?? "").trim();
    const status = String(order?.status ?? "").trim().toLowerCase();

    if (!orderId) {
      return;
    }

    if (status !== "pending") {
      return;
    }

    const reason = String(cancelReasonByOrder[orderId] ?? "").trim();

    if (!reason) {
      window.alert("Vendor can nhap ly do khi huy don.");
      return;
    }

    try {
      setProcessingOrderId(orderId);

      await updateOrderById({
        id: orderId,
        updates: {
          status: "cancelled",
          cancellation: {
            by: "vendor",
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
    } catch (error) {
      window.alert(error?.message ?? "Khong the huy don hang.");
    } finally {
      setProcessingOrderId("");
    }
  };

  const handleVendorMarkCompleted = async (order) => {
    const orderId = String(order?.id ?? "").trim();
    const status = String(order?.status ?? "").trim().toLowerCase();

    if (!orderId || status !== "pending") {
      return;
    }

    try {
      setProcessingOrderId(orderId);

      await updateOrderById({
        id: orderId,
        updates: {
          status: "completed",
        },
      });

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      window.alert(error?.message ?? "Khong the cap nhat don hang.");
    } finally {
      setProcessingOrderId("");
    }
  };

  return (
    <section className="vendor-section-card">
      <div className="vendor-section-card__header">
        <h2>Orders from your customers</h2>
        <span>{vendorOrders.length} orders</span>
      </div>

      {vendorOrders.length === 0 ? (
        <p className="vendor-panel-empty">No order data available.</p>
      ) : (
        <div className="vendor-table">
          <div className="vendor-table__row vendor-table__row--orders vendor-table__row--head">
            <span>Order</span>
            <span>Customer</span>
            <span>Date</span>
            <span>Items</span>
            <span>Status</span>
            <span>Total</span>
            <span>Cancel reason</span>
            <span>Action</span>
          </div>

          {vendorOrders.map((order, index) => {
            const normalizedStatus = String(order?.status ?? "").toLowerCase();
            const isPending = normalizedStatus === "pending";
            const isFinalized = ["cancelled", "canceled", "completed"].includes(
              normalizedStatus,
            );

            return (
              <div
                key={order?.id ?? order?._id ?? `vendor-order-${index}`}
                className="vendor-table__row vendor-table__row--orders"
              >
                <span>{order?.id ?? order?._id ?? `#${index + 1}`}</span>
                <span>{order.customer?.name}</span>
                <span>{formatDate(order.date)}</span>
                <span>{order.items.length}</span>
                <span>
                  <span className={`vendor-pill vendor-pill--${normalizedStatus}`}>
                    {normalizedStatus}
                  </span>
                </span>
                <span>{currency.format(order.total)}</span>
                <span>
                  {order.cancellation?.reason ? (
                    <span>{order.cancellation.reason}</span>
                  ) : (
                    <input
                      className="vendor-inline-input"
                      type="text"
                      placeholder="Ly do huy don"
                      value={cancelReasonByOrder[String(order?.id ?? "")] ?? ""}
                      onChange={(event) =>
                        setCancelReasonByOrder((previous) => ({
                          ...previous,
                          [String(order?.id ?? "")]: event.target.value,
                        }))
                      }
                      disabled={!isPending}
                    />
                  )}
                </span>
                <span>
                  <div className="vendor-order-actions">
                    <button
                      type="button"
                      className="vendor-inline-btn"
                      disabled={
                        processingOrderId === String(order?.id ?? "") || !isPending
                      }
                      onClick={() => handleVendorMarkCompleted(order)}
                    >
                      {processingOrderId === String(order?.id ?? "")
                        ? "Updating..."
                        : "Mark completed"}
                    </button>

                    <button
                      type="button"
                      className="vendor-inline-btn vendor-inline-btn--danger"
                      disabled={
                        processingOrderId === String(order?.id ?? "") || !isPending
                      }
                      onClick={() => handleVendorCancelOrder(order)}
                    >
                      {processingOrderId === String(order?.id ?? "")
                        ? "Cancelling..."
                        : "Cancel order"}
                    </button>

                    {isFinalized && (
                      <small className="vendor-order-final-note">
                        Trang thai da chot, khong the thay doi.
                      </small>
                    )}
                  </div>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
