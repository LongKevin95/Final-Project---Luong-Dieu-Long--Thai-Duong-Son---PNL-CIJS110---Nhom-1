import { fetchResourceDocument, updateResourceData } from "./resourceApi";
import { syncShopsFromProducts } from "./shopsApi";
import { getUsers } from "./usersApi";

const PRODUCTS_RESOURCE_NAME = "ecommerce-data";
const PRODUCTS_READ_CACHE_DURATION_MS = 1000 * 30;

export const PRODUCT_STATUS = {
  ACTIVE: "active",
  DRAFT: "draft",
  PENDING: "pending",
  INACTIVE: "inactive",
  REJECTED: "rejected",
  OUT_OF_STOCK: "out_of_stock",
  BANNED: "banned",
};

export const PRODUCT_CATEGORIES = [
  "fashion-nam",
  "fashion-nu",
  "do-gia-dung",
  "dien-tu",
  "thuc-pham",
  "others",
];

export const PRODUCT_CATEGORY_LABELS = {
  "fashion-nam": "Men Fashion",
  "fashion-nu": "Women Fashion",
  "do-gia-dung": "Home",
  "dien-tu": "Electronics",
  "thuc-pham": "Food",
  others: "Others",
};

const PIKACHU_PRODUCT_TITLE = "gau bong pikachu";
let productsReadCache = {
  all: null,
  public: null,
  expiresAt: 0,
  promise: null,
};

function resetProductsReadCache() {
  productsReadCache = {
    all: null,
    public: null,
    expiresAt: 0,
    promise: null,
  };
}

function hasFreshProductsReadCache() {
  return (
    Array.isArray(productsReadCache.all) &&
    productsReadCache.expiresAt > Date.now()
  );
}

function getPublicProductsFromList(products) {
  return products.filter((product) =>
    [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.OUT_OF_STOCK].includes(
      product.status,
    ),
  );
}

