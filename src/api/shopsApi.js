import { fetchResourceDocument, updateResourceData } from "./resourceApi";

const SHOPS_RESOURCE_NAME = "shops";

function resolveShopsSnapshot(dataItem) {
  if (Array.isArray(dataItem?.shops)) {
    return {
      dataId: dataItem?._id ?? null,
      shops: dataItem.shops,
    };
  }

  const nestedList = Array.isArray(dataItem?.data) ? dataItem.data : [];
  const nestedItem = nestedList.find((item) => Array.isArray(item?.shops));

  if (!nestedItem) {
    return null;
  }

  return {
    dataId: dataItem?._id ?? null,
    shops: nestedItem.shops,
  };
}

async function fetchShopsSnapshot() {
  const document = await fetchResourceDocument(SHOPS_RESOURCE_NAME);
  const dataList = Array.isArray(document?.data) ? document.data : [];

  for (let index = dataList.length - 1; index >= 0; index -= 1) {
    const snapshot = resolveShopsSnapshot(dataList[index]);

    if (snapshot) {
      return snapshot;
    }
  }

  return {
    dataId: null,
    shops: [],
  };
}

async function persistShops({ dataId, shops }) {
  await updateResourceData({
    resourceName: SHOPS_RESOURCE_NAME,
    dataId,
    payload: {
      shops,
    },
  });
}

export async function getShops() {
  const { shops } = await fetchShopsSnapshot();
  return shops;
}

export async function syncShopsFromProducts(products) {
  const { dataId, shops } = await fetchShopsSnapshot();
  const currentShops = Array.isArray(shops) ? shops : [];
  const map = new Map();

  currentShops.forEach((shop) => {
    const email = String(shop?.vendorEmail ?? "")
      .trim()
      .toLowerCase();

    if (!email) {
      return;
    }

    map.set(email, {
      id: shop?.id ?? `shop-${Date.now()}`,
      shopName:
        shop?.shopName || (email ? email.split("@")[0] : "My Shop"),
      vendorEmail: email,
      categories: Array.isArray(shop?.categories) ? shop.categories : [],
      totalProducts: Number(shop?.totalProducts ?? 0),
      inStockProducts: Number(shop?.inStockProducts ?? 0),
      createdAt: shop?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  products.forEach((product, index) => {
    const vendorEmail = String(product?.vendorEmail ?? "")
      .trim()
      .toLowerCase();

    if (!vendorEmail) {
      return;
    }

    const previous = map.get(vendorEmail) ?? {
      id: `shop-${Date.now()}-${index}`,
      shopName:
        product?.shopName || (vendorEmail ? vendorEmail.split("@")[0] : "My Shop"),
      vendorEmail,
      categories: [],
      totalProducts: 0,
      inStockProducts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const nextCategories = [...new Set([...previous.categories, product?.category].filter(Boolean))];

    map.set(vendorEmail, {
      ...previous,
      shopName:
        product?.shopName ||
        previous.shopName ||
        (vendorEmail ? vendorEmail.split("@")[0] : "My Shop"),
      categories: nextCategories,
      totalProducts: previous.totalProducts + 1,
      inStockProducts:
        previous.inStockProducts + (Number(product?.stock ?? 0) > 0 ? 1 : 0),
      updatedAt: new Date().toISOString(),
    });
  });

  await persistShops({
    dataId,
    shops: Array.from(map.values()),
  });
}
