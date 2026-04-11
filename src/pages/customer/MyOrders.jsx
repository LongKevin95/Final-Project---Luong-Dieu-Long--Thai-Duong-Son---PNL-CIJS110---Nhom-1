import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { updateOrderById } from "../../api/ordersApi";
import { useAuth } from "../../hooks/useAuth";
import { useOrdersQuery } from "../../hooks/useOrdersQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./MyOrders.css";

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

export default function MyOrders() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: orders = [] } = useOrdersQuery();
  const { data: users = [] } = useUsersQuery();
  const [cancelReasonByOrder, setCancelReasonByOrder] = useState({});
  const [processingOrderId, setProcessingOrderId] = useState("");

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

  const handleCustomerCancelOrder = async (order) => {
    const orderId = String(order?.id ?? "").trim();
    const status = String(order?.status ?? "").trim().toLowerCase();

    if (!orderId || status === "cancelled" || status === "canceled") {
      return;
    }

    const reason = String(cancelReasonByOrder[orderId] ?? "").trim();

    if (!reason) {
      window.alert("Ban can nhap ly do khi huy don.");
      return;
    }

    try {
      setProcessingOrderId(orderId);

      await updateOrderById({
        id: orderId,
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

      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      window.alert(error?.message ?? "Khong the huy don hang.");
    } finally {
      setProcessingOrderId("");
    }
  };

  return (
    <main className="my-orders-page o-container">
      <nav className="my-orders-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span>&gt;</span>
        <strong>My Orders</strong>
      </nav>

      <section className="my-orders-card">
        <div className="my-orders-card__header">
          <h1>My Orders</h1>
          <span>{myOrders.length} orders</span>
        </div>

        {myOrders.length === 0 ? (
          <p className="my-orders-empty">Ban chua co don hang nao.</p>
        ) : (
          <div className="my-orders-table">
            <div className="my-orders-row my-orders-row--head">
              <span>Order</span>
              <span>Date</span>
              <span>Items</span>
              <span>Shop</span>
              <span>Total</span>
              <span>Status</span>
              <span>Cancel reason</span>
              <span>Action</span>
            </div>

            {myOrders.map((order, index) => {
              const orderId = String(order?.id ?? "");
              const status = String(order?.status ?? "").toLowerCase();
              const isCancelled = status === "cancelled" || status === "canceled";
              const isPending = status === "pending";
              const orderItems = Array.isArray(order?.items) ? order.items : [];

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
                  shopName,
                  avatarUrl,
                });
              }

              const shopList = Array.from(uniqueShopMap.values());
              const firstShop = shopList[0];
              const firstShopName = firstShop?.shopName || "Shop";
              const firstShopAvatar = firstShop?.avatarUrl || "";
              const firstShopInitial =
                String(firstShopName).trim().charAt(0).toUpperCase() || "S";
              const extraShopsCount = Math.max(0, shopList.length - 1);

              return (
                <div
                  key={orderId || `my-order-${index}`}
                  className="my-orders-row"
                >
                  <span>{orderId || `#${index + 1}`}</span>
                  <span>{formatDate(order?.createdAt)}</span>
                  <span>{orderItems.length}</span>
                  <span>
                    <span className="my-orders-shop">
                      <span className="my-orders-shop__avatar" aria-hidden="true">
                        {firstShopAvatar ? (
                          <img src={firstShopAvatar} alt="" loading="lazy" />
                        ) : (
                          <span>{firstShopInitial}</span>
                        )}
                      </span>
                      <span>
                        {firstShopName}
                        {extraShopsCount > 0 ? ` +${extraShopsCount}` : ""}
                      </span>
                    </span>
                  </span>
                  <span>{currency.format(Number(order?.total ?? 0))}</span>
                  <span>
                    <span className={`my-orders-pill my-orders-pill--${status}`}>
                      {status || "pending"}
                    </span>
                  </span>
                  <span>
                    {!isPending ? (
                      order?.cancellation?.reason ? (
                        <span>{order.cancellation.reason}</span>
                      ) : (
                        <span>-</span>
                      )
                    ) : order?.cancellation?.reason ? (
                      <span>{order.cancellation.reason}</span>
                    ) : (
                      <input
                        className="my-orders-input"
                        type="text"
                        placeholder="Ly do huy don"
                        value={cancelReasonByOrder[orderId] ?? ""}
                        onChange={(event) =>
                          setCancelReasonByOrder((previous) => ({
                            ...previous,
                            [orderId]: event.target.value,
                          }))
                        }
                        disabled={!isPending}
                      />
                    )}
                  </span>
                  <span>
                    <button
                      type="button"
                      className="my-orders-btn"
                      disabled={!isPending || isCancelled || processingOrderId === orderId}
                      onClick={() => handleCustomerCancelOrder(order)}
                    >
                      {processingOrderId === orderId ? "Cancelling..." : "Cancel"}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