function primeProductsReadCache(products) {
  const nextAllProducts = Array.isArray(products) ? products : [];

  productsReadCache = {
    ...productsReadCache,
    all: nextAllProducts,
    public: getPublicProductsFromList(nextAllProducts),
    expiresAt: Date.now() + PRODUCTS_READ_CACHE_DURATION_MS,
  };

  return nextAllProducts;
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("đ", "d")
    .replaceAll("Đ", "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function toFiniteNumber(value, fallback = 0) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function getFirstNonEmptyString(values) {
  for (const value of values) {
    const normalizedValue = normalizeText(value);

    if (normalizedValue) {
      return normalizedValue;
    }
  }

  return "";
}

function getUniqueStringList(values) {
  return [
    ...new Set(values.map((value) => normalizeText(value)).filter(Boolean)),
  ];
}

function normalizeUserRoles(user) {
  const roles = Array.isArray(user?.roles)
    ? user.roles
    : user?.role
      ? [user.role]
      : [];

  return roles.map((role) => normalizeText(role).toLowerCase()).filter(Boolean);
}

function parseWarrantyMonths(value) {
  const parsedValue = Number.parseInt(
    String(value ?? "").replace(/[^0-9]+/g, ""),
    10,
  );

  return Number.isFinite(parsedValue) ? parsedValue : 0;
}

function normalizeCategory(category) {
  const normalizedValue = String(category ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", "-")
    .replace(/\s+/g, "-");

  if (PRODUCT_CATEGORIES.includes(normalizedValue)) {
    return normalizedValue;
  }

  const mapper = {
    electronics: "dien-tu",
    home: "do-gia-dung",
    food: "thuc-pham",
    other: "others",
    others: "others",
    misc: "others",
    miscellaneous: "others",
    khac: "others",
    fashion: "fashion-nam",
    "fashion-men": "fashion-nam",
    "men-fashion": "fashion-nam",
    "fashion-women": "fashion-nu",
    "women-fashion": "fashion-nu",
  };

  return mapper[normalizedValue] ?? "fashion-nam";
}

export function formatProductCategoryLabel(category) {
  const normalizedCategory = normalizeCategory(category);
  return PRODUCT_CATEGORY_LABELS[normalizedCategory] ?? normalizedCategory;
}

function normalizeStatus(status) {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  if (normalizedStatus === PRODUCT_STATUS.BANNED) {
    return PRODUCT_STATUS.REJECTED;
  }

  if (Object.values(PRODUCT_STATUS).includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return PRODUCT_STATUS.PENDING;
}

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

function buildVendorDirectory(users) {
  const byEmail = new Map();
  const byNameKey = new Map();

  users
    .filter((user) => normalizeUserRoles(user).includes("vendor"))
    .map((user) => {
      const email = normalizeEmail(user?.email);

      if (!email) {
        return null;
      }

      return {
        email,
        shopName: getFirstNonEmptyString([
          user?.shopName,
          user?.name,
          email.split("@")[0],
        ]),
        name: getFirstNonEmptyString([
          user?.name,
          user?.shopName,
          email.split("@")[0],
        ]),
        avatarUrl: normalizeText(user?.avatarUrl),
      };
    })
    .filter(Boolean)
    .forEach((vendor) => {
      byEmail.set(vendor.email, vendor);

      [vendor.shopName, vendor.name].forEach((candidate) => {
        const key = normalizeSearchText(candidate);

        if (!key) {
          return;
        }

        const matchedVendors = byNameKey.get(key) ?? [];
        matchedVendors.push(vendor);
        byNameKey.set(key, matchedVendors);
      });
    });

  return {
    byEmail,
    byNameKey,
  };
}

function getLegacyVendorEmailCandidates(product) {
  return getUniqueStringList([
    product?.vendorEmail,
    product?.shopEmail,
    product?.storeEmail,
    product?.sellerEmail,
    product?.ownerEmail,
    product?.vendor?.email,
    product?.shop?.email,
    product?.store?.email,
    product?.seller?.email,
  ]);
}

function getLegacyVendorNameCandidates(product) {
  return getUniqueStringList([
    product?.shopName,
    product?.vendorName,
    product?.storeName,
    product?.sellerName,
    product?.ownerName,
    typeof product?.vendor === "string" ? product.vendor : "",
    typeof product?.shop === "string" ? product.shop : "",
    typeof product?.store === "string" ? product.store : "",
    typeof product?.seller === "string" ? product.seller : "",
    product?.vendor?.name,
    product?.shop?.name,
    product?.store?.name,
    product?.seller?.name,
  ]);
}

function resolveVendorFromDirectory(product, vendorDirectory) {
  for (const emailCandidate of getLegacyVendorEmailCandidates(product)) {
    const matchedVendor = vendorDirectory.byEmail.get(
      normalizeEmail(emailCandidate),
    );

    if (matchedVendor) {
      return matchedVendor;
    }
  }

  for (const nameCandidate of getLegacyVendorNameCandidates(product)) {
    const normalizedName = normalizeSearchText(nameCandidate);

    if (!normalizedName) {
      continue;
    }

    const matchedVendors = vendorDirectory.byNameKey.get(normalizedName) ?? [];

    if (matchedVendors.length === 1) {
      return matchedVendors[0];
    }
  }

  return null;
}

function resolveProductImages(product) {
  const imageCandidates = getUniqueStringList([
    product?.image,
    product?.thumbnail,
    product?.thumbnailUrl,
    product?.featuredImage,
    product?.featuredImageUrl,
    product?.coverImage,
    ...(Array.isArray(product?.images) ? product.images : []),
    ...(Array.isArray(product?.galleryImages) ? product.galleryImages : []),
    ...(Array.isArray(product?.photos) ? product.photos : []),
    ...(Array.isArray(product?.imageUrls) ? product.imageUrls : []),
  ]);
  const thumbnail = getFirstNonEmptyString([
    product?.image,
    product?.thumbnail,
    imageCandidates[0],
  ]);

  return {
    thumbnail,
    gallery: imageCandidates.filter((image) => image !== thumbnail),
  };
}

function resolveLegacyReviewsData(product) {
  if (Array.isArray(product?.reviewsData)) {
    return product.reviewsData;
  }

  if (!Array.isArray(product?.reviews)) {
    return [];
  }

  return product.reviews
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      customerEmail: normalizeEmail(
        item?.customerEmail ?? item?.reviewerEmail ?? item?.email,
      ),
      customerName:
        getFirstNonEmptyString([
          item?.customerName,
          item?.reviewerName,
          item?.name,
          "Customer",
        ]) || "Customer",
      comment: normalizeText(item?.comment ?? item?.body ?? item?.text),
      stars: Math.min(
        5,
        Math.max(1, toFiniteNumber(item?.stars ?? item?.rating, 0)),
      ),
      createdAt: item?.createdAt ?? item?.date ?? new Date().toISOString(),
      vendorReply:
        item?.vendorReply && typeof item.vendorReply === "object"
          ? {
              text: normalizeText(item.vendorReply?.text),
              at: item.vendorReply?.at ?? null,
            }
          : null,
    }))
    .filter((item) => item.customerEmail && item.comment && item.stars > 0);
}

