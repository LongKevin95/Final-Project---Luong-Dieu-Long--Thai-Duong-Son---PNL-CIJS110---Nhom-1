import { useMemo } from "react";

import { useAdminProductsQuery } from "../../hooks/useAdminProductsQuery";
import { useAuth } from "../../hooks/useAuth";
import { useOrdersQuery } from "../../hooks/useOrdersQuery";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import {
  extractOrderItems,
  getItemProductId,
  isOrderOfVendor,
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

function normalizeUserStatus(status) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  if (["banned", "suspended", "rejected"].includes(normalized)) {
    return "banned";
  }

  return "active";
}

export default function VendorUsers() {
  const { user } = useAuth();
  const { data: users = [] } = useUsersQuery();
  const { data: products = [] } = useAdminProductsQuery();
  const { data: orders = [] } = useOrdersQuery();

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
      .map((order) => ({
        ...order,
        items: extractOrderItems(order).filter((item) =>
          vendorProductIds.has(getItemProductId(item)),
        ),
        customer: resolveOrderCustomer(order),
        date: resolveOrderDate(order),
        total: resolveOrderTotal(order),
      }));
  }, [orders, vendorEmail, vendorProductIds]);

  const customerStatsMap = useMemo(() => {
    const map = new Map();

    vendorOrders.forEach((order) => {
      const customer = order.customer;
      const customerEmail = String(customer?.email ?? "")
        .trim()
        .toLowerCase();

      if (!customerEmail || customerEmail === "n/a") {
        return;
      }

      const previous = map.get(customerEmail) ?? {
        email: customerEmail,
        name: customer?.name ?? "N/A",
        orderCount: 0,
        totalSpent: 0,
        lastOrderDate: null,
      };

      const nextLastDate =
        !previous.lastOrderDate ||
        new Date(order.date).getTime() > new Date(previous.lastOrderDate).getTime()
          ? order.date
          : previous.lastOrderDate;

      map.set(customerEmail, {
        ...previous,
        orderCount: previous.orderCount + 1,
        totalSpent: previous.totalSpent + Number(order.total ?? 0),
        lastOrderDate: nextLastDate,
      });
    });

    return map;
  }, [vendorOrders]);

  const rows = useMemo(() => {
    const customersFromUsers = users
      .map((item) => {
        const roles = Array.isArray(item?.roles)
          ? item.roles
          : item?.role
            ? [item.role]
            : [];

        return {
          name: item?.name ?? "N/A",
          email: String(item?.email ?? "")
            .trim()
            .toLowerCase(),
          roles,
          status: normalizeUserStatus(item?.status),
        };
      })
      .filter((item) => item.roles.includes("customer") && item.email);

    const userRows = customersFromUsers.map((customer) => {
      const stat = customerStatsMap.get(customer.email);

      return {
        ...customer,
        orderCount: stat?.orderCount ?? 0,
        totalSpent: stat?.totalSpent ?? 0,
        lastOrderDate: stat?.lastOrderDate ?? null,
      };
    });

    if (userRows.length > 0) {
      return userRows
        .filter((item) => Number(item.orderCount ?? 0) > 0)
        .sort((a, b) => b.orderCount - a.orderCount);
    }

    return Array.from(customerStatsMap.values()).map((item) => ({
      ...item,
      status: "active",
    }));
  }, [customerStatsMap, users]);

  return (
    <section className="vendor-section-card">
      <div className="vendor-section-card__header">
        <h2>User management</h2>
        <span>{rows.length} customers</span>
      </div>

      {rows.length === 0 ? (
        <p className="vendor-panel-empty">No customer data yet.</p>
      ) : (
        <div className="vendor-table">
          <div className="vendor-table__row vendor-table__row--head">
            <span>Customer</span>
            <span>Email</span>
            <span>Orders</span>
            <span>Total spent</span>
            <span>Last order</span>
            <span>Status</span>
          </div>

          {rows.map((item, index) => (
            <div key={`${item.email}-${index}`} className="vendor-table__row">
              <span>{item.name}</span>
              <span>{item.email}</span>
              <span>{item.orderCount}</span>
              <span>{currency.format(item.totalSpent)}</span>
              <span>{formatDate(item.lastOrderDate)}</span>
              <span>
                <span className={`vendor-pill vendor-pill--${item.status}`}>
                  {item.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
