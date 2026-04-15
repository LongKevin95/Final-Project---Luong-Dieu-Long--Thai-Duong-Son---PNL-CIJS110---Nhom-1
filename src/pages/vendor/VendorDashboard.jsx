import { useMemo } from "react";

import { useAdminProductsQuery } from "../../hooks/useAdminProductsQuery";
import { useAuth } from "../../hooks/useAuth";
import { useOrdersQuery } from "../../hooks/useOrdersQuery";
import {
  extractVendorOrderItems,
  isOrderOfVendor,
  normalizeOrderStatus,
  resolveOrderCustomer,
  resolveVendorSubtotal,
} from "./vendorDataUtils";
import "./VendorDashboard.css";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function VendorDashboard() {
  const { user } = useAuth();
  const { data: products = [], isLoading: isProductsLoading } =
    useAdminProductsQuery();
  const { data: orders = [], isLoading: isOrdersLoading } = useOrdersQuery();

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
    () =>
      new Set(
        vendorProducts.map((product) => String(product?.id ?? "").trim()),
      ),
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
        const items = extractVendorOrderItems(
          order,
          vendorEmail,
          vendorProductIds,
        );

        return {
          ...order,
          items,
          status: normalizeOrderStatus(order?.status),
          total: resolveVendorSubtotal(items),
          customer: resolveOrderCustomer(order),
        };
      });
  }, [orders, vendorEmail, vendorProductIds]);

  const metrics = useMemo(() => {
    const totalProducts = vendorProducts.length;
    const inStockProducts = vendorProducts.filter(
      (product) => Number(product?.stock ?? 0) > 0,
    ).length;
    const outOfStockProducts = totalProducts - inStockProducts;
    const pendingOrders = vendorOrders.filter(
      (order) => order.status === "pending",
    ).length;
    const totalRevenue = vendorOrders
      .filter((order) => order.status === "completed")
      .reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const uniqueCustomers = new Set(
      vendorOrders
        .map((order) => order.customer?.email)
        .filter((email) => email && email !== "N/A"),
    ).size;

    return {
      totalProducts,
      inStockProducts,
      outOfStockProducts,
      pendingOrders,
      totalRevenue,
      uniqueCustomers,
    };
  }, [vendorOrders, vendorProducts]);

  const recentOrders = useMemo(() => vendorOrders.slice(0, 5), [vendorOrders]);

  return (
    <div className="vendor-dashboard">
      <section className="vendor-metrics-grid" aria-label="Store metrics">
        <article className="vendor-metric-card">
          <p>Total products</p>
          <h3>{metrics.totalProducts}</h3>
        </article>
        <article className="vendor-metric-card">
          <p>In stock</p>
          <h3>{metrics.inStockProducts}</h3>
        </article>
        <article className="vendor-metric-card">
          <p>Out of stock</p>
          <h3>{metrics.outOfStockProducts}</h3>
        </article>
        <article className="vendor-metric-card">
          <p>Pending orders</p>
          <h3>{metrics.pendingOrders}</h3>
        </article>
        <article className="vendor-metric-card">
          <p>Customers</p>
          <h3>{metrics.uniqueCustomers}</h3>
        </article>
        <article className="vendor-metric-card">
          <p>Revenue</p>
          <h3>{currency.format(metrics.totalRevenue)}</h3>
        </article>
      </section>

      <section className="vendor-section-card">
        <div className="vendor-section-card__header">
          <h2>Recent customer orders</h2>
          <span>{vendorOrders.length} orders</span>
        </div>

        {recentOrders.length === 0 ? (
          <p className="vendor-panel-empty">
            {isProductsLoading || isOrdersLoading
              ? "Loading data..."
              : "No order data for this shop yet."}
          </p>
        ) : (
          <div className="vendor-table">
            <div className="vendor-table__row vendor-table__row--five vendor-table__row--head">
              <span>Order</span>
              <span>Customer</span>
              <span>Items</span>
              <span>Status</span>
              <span>Total</span>
            </div>

            {recentOrders.map((order, index) => (
              <div
                key={order?.id ?? order?._id ?? `order-${index}`}
                className="vendor-table__row vendor-table__row--five"
              >
                <span>{order?.id ?? order?._id ?? `#${index + 1}`}</span>
                <span>{order.customer?.name}</span>
                <span>{order.items.length}</span>
                <span>
                  <span className={`vendor-pill vendor-pill--${order.status}`}>
                    {order.status}
                  </span>
                </span>
                <span>{currency.format(order.total)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default VendorDashboard;