function resolveLegacyAttributes(product) {
  const baseAttributes =
    product?.attributes &&
    typeof product.attributes === "object" &&
    !Array.isArray(product.attributes)
      ? { ...product.attributes }
      : {};
  const brand = getFirstNonEmptyString([baseAttributes.brand, product?.brand]);
  const material = getFirstNonEmptyString([
    baseAttributes.material,
    product?.material,
  ]);
  const model = getFirstNonEmptyString([baseAttributes.model, product?.model]);
  const expiryDate = getFirstNonEmptyString([
    baseAttributes.expiryDate,
    product?.expiryDate,
  ]);
  const weight = getFirstNonEmptyString([
    baseAttributes.weight,
    product?.weight,
  ]);
  const existingWarrantyMonths = toFiniteNumber(
    baseAttributes.warrantyMonths,
    Number.NaN,
  );
  const warrantyMonths = Number.isFinite(existingWarrantyMonths)
    ? existingWarrantyMonths
    : parseWarrantyMonths(
        product?.warrantyMonths ?? product?.warrantyInformation,
      );

  return {
    ...baseAttributes,
    ...(brand ? { brand } : {}),
    ...(material ? { material } : {}),
    ...(model ? { model } : {}),
    ...(expiryDate ? { expiryDate } : {}),
    ...(weight ? { weight } : {}),
    ...(warrantyMonths > 0 ? { warrantyMonths } : {}),
  };
}

function shouldMigrateLegacyProduct(product) {
  const normalizedVendorEmail = normalizeEmail(product?.vendorEmail);
  const normalizedShopName = normalizeText(product?.shopName);
  const normalizedImage = normalizeText(product?.image);
  const normalizedAttributes =
    product?.attributes &&
    typeof product.attributes === "object" &&
    !Array.isArray(product.attributes);

  return (
    !normalizedVendorEmail ||
    !normalizedShopName ||
    !normalizedImage ||
    !Array.isArray(product?.images) ||
    !Array.isArray(product?.reviewsData) ||
    !normalizedAttributes ||
    !product?.createdAt ||
    !product?.updatedAt ||
    normalizeText(product?.vendorEmail) !== normalizedVendorEmail
  );
}

