import { fetchResourceDocument, updateResourceData } from "./resourceApi";

const PRODUCTS_RESOURCE_NAME = "ecommerce-data";

export const PRODUCT_STATUS = {
  ACTIVE: "active",
  DRAFT: "draft",
  PENDING: "pending",
  INACTIVE: "inactive",
  REJECTED: "rejected",
  OUT_OF_STOCK: "out_of_stock",
  BANNED: "banned",
};

function resolveProductsSnapshot(dataItem) {
  if (Array.isArray(dataItem?.products)) {
    return {
      payload: dataItem,
      products: dataItem.products,
      dataId: dataItem?._id ?? null,
    };
  }

  const nestedList = Array.isArray(dataItem?.data) ? dataItem.data : [];
  const nestedItem = nestedList.find((item) => Array.isArray(item?.products));

  if (!nestedItem) {
    return null;
  }

  return {
    payload: nestedItem,
    products: nestedItem.products,
    dataId: dataItem?._id ?? null,
  };
}

async function fetchProductsSnapshot() {
  const document = await fetchResourceDocument(PRODUCTS_RESOURCE_NAME);
  const dataList = Array.isArray(document?.data) ? document.data : [];

  for (let index = dataList.length - 1; index >= 0; index -= 1) {
    const snapshot = resolveProductsSnapshot(dataList[index]);

    if (snapshot) {
      return snapshot;
    }
  }

  return {
    payload: {},
    products: [],
    dataId: null,
  };
}

function normalizeStatus(status) {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  if (Object.values(PRODUCT_STATUS).includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return PRODUCT_STATUS.PENDING;
}

function normalizeProduct(product) {
  const stock = Number(product?.stock ?? 0);
  const normalizedStatus = normalizeStatus(product?.status);

  if (stock <= 0) {
    if (
      [
        PRODUCT_STATUS.INACTIVE,
        PRODUCT_STATUS.REJECTED,
        PRODUCT_STATUS.BANNED,
      ].includes(normalizedStatus)
    ) {
      return {
        ...product,
        stock: 0,
        status: normalizedStatus,
      };
    }

    return {
      ...product,
      stock: 0,
      status: PRODUCT_STATUS.OUT_OF_STOCK,
    };
  }

  return {
    ...product,
    stock,
    status: normalizedStatus,
  };
}

async function persistProducts(nextProducts) {
  const { payload, dataId } = await fetchProductsSnapshot();

  await updateResourceData({
    resourceName: PRODUCTS_RESOURCE_NAME,
    dataId,
    payload: {
      ...(payload ?? {}),
      products: nextProducts,
    },
  });
}

export const getAllProducts = async () => {
  const { products } = await fetchProductsSnapshot();
  return products.map(normalizeProduct);
};

export const getProducts = async () => {
  const products = await getAllProducts();
  return products.filter((product) =>
    [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.OUT_OF_STOCK].includes(
      product.status,
    ),
  );
};

export const createProduct = async (payload) => {
  const { products } = await fetchProductsSnapshot();
  const stock = Number(payload?.stock ?? 0);
  const nextStatus =
    stock <= 0 ? PRODUCT_STATUS.OUT_OF_STOCK : PRODUCT_STATUS.PENDING;

  const nextProduct = normalizeProduct({
    ...payload,
    id: payload?.id ?? `prod-${Date.now()}`,
    status: nextStatus,
    createdAt: payload?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await persistProducts([...products, nextProduct]);
  return nextProduct;
};

export const updateProductById = async ({ id, updates }) => {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId) {
    throw new Error("Missing product id.");
  }

  const { products } = await fetchProductsSnapshot();
  let updatedProduct = null;

  const nextProducts = products.map((product) => {
    if (String(product?.id) !== normalizedId) {
      return normalizeProduct(product);
    }

    const nextItem = normalizeProduct({
      ...product,
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    updatedProduct = nextItem;
    return nextItem;
  });

  await persistProducts(nextProducts);

  return updatedProduct;
};

export const removeProductById = async (id) => {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId) {
    throw new Error("Missing product id.");
  }

  const { products } = await fetchProductsSnapshot();
  const nextProducts = products
    .filter((product) => String(product?.id) !== normalizedId)
    .map(normalizeProduct);

  await persistProducts(nextProducts);
};
