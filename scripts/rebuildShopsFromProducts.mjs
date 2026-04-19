import axios from "axios";

const DEFAULT_API_KEY =
  process.env.MOCKUP_API_KEY ||
  process.env.VITE_API_KEY ||
  "69e4178ba9ba7d3635d97510";
const BASE_URL =
  process.env.MOCKUP_BASE_URL || "https://mindx-mockup-server.vercel.app/api";
const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const shouldVerify = !args.has("--skip-verify");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCategory(value) {
  return normalizeText(value).toLowerCase();
}

function createClient() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: {
      Accept: "application/json",
    },
  });
}

function getEntries(responseData) {
  return Array.isArray(responseData?.data?.data) ? responseData.data.data : [];
}

function findLatestEntry(responseData, predicate) {
  const entries = getEntries(responseData);

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];

    if (predicate(entry)) {
      return entry;
    }
  }

  return null;
}

function resolveProductsSnapshot(entry) {
  if (Array.isArray(entry?.products)) {
    return {
      dataId: entry?._id ?? null,
      products: entry.products,
    };
  }

  const nestedEntry = Array.isArray(entry?.data)
    ? entry.data.find((item) => Array.isArray(item?.products))
    : null;

  if (!nestedEntry) {
    return null;
  }

  return {
    dataId: entry?._id ?? null,
    products: nestedEntry.products,
  };
}

function resolveShopsSnapshot(entry) {
  if (Array.isArray(entry?.shops)) {
    return {
      dataId: entry?._id ?? null,
      shops: entry.shops,
    };
  }

  const nestedEntry = Array.isArray(entry?.data)
    ? entry.data.find((item) => Array.isArray(item?.shops))
    : null;

  if (!nestedEntry) {
    return null;
  }

  return {
    dataId: entry?._id ?? null,
    shops: nestedEntry.shops,
  };
}

function buildShopAggregates(products, existingShops = []) {
  const existingIdByEmail = new Map();
  const existingCreatedAtByEmail = new Map();
  const shopRowsByEmail = new Map();

  existingShops.forEach((shop) => {
    const vendorEmail = normalizeEmail(shop?.vendorEmail);

    if (!vendorEmail) {
      return;
    }

    if (shop?.id) {
      existingIdByEmail.set(vendorEmail, shop.id);
    }

    if (shop?.createdAt) {
      existingCreatedAtByEmail.set(vendorEmail, shop.createdAt);
    }
  });

  products.forEach((product, index) => {
    const vendorEmail = normalizeEmail(product?.vendorEmail);

    if (!vendorEmail) {
      return;
    }

    const currentShop = shopRowsByEmail.get(vendorEmail) ?? {
      id: existingIdByEmail.get(vendorEmail) ?? `shop-${vendorEmail}-${index}`,
      shopName:
        normalizeText(product?.shopName) ||
        vendorEmail.split("@")[0] ||
        "My Shop",
      vendorEmail,
      categories: new Set(),
      totalProducts: 0,
      inStockProducts: 0,
      createdAt:
        existingCreatedAtByEmail.get(vendorEmail) ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const category = normalizeCategory(product?.category);

    currentShop.totalProducts += 1;
    currentShop.inStockProducts += Number(product?.stock ?? 0) > 0 ? 1 : 0;

    if (category) {
      currentShop.categories.add(category);
    }

    if (
      !normalizeText(currentShop.shopName) &&
      normalizeText(product?.shopName)
    ) {
      currentShop.shopName = normalizeText(product.shopName);
    }

    currentShop.updatedAt = new Date().toISOString();
    shopRowsByEmail.set(vendorEmail, currentShop);
  });

  return Array.from(shopRowsByEmail.values())
    .map((shop) => ({
      ...shop,
      categories: Array.from(shop.categories),
    }))
    .sort((firstShop, secondShop) =>
      firstShop.vendorEmail.localeCompare(secondShop.vendorEmail),
    );
}

async function fetchResource(client, resourceName) {
  const response = await client.get(`/resources/${resourceName}`, {
    params: {
      apiKey: DEFAULT_API_KEY,
    },
  });

  return response.data;
}

async function updateShops(client, dataId, shops) {
  return client.put(
    `/resources/shops/${dataId}`,
    {
      shops,
    },
    {
      params: {
        apiKey: DEFAULT_API_KEY,
      },
    },
  );
}

async function main() {
  if (!DEFAULT_API_KEY) {
    throw new Error("Missing mockup server api key.");
  }

  const client = createClient();
  const ecommerceResponse = await fetchResource(client, "ecommerce-data");
  const shopsResponse = await fetchResource(client, "shops");
  const productsSnapshot = resolveProductsSnapshot(
    findLatestEntry(
      ecommerceResponse,
      (entry) =>
        Array.isArray(entry?.products) ||
        (Array.isArray(entry?.data) &&
          entry.data.some((item) => Array.isArray(item?.products))),
    ),
  );
  const shopsSnapshot = resolveShopsSnapshot(
    findLatestEntry(
      shopsResponse,
      (entry) =>
        Array.isArray(entry?.shops) ||
        (Array.isArray(entry?.data) &&
          entry.data.some((item) => Array.isArray(item?.shops))),
    ),
  ) ?? { dataId: null, shops: [] };

  if (!productsSnapshot) {
    throw new Error("Could not find products snapshot in ecommerce-data.");
  }

  if (!shopsSnapshot.dataId && !isDryRun) {
    throw new Error("Could not find shops dataId to update.");
  }

  const rebuiltShops = buildShopAggregates(
    Array.isArray(productsSnapshot.products) ? productsSnapshot.products : [],
    Array.isArray(shopsSnapshot.shops) ? shopsSnapshot.shops : [],
  );

  if (isDryRun) {
    console.log(
      JSON.stringify(
        {
          baseURL: BASE_URL,
          productsCount: productsSnapshot.products.length,
          previousShopsCount: shopsSnapshot.shops.length,
          rebuiltShopsCount: rebuiltShops.length,
          sample: rebuiltShops.slice(0, 5),
        },
        null,
        2,
      ),
    );
    return;
  }

  await updateShops(client, shopsSnapshot.dataId, rebuiltShops);

  const verification = shouldVerify
    ? await fetchResource(client, "shops")
    : null;

  console.log(
    JSON.stringify(
      {
        rebuiltAt: new Date().toISOString(),
        baseURL: BASE_URL,
        productsCount: productsSnapshot.products.length,
        previousShopsCount: shopsSnapshot.shops.length,
        rebuiltShopsCount: rebuiltShops.length,
        verification,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        message: error?.message ?? "Unknown error",
        status: error?.response?.status ?? null,
        data: error?.response?.data ?? null,
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