function normalizeProductForPersistence(product, vendorDirectory) {
  const matchedVendor = resolveVendorFromDirectory(product, vendorDirectory);
  const existingVendorEmail = normalizeEmail(product?.vendorEmail);
  const resolvedVendorEmail = matchedVendor?.email || existingVendorEmail;
  const resolvedShopName = getFirstNonEmptyString([
    matchedVendor?.shopName,
    product?.shopName,
    matchedVendor?.name,
    ...getLegacyVendorNameCandidates(product),
    resolvedVendorEmail ? resolvedVendorEmail.split("@")[0] : "",
    "L&S Store",
  ]);
  const { thumbnail, gallery } = resolveProductImages(product);
  const reviewsData = resolveLegacyReviewsData(product);
  const attributes = resolveLegacyAttributes(product);
  const price = toFiniteNumber(product?.price, 0);
  const discountPercentage = Math.max(
    0,
    toFiniteNumber(product?.discountPercentage, 0),
  );
  const oldPrice = toFiniteNumber(product?.oldPrice, price);

  return {
    ...product,
    vendorEmail: resolvedVendorEmail,
    shopName: resolvedShopName,
    category: normalizeCategory(product?.category),
    image: thumbnail,
    images: gallery,
    attributes,
    reviewsData,
    vendorAvatarUrl:
      normalizeText(product?.vendorAvatarUrl) || matchedVendor?.avatarUrl || "",
    price,
    stock: Math.max(0, toFiniteNumber(product?.stock, 0)),
    colors: Array.isArray(product?.colors)
      ? getUniqueStringList(product.colors)
      : [],
    sizes: Array.isArray(product?.sizes)
      ? getUniqueStringList(product.sizes)
      : [],
    rating: toFiniteNumber(product?.rating, 0),
    reviews: reviewsData.length,
    discountPercentage,
    oldPrice: oldPrice > 0 ? oldPrice : price,
    status: normalizeStatus(product?.status),
    createdAt: product?.createdAt ?? new Date().toISOString(),
    updatedAt:
      product?.updatedAt ?? product?.createdAt ?? new Date().toISOString(),
  };
}

function normalizeProduct(product) {
  const { thumbnail, gallery } = resolveProductImages(product);
  const reviewsData = resolveLegacyReviewsData(product)
    .map((item) => ({
      customerEmail: normalizeEmail(item?.customerEmail),
      customerName: String(item?.customerName ?? "Customer"),
      comment: normalizeText(item?.comment),
      stars: Math.min(5, Math.max(1, Number(item?.stars ?? 0))),
      createdAt: item?.createdAt ?? new Date().toISOString(),
      vendorReply:
        item?.vendorReply && typeof item.vendorReply === "object"
          ? {
              text: normalizeText(item.vendorReply?.text),
              at: item.vendorReply?.at ?? null,
            }
          : null,
    }))
    .filter((item) => item.customerEmail && item.stars > 0);

  const averageRating =
    reviewsData.length > 0
      ? reviewsData.reduce((sum, item) => sum + item.stars, 0) /
        reviewsData.length
      : Number(product?.rating ?? 0);

  const stock = Math.max(0, toFiniteNumber(product?.stock, 0));
  const normalizedStatus = normalizeStatus(product?.status);
  const resolvedCategory = normalizeCategory(product?.category);
  const normalizedTitle = normalizeSearchText(product?.title);
  const resolvedSpecialCategory =
    normalizedTitle === PIKACHU_PRODUCT_TITLE ? "others" : resolvedCategory;
  const normalizedVendorEmail = normalizeEmail(product?.vendorEmail);

  const normalizedProduct = {
    ...product,
    vendorEmail: normalizedVendorEmail,
    category: resolvedSpecialCategory,
    image: thumbnail,
    images: gallery,
    attributes: resolveLegacyAttributes(product),
    shopName: getFirstNonEmptyString([
      product?.shopName,
      product?.vendorName,
      normalizedVendorEmail ? normalizedVendorEmail.split("@")[0] : "",
      "L&S Store",
    ]),
    rating: Number(averageRating.toFixed(1)),
    reviews: reviewsData.length,
    reviewsData,
    stock,
  };

  if (stock <= 0) {
    if (
      [
        PRODUCT_STATUS.PENDING,
        PRODUCT_STATUS.INACTIVE,
        PRODUCT_STATUS.REJECTED,
      ].includes(normalizedStatus)
    ) {
      return {
        ...normalizedProduct,
        status: normalizedStatus,
      };
    }

    return {
      ...normalizedProduct,
      status: PRODUCT_STATUS.OUT_OF_STOCK,
    };
  }

  return {
    ...normalizedProduct,
    status: normalizedStatus,
  };
}

