function toNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

export function normalizeOrderStatus(status) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return "pending";
  }

  if (normalized === "delivery") {
    return "completed";
  }

  return normalized;
}

export function extractOrderItems(order) {
  if (Array.isArray(order?.items)) {
    return order.items;
  }

  if (Array.isArray(order?.products)) {
    return order.products;
  }

  if (Array.isArray(order?.orderItems)) {
    return order.orderItems;
  }

  return [];
}

export function getItemProductId(item) {
  return String(
    item?.productId ?? item?.id ?? item?.product?.id ?? item?.product?._id ?? "",
  ).trim();
}

export function resolveOrderTotal(order) {
  const directTotal = toNumber(
    order?.total ?? order?.totalAmount ?? order?.amount ?? order?.grandTotal,
    Number.NaN,
  );

  if (Number.isFinite(directTotal)) {
    return directTotal;
  }

  const items = extractOrderItems(order);

  return items.reduce((sum, item) => {
    const quantity = toNumber(item?.quantity, 0);
    const price = toNumber(item?.price ?? item?.unitPrice, 0);
    return sum + quantity * price;
  }, 0);
}

export function resolveOrderDate(order) {
  return (
    order?.createdAt ??
    order?.orderDate ??
    order?.date ??
    order?.updatedAt ??
    null
  );
}

export function resolveOrderCustomer(order) {
  return {
    name:
      order?.customerName ?? order?.name ?? order?.shippingAddress?.fullName ?? "N/A",
    email:
      String(
        order?.customerEmail ?? order?.email ?? order?.userEmail ?? order?.customer?.email ?? "",
      )
        .trim()
        .toLowerCase() || "N/A",
  };
}

export function isOrderOfVendor({ order, vendorEmail, vendorProductIds }) {
  const normalizedVendorEmail = String(vendorEmail ?? "")
    .trim()
    .toLowerCase();
  const orderVendorEmail = String(
    order?.vendorEmail ?? order?.shopEmail ?? order?.storeEmail ?? "",
  )
    .trim()
    .toLowerCase();

  if (
    normalizedVendorEmail &&
    orderVendorEmail &&
    orderVendorEmail === normalizedVendorEmail
  ) {
    return true;
  }

  const items = extractOrderItems(order);

  return items.some((item) => vendorProductIds.has(getItemProductId(item)));
}
