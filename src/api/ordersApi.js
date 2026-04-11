import { fetchResourceDocument, updateResourceData } from "./resourceApi";

const ORDERS_RESOURCE_NAME = "ecommerce-data";

function resolveOrdersSnapshot(dataItem) {
  if (Array.isArray(dataItem?.orders)) {
    return {
      payload: dataItem,
      orders: dataItem.orders,
      dataId: dataItem?._id ?? null,
    };
  }

  const nestedList = Array.isArray(dataItem?.data) ? dataItem.data : [];
  const nestedItem = nestedList.find((item) => Array.isArray(item?.orders));

  if (!nestedItem) {
    return null;
  }

  return {
    payload: nestedItem,
    orders: nestedItem.orders,
    dataId: dataItem?._id ?? null,
  };
}

async function fetchOrdersSnapshot() {
  const document = await fetchResourceDocument(ORDERS_RESOURCE_NAME);
  const dataList = Array.isArray(document?.data) ? document.data : [];

  for (let index = dataList.length - 1; index >= 0; index -= 1) {
    const snapshot = resolveOrdersSnapshot(dataList[index]);

    if (snapshot) {
      return snapshot;
    }
  }

  return {
    payload: {},
    orders: [],
    dataId: null,
  };
}

function normalizeOrder(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  const rawStatus = String(order?.status ?? "pending")
    .trim()
    .toLowerCase();
  const normalizedStatus = rawStatus === "delivery" ? "completed" : rawStatus;

  return {
    id: String(order?.id ?? `order-${Date.now()}`),
    customerEmail: String(order?.customerEmail ?? "")
      .trim()
      .toLowerCase(),
    customerName: String(order?.customerName ?? "N/A"),
    status: normalizedStatus || "pending",
    items: items.map((item) => ({
      productId: String(item?.productId ?? ""),
      title: String(item?.title ?? "Product"),
      image: String(item?.image ?? "/favicon.svg"),
      quantity: Number(item?.quantity ?? 0),
      price: Number(item?.price ?? 0),
      vendorEmail: String(item?.vendorEmail ?? "")
        .trim()
        .toLowerCase(),
      color: String(item?.color ?? "Default"),
      size: String(item?.size ?? "M"),
    })),
    total: Number(order?.total ?? 0),
    cancellation:
      order?.cancellation && typeof order.cancellation === "object"
        ? {
            by: String(order.cancellation?.by ?? "")
              .trim()
              .toLowerCase(),
            reason: String(order.cancellation?.reason ?? "").trim(),
            at: order.cancellation?.at ?? null,
          }
        : null,
    createdAt: order?.createdAt ?? new Date().toISOString(),
    updatedAt: order?.updatedAt ?? order?.createdAt ?? new Date().toISOString(),
  };
}

async function persistOrders(nextOrders) {
  const { payload, dataId } = await fetchOrdersSnapshot();

  await updateResourceData({
    resourceName: ORDERS_RESOURCE_NAME,
    dataId,
    payload: {
      ...(payload ?? {}),
      orders: nextOrders.map(normalizeOrder),
    },
  });
}

export const getOrders = async () => {
  const { orders } = await fetchOrdersSnapshot();
  return orders.map(normalizeOrder);
};

export const createOrder = async (payload) => {
  const { orders } = await fetchOrdersSnapshot();

  const nextOrder = normalizeOrder({
    ...payload,
    id: payload?.id ?? `order-${Date.now()}`,
    cancellation: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await persistOrders([nextOrder, ...orders]);
  return nextOrder;
};

export const updateOrderById = async ({ id, updates }) => {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId) {
    throw new Error("Missing order id.");
  }

  const { orders } = await fetchOrdersSnapshot();
  let updatedOrder = null;

  const nextOrders = orders.map((order) => {
    if (String(order?.id ?? "") !== normalizedId) {
      return normalizeOrder(order);
    }

    const nextItem = normalizeOrder({
      ...order,
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    updatedOrder = nextItem;
    return nextItem;
  });

  if (!updatedOrder) {
    throw new Error("Order not found.");
  }

  await persistOrders(nextOrders);
  return updatedOrder;
};