function hasShopAggregationImpact(currentProduct, nextProduct) {
  const currentVendorEmail = normalizeEmail(currentProduct?.vendorEmail);
  const nextVendorEmail = normalizeEmail(nextProduct?.vendorEmail);
  const currentCategory = String(currentProduct?.category ?? "")
    .trim()
    .toLowerCase();
  const nextCategory = String(nextProduct?.category ?? "")
    .trim()
    .toLowerCase();
  const currentShopName = normalizeText(currentProduct?.shopName);
  const nextShopName = normalizeText(nextProduct?.shopName);
  const currentStock = Number(currentProduct?.stock ?? 0);
  const nextStock = Number(nextProduct?.stock ?? 0);

  return (
    currentVendorEmail !== nextVendorEmail ||
    currentCategory !== nextCategory ||
    currentShopName !== nextShopName ||
    currentStock !== nextStock
  );
}

async function writeProductsSnapshot(
  snapshot,
  nextProducts,
  { syncShops = true } = {},
) {
  const { payload, dataId } = snapshot;

  await updateResourceData({
    resourceName: PRODUCTS_RESOURCE_NAME,
    dataId,
    payload: {
      ...(payload ?? {}),
      products: nextProducts,
    },
  });

  resetProductsReadCache();

  if (syncShops) {
    await syncShopsFromProducts(nextProducts);
  }
}

function createSnapshotWithProducts(snapshot, products) {
  return {
    ...snapshot,
    payload: snapshot?.payload
      ? {
          ...snapshot.payload,
          products,
        }
      : snapshot?.payload,
    products,
  };
}

async function migrateLegacyProductsSnapshot(snapshot) {
  const products = Array.isArray(snapshot?.products) ? snapshot.products : [];

  if (products.length === 0 || !products.some(shouldMigrateLegacyProduct)) {
    return snapshot;
  }

  const users = await getUsers();
  const vendorDirectory = buildVendorDirectory(users);
  let hasChanges = false;
  const nextProducts = products.map((product) => {
    if (!shouldMigrateLegacyProduct(product)) {
      return product;
    }

    const migratedProduct = normalizeProductForPersistence(
      product,
      vendorDirectory,
    );

    if (
      !hasChanges &&
      JSON.stringify(migratedProduct) !== JSON.stringify(product)
    ) {
      hasChanges = true;
    }

    return migratedProduct;
  });

  if (!hasChanges) {
    return snapshot;
  }

  await writeProductsSnapshot(snapshot, nextProducts);
  return createSnapshotWithProducts(snapshot, nextProducts);
}

async function fetchProductsSnapshot({ migrateLegacy = false } = {}) {
  const document = await fetchResourceDocument(PRODUCTS_RESOURCE_NAME);
  const dataList = Array.isArray(document?.data) ? document.data : [];

  for (let index = dataList.length - 1; index >= 0; index -= 1) {
    const snapshot = resolveProductsSnapshot(dataList[index]);

    if (snapshot) {
      return migrateLegacy ? migrateLegacyProductsSnapshot(snapshot) : snapshot;
    }
  }

  return {
    payload: null,
    products: [],
    dataId: null,
  };
}

async function persistProducts(nextProducts, snapshot, options) {
  const resolvedSnapshot = snapshot ?? (await fetchProductsSnapshot());
  await writeProductsSnapshot(resolvedSnapshot, nextProducts, options);
}

export const getAllProducts = async () => {
  if (hasFreshProductsReadCache()) {
    return productsReadCache.all;
  }

  if (productsReadCache.promise) {
    return productsReadCache.promise;
  }

  const loadPromise = fetchProductsSnapshot({ migrateLegacy: true })
    .then(({ products }) => products.map(normalizeProduct))
    .then((products) => primeProductsReadCache(products))
    .finally(() => {
      if (productsReadCache.promise === loadPromise) {
        productsReadCache = {
          ...productsReadCache,
          promise: null,
        };
      }
    });

  productsReadCache = {
    ...productsReadCache,
    promise: loadPromise,
  };

  return loadPromise;
};

export const getProducts = async () => {
  if (hasFreshProductsReadCache() && Array.isArray(productsReadCache.public)) {
    return productsReadCache.public;
  }

  const products = await getAllProducts();
  return getPublicProductsFromList(products);
};

