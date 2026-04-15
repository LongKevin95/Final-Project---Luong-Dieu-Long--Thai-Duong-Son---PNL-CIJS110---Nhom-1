import { fetchResourceDocument, updateResourceData } from "./resourceApi";

const ORDERS_RESOURCE_NAME = "ecommerce-data";

const FINAL_STATUSES = new Set(["completed", "cancelled"]);

function normalizeText(value, fallback = "") {
  const nextValue = String(value ?? fallback).trim();
  return nextValue || fallback;
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeOrderStatusValue(status) {
  const rawStatus = String(status ?? "pending")
    .trim()
    .toLowerCase();

  if (!rawStatus) {
    return "pending";
  }

  if (rawStatus === "delivery") {
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

function normalizePaymentMethod(method) {
  const rawMethod = String(method ?? "cod")
    .trim()
    .toLowerCase();

  if (rawMethod === "cash") {
    return "cod";
  }

  if (["cod", "card"].includes(rawMethod)) {
    return rawMethod;
  }

  return "cod";
}

function normalizeShippingAddress(address, order) {
  const source = address && typeof address === "object" ? address : {};
  const fallbackName = normalizeText(order?.customerName ?? order?.name ?? "");
  const firstName = normalizeText(order?.firstName ?? source?.firstName ?? "");
  const lastName = normalizeText(order?.lastName ?? source?.lastName ?? "");
  const derivedFullName = normalizeText(`${firstName} ${lastName}`.trim());
  const preferredFullName = source?.fullName ?? derivedFullName;
  const fullName = normalizeText(preferredFullName, fallbackName);

  return {
    fullName,
    phone: normalizeText(source?.phone ?? order?.phone ?? ""),
    address: normalizeText(source?.address ?? order?.address ?? ""),
    city: normalizeText(source?.city ?? order?.city ?? ""),
    state: normalizeText(source?.state ?? order?.state ?? ""),
    zipCode: normalizeText(source?.zipCode ?? order?.zipCode ?? ""),
    country: normalizeText(source?.country ?? order?.country ?? ""),
  };
}

function normalizeStatusHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  return {
    fromStatus:
      entry?.fromStatus === null || entry?.fromStatus === undefined
        ? null
        : normalizeOrderStatusValue(entry.fromStatus),
    toStatus: normalizeOrderStatusValue(
      entry?.toStatus ?? entry?.status ?? "pending",
    ),
    by: normalizeText(entry?.by ?? entry?.updatedBy ?? "system"),
    at: entry?.at ?? new Date().toISOString(),
  };
}

function buildInitialStatusHistory(order, status) {
  const createdAt = order?.createdAt ?? new Date().toISOString();
  return [
    {
      fromStatus: null,
      toStatus: status,
      by: normalizeText(order?.createdBy ?? order?.updatedBy ?? "customer"),
      at: createdAt,
    },
  ];
}

function normalizeStatusHistory(order, status) {
  const history = Array.isArray(order?.statusHistory)
    ? order.statusHistory
        .map((entry) => normalizeStatusHistoryEntry(entry))
        .filter(Boolean)
    : [];

  if (history.length > 0) {
    return history;
  }

  return buildInitialStatusHistory(order, status);
}

function validateStatusTransition(currentStatus, nextStatus) {
  if (!nextStatus || currentStatus === nextStatus) {
    return;
  }

  if (FINAL_STATUSES.has(currentStatus)) {
    throw new Error("Order status is finalized and cannot be updated.");
  }

  const allowedTransitions = {
    pending: new Set(["processing", "cancelled"]),
    processing: new Set(["completed", "cancelled"]),
  };

  if (!allowedTransitions[currentStatus]?.has(nextStatus)) {
    throw new Error("Invalid order status transition.");
  }
}

function appendStatusHistory(order, nextStatus, actor, updatedAt) {
  const currentStatus = normalizeOrderStatusValue(order?.status);

  if (!nextStatus || currentStatus === nextStatus) {
    return normalizeStatusHistory(order, currentStatus);
  }

  return [
    ...normalizeStatusHistory(order, currentStatus),
    {
      fromStatus: currentStatus,
      toStatus: nextStatus,
      by: normalizeText(actor ?? "system"),
      at: updatedAt,
    },
  ];
}

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
  const normalizedStatus = normalizeOrderStatusValue(order?.status);
  const shippingAddress = normalizeShippingAddress(
    order?.shippingAddress,
    order,
  );
  const customerName = normalizeText(
    order?.customerName ?? shippingAddress.fullName ?? "N/A",
    "N/A",
  );
  const customerEmail = normalizeEmail(
    order?.customerEmail ?? order?.userEmail ?? "",
  );
  const contactEmail = normalizeEmail(
    order?.contactEmail ?? order?.email ?? order?.shippingAddress?.email ?? "",
  );

  return {
    id: String(order?.id ?? `o-${Date.now()}`),
    customerEmail,
    customerName,
    contactEmail,
    customerPhone: normalizeText(
      order?.customerPhone ?? shippingAddress.phone ?? "",
    ),
    status: normalizedStatus || "pending",
    items: items.map((item) => ({
      productId: normalizeText(item?.productId ?? item?.id ?? ""),
      title: normalizeText(item?.title ?? "Product", "Product"),
      image: normalizeText(item?.image ?? "/favicon.svg", "/favicon.svg"),
      quantity: Number(item?.quantity ?? 0),
      price: Number(item?.price ?? 0),
      vendorEmail: normalizeEmail(item?.vendorEmail ?? ""),
      shopName: normalizeText(item?.shopName ?? "Shop", "Shop"),
      sku: normalizeText(item?.sku ?? item?.productSku ?? ""),
      color: normalizeText(item?.color ?? "Default", "Default"),
      size: normalizeText(item?.size ?? "M", "M"),
    })),
    total: Number(order?.total ?? 0),
    paymentMethod: normalizePaymentMethod(order?.paymentMethod),
    shippingAddress,
    cancellation:
      order?.cancellation && typeof order.cancellation === "object"
        ? {
            by: normalizeText(order.cancellation?.by ?? "").toLowerCase(),
            reason: normalizeText(order.cancellation?.reason ?? ""),
            at: order.cancellation?.at ?? null,
          }
        : null,
    statusHistory: normalizeStatusHistory(order, normalizedStatus),
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
  const createdAt = new Date().toISOString();

  const nextOrder = normalizeOrder({
    ...payload,
    id: payload?.id ?? `o-${Date.now()}`,
    cancellation: null,
    createdBy: payload?.createdBy ?? "customer",
    createdAt,
    updatedAt: createdAt,
  });

  await persistOrders([nextOrder, ...orders]);
  return nextOrder;
};

export const updateOrderById = async ({ id, updates, actor }) => {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId) {
    throw new Error("Missing order id.");
  }

  const { orders } = await fetchOrdersSnapshot();
  let updatedOrder = null;
  const normalizedActor = normalizeText(actor ?? "system").toLowerCase();

  const nextOrders = orders.map((order) => {
    if (String(order?.id ?? "") !== normalizedId) {
      return normalizeOrder(order);
    }

    const currentOrder = normalizeOrder(order);
    const nextStatus = updates?.status
      ? normalizeOrderStatusValue(updates.status)
      : currentOrder.status;
    const updatedAt = new Date().toISOString();

    if (normalizedActor === "admin") {
      if (currentOrder.status !== "processing" || nextStatus !== "cancelled") {
        throw new Error("Admin chỉ được hủy đơn khi đơn đang Processing.");
      }

      if (
        !normalizeText(
          updates?.cancellation?.reason ??
            currentOrder?.cancellation?.reason ??
            "",
        )
      ) {
        throw new Error("Cancellation reason is required.");
      }
    }

    validateStatusTransition(currentOrder.status, nextStatus);

    if (
      nextStatus === "cancelled" &&
      !normalizeText(
        updates?.cancellation?.reason ??
          currentOrder?.cancellation?.reason ??
          "",
      )
    ) {
      throw new Error("Cancellation reason is required.");
    }

    const nextItem = normalizeOrder({
      ...currentOrder,
      ...updates,
      status: nextStatus,
      statusHistory: appendStatusHistory(
        currentOrder,
        nextStatus,
        actor,
        updatedAt,
      ),
      updatedAt,
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
