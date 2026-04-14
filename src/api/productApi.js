import { fetchResourceDocument, updateResourceData } from "./resourceApi";
import { syncShopsFromProducts } from "./shopsApi";

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

export const PRODUCT_CATEGORIES = [
  "fashion-nam",
  "fashion-nu",
  "do-gia-dung",
  "dien-tu",
  "thuc-pham",
  "test-san-pham",
];

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
    beauty: "thuc-pham",
    home: "do-gia-dung",
    food: "thuc-pham",
    "fashion-men": "fashion-nam",
    "fashion-women": "fashion-nu",
  };

  return mapper[normalizedValue] ?? "test-san-pham";
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

function normalizeProduct(product) {
  const reviewsData = Array.isArray(product?.reviewsData)
    ? product.reviewsData
        .map((item) => ({
          customerEmail: String(item?.customerEmail ?? "")
            .trim()
            .toLowerCase(),
          customerName: String(item?.customerName ?? "Customer"),
          comment: String(item?.comment ?? "").trim(),
          stars: Math.min(5, Math.max(1, Number(item?.stars ?? 0))),
          createdAt: item?.createdAt ?? new Date().toISOString(),
          vendorReply:
            item?.vendorReply && typeof item.vendorReply === "object"
              ? {
                  text: String(item.vendorReply?.text ?? "").trim(),
                  at: item.vendorReply?.at ?? null,
                }
              : null,
        }))
        .filter((item) => item.customerEmail && item.stars > 0)
    : [];

  const averageRating =
    reviewsData.length > 0
      ? reviewsData.reduce((sum, item) => sum + item.stars, 0) /
        reviewsData.length
      : Number(product?.rating ?? 0);

  const stock = Number(product?.stock ?? 0);
  const normalizedStatus = normalizeStatus(product?.status);
  const resolvedCategory = normalizeCategory(product?.category);

  const normalizedProduct = {
    ...product,
    category: resolvedCategory,
    shopName:
      product?.shopName ||
      (product?.vendorEmail ? String(product.vendorEmail).split("@")[0] : "L&S Store"),
    rating: Number(averageRating.toFixed(1)),
    reviews: reviewsData.length,
    reviewsData,
    stock: stock <= 0 ? 0 : stock,
  };

  if (stock <= 0) {
    if (
      [PRODUCT_STATUS.PENDING, PRODUCT_STATUS.INACTIVE, PRODUCT_STATUS.REJECTED].includes(
        normalizedStatus,
      )
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

async function persistProducts(nextProducts) {
  const { payload, dataId } = await fetchProductsSnapshot();
  const normalizedProducts = nextProducts.map(normalizeProduct);

  await updateResourceData({
    resourceName: PRODUCTS_RESOURCE_NAME,
    dataId,
    payload: {
      ...(payload ?? {}),
      products: normalizedProducts,
    },
  });

  await syncShopsFromProducts(normalizedProducts);
}

export const getAllProducts = async () => {
  const { products } = await fetchProductsSnapshot();
  return products.map(normalizeProduct);
};

export const getProducts = async () => {
  const products = await getAllProducts();
  return products.filter((product) =>
    [PRODUCT_STATUS.ACTIVE, PRODUCT_STATUS.OUT_OF_STOCK].includes(product.status),
  );
};

export const createProduct = async (payload) => {
  const { products } = await fetchProductsSnapshot();

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

export const addProductReview = async ({ productId, review }) => {
  const normalizedProductId = String(productId ?? "").trim();

  if (!normalizedProductId) {
    throw new Error("Missing product id.");
  }

  const normalizedReview = {
    customerEmail: String(review?.customerEmail ?? "")
      .trim()
      .toLowerCase(),
    customerName: String(review?.customerName ?? "Customer").trim() || "Customer",
    comment: String(review?.comment ?? "").trim(),
    stars: Math.min(5, Math.max(1, Number(review?.stars ?? 0))),
    createdAt: new Date().toISOString(),
  };

  if (!normalizedReview.customerEmail || !normalizedReview.comment) {
    throw new Error("Review is missing required fields.");
  }

  const { products } = await fetchProductsSnapshot();
  let updatedProduct = null;

  const nextProducts = products.map((product) => {
    if (String(product?.id) !== normalizedProductId) {
      return normalizeProduct(product);
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

  await persistProducts(nextProducts);
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

  const { products } = await fetchProductsSnapshot();
  let updatedProduct = null;

  const nextProducts = products.map((product) => {
    if (String(product?.id) !== normalizedProductId) {
      return normalizeProduct(product);
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

  await persistProducts(nextProducts);
  return updatedProduct;
};