export const createProduct = async (payload) => {
  const snapshot = await fetchProductsSnapshot();
  const { products } = snapshot;

  const nextProduct = normalizeProduct({
    ...payload,
    id: payload?.id ?? `prod-${Date.now()}`,
    category: normalizeCategory(payload?.category),
    status: PRODUCT_STATUS.PENDING,
    reason: null,
    shopName:
      payload?.shopName ||
      (payload?.vendorEmail
        ? String(payload.vendorEmail).split("@")[0]
        : "My Shop"),
    reviewsData: Array.isArray(payload?.reviewsData) ? payload.reviewsData : [],
    createdAt: payload?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  await persistProducts([...products, nextProduct], snapshot);
  return nextProduct;
};

export const updateProductById = async ({ id, updates }) => {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId) {
    throw new Error("Missing product id.");
  }

  const snapshot = await fetchProductsSnapshot();
  const { products } = snapshot;
  let updatedProduct = null;
  let shouldSyncShops = false;
  const updatedAt = new Date().toISOString();

  const nextProducts = products.map((product) => {
    if (String(product?.id) !== normalizedId) {
      return product;
    }

    const nextItem = normalizeProduct({
      ...product,
      ...updates,
      updatedAt,
    });

    updatedProduct = nextItem;
    shouldSyncShops = hasShopAggregationImpact(product, nextItem);
    return nextItem;
  });

  if (!updatedProduct) {
    throw new Error("Product not found.");
  }

  await persistProducts(nextProducts, snapshot, {
    syncShops: shouldSyncShops,
  });

  return updatedProduct;
};

export const deductProductStocksForCheckout = async ({ items }) => {
  const cartItems = Array.isArray(items) ? items : [];

  if (cartItems.length === 0) {
    throw new Error("Cart is empty.");
  }

  const deductions = new Map();

  cartItems.forEach((item) => {
    const productId = String(item?.productId ?? item?.id ?? "").trim();
    const quantityToDeduct = Number(item?.quantity ?? 0);

    if (!productId || quantityToDeduct <= 0) {
      throw new Error("Dữ liệu giỏ hàng không hợp lệ. Vui lòng thử lại.");
    }

    deductions.set(
      productId,
      Number(deductions.get(productId) ?? 0) + quantityToDeduct,
    );
  });

  const snapshot = await fetchProductsSnapshot();
  const { products } = snapshot;
  const productById = new Map(
    products.map((product) => [String(product?.id ?? "").trim(), product]),
  );

  for (const [productId, quantityToDeduct] of deductions) {
    const currentProduct = productById.get(productId);

    if (!currentProduct) {
      throw new Error(
        `Không tìm thấy sản phẩm với mã ${productId}. Vui lòng thử lại.`,
      );
    }

    const currentStock = Number(currentProduct?.stock ?? 0);

    if (currentStock < quantityToDeduct) {
      throw new Error(
        `Sản phẩm ${productId} chỉ còn ${currentStock} sản phẩm trong kho.`,
      );
    }
  }

  const updatedAt = new Date().toISOString();
  let shouldSyncShops = false;
  const nextProducts = products.map((product) => {
    const productId = String(product?.id ?? "").trim();
    const quantityToDeduct = deductions.get(productId);

    if (!quantityToDeduct) {
      return product;
    }

    const currentStock = Number(product?.stock ?? 0);
    const nextStock = currentStock - quantityToDeduct;

    if (currentStock > 0 && nextStock <= 0) {
      shouldSyncShops = true;
    }

    return normalizeProduct({
      ...product,
      stock: nextStock,
      updatedAt,
    });
  });

  await writeProductsSnapshot(snapshot, nextProducts, {
    syncShops: shouldSyncShops,
  });
  return nextProducts;
};

export const removeProductById = async (id) => {
  const normalizedId = String(id ?? "").trim();

  if (!normalizedId) {
    throw new Error("Missing product id.");
  }

  const snapshot = await fetchProductsSnapshot();
  const { products } = snapshot;
  const nextProducts = products.filter(
    (product) => String(product?.id) !== normalizedId,
  );

  await persistProducts(nextProducts, snapshot);
};

export const addProductReview = async ({ productId, review }) => {
  const normalizedProductId = String(productId ?? "").trim();

  if (!normalizedProductId) {
    throw new Error("Missing product id.");
  }

  const normalizedReview = {
    customerEmail: String(review?.customerEmail ?? "")
      .trim()
      .toLowerCase(),
    customerName:
      String(review?.customerName ?? "Customer").trim() || "Customer",
    comment: String(review?.comment ?? "").trim(),
    stars: Math.min(5, Math.max(1, Number(review?.stars ?? 0))),
    createdAt: new Date().toISOString(),
  };

  if (!normalizedReview.customerEmail || !normalizedReview.comment) {
    throw new Error("Review is missing required fields.");
  }

  const snapshot = await fetchProductsSnapshot();
  const { products } = snapshot;
  let updatedProduct = null;

  const nextProducts = products.map((product) => {
    if (String(product?.id) !== normalizedProductId) {
      return product;
    }

    const previousReviews = Array.isArray(product?.reviewsData)
      ? product.reviewsData
      : [];

    const existedReview = previousReviews.some(
      (item) =>
        String(item?.customerEmail ?? "")
          .trim()
          .toLowerCase() === normalizedReview.customerEmail,
    );

    if (existedReview) {
      throw new Error("Moi tai khoan chi duoc review san pham nay 1 lan.");
    }

    const nextItem = normalizeProduct({
      ...product,
      reviewsData: [...previousReviews, normalizedReview],
      updatedAt: new Date().toISOString(),
    });

    updatedProduct = nextItem;
    return nextItem;
  });

  if (!updatedProduct) {
    throw new Error("Product not found.");
  }

  await persistProducts(nextProducts, snapshot, {
    syncShops: false,
  });
  return updatedProduct;
};

export const upsertVendorReply = async ({
  productId,
  reviewCreatedAt,
  customerEmail,
  vendorEmail,
  replyText,
}) => {
  const normalizedProductId = String(productId ?? "").trim();
  const normalizedReviewCreatedAt = String(reviewCreatedAt ?? "").trim();
  const normalizedCustomerEmail = String(customerEmail ?? "")
    .trim()
    .toLowerCase();
  const normalizedVendorEmail = String(vendorEmail ?? "")
    .trim()
    .toLowerCase();
  const normalizedReplyText = String(replyText ?? "").trim();

  if (
    !normalizedProductId ||
    !normalizedReviewCreatedAt ||
    !normalizedCustomerEmail ||
    !normalizedVendorEmail ||
    !normalizedReplyText
  ) {
    throw new Error("Missing required fields for vendor reply.");
  }

  const snapshot = await fetchProductsSnapshot();
  const { products } = snapshot;
  let updatedProduct = null;

  const nextProducts = products.map((product) => {
    if (String(product?.id) !== normalizedProductId) {
      return product;
    }

    const productVendorEmail = String(product?.vendorEmail ?? "")
      .trim()
      .toLowerCase();

    if (productVendorEmail !== normalizedVendorEmail) {
      throw new Error("Vendor khong co quyen tra loi review san pham nay.");
    }

    const previousReviews = Array.isArray(product?.reviewsData)
      ? product.reviewsData
      : [];

    const nextReviews = previousReviews.map((reviewItem) => {
      const isMatchedReview =
        String(reviewItem?.createdAt ?? "") === normalizedReviewCreatedAt &&
        String(reviewItem?.customerEmail ?? "")
          .trim()
          .toLowerCase() === normalizedCustomerEmail;

      if (!isMatchedReview) {
        return reviewItem;
      }

      return {
        ...reviewItem,
        vendorReply: {
          text: normalizedReplyText,
          at: new Date().toISOString(),
        },
      };
    });

    const nextItem = normalizeProduct({
      ...product,
      reviewsData: nextReviews,
      updatedAt: new Date().toISOString(),
    });

    updatedProduct = nextItem;
    return nextItem;
  });

  if (!updatedProduct) {
    throw new Error("Product not found.");
  }

  await persistProducts(nextProducts, snapshot, {
    syncShops: false,
  });
  return updatedProduct;
};
