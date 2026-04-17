import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import {
  createProduct,
  PRODUCT_STATUS,
  removeProductById,
  updateProductById,
} from "../../api/productApi";
import { useAdminProductsQuery } from "../../hooks/useAdminProductsQuery";
import { useAuth } from "../../hooks/useAuth";
import "./VendorProducts.css";

const defaultForm = {
  title: "",
  category: "fashion-nam",
  description: "",
  price: "",
  stock: "",
  colorsText: "",
  sizesText: "",
  brand: "",
  material: "",
  model: "",
  warrantyMonths: "",
  expiryDate: "",
  weight: "",
};

const categoryOptions = [
  {
    value: "fashion-nam",
    label: "Men Fashion",
    flags: { useSizes: true, useColors: true, useFashionFields: true },
  },
  {
    value: "fashion-nu",
    label: "Women Fashion",
    flags: { useSizes: true, useColors: true, useFashionFields: true },
  },
  {
    value: "do-gia-dung",
    label: "Home",
    flags: { useSizes: false, useColors: false, useHomeFields: true },
  },
  {
    value: "dien-tu",
    label: "Electronics",
    flags: { useSizes: false, useColors: false, useElectronicsFields: true },
  },
  {
    value: "thuc-pham",
    label: "Food",
    flags: { useSizes: false, useColors: false, useFoodFields: true },
  },
  {
    value: "others",
    label: "Others",
    flags: { useSizes: false, useColors: false },
  },
];
const ITEMS_PER_PAGE = 10;
const categoryLabelByValue = Object.fromEntries(
  categoryOptions.map(({ value, label }) => [value, label]),
);
const VENDOR_PRODUCTS_SNAPSHOT_KEY_PREFIX = "ls-vendor-products-snapshot:";
const VENDOR_HIDDEN_STATUS_META_KEY = "vendorHiddenOriginalStatus";
const VENDOR_HIDDEN_REASON_META_KEY = "vendorHiddenOriginalReason";

function readStoredArray(storageKey) {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawData = window.localStorage.getItem(storageKey);

    if (!rawData) {
      return [];
    }

    const parsedData = JSON.parse(rawData);
    return Array.isArray(parsedData) ? parsedData : [];
  } catch {
    window.localStorage.removeItem(storageKey);
    return [];
  }
}

function writeStoredArray(storageKey, items) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(items));
  } catch {
    return;
  }
}

function parseInputList(text) {
  return String(text ?? "")
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHexColors(text) {
  const hexColorRegex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
  const colors = parseInputList(text).filter((item) =>
    hexColorRegex.test(item),
  );

  return [...new Set(colors)];
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Không thể đọc ảnh vừa chọn."));
    reader.readAsDataURL(file);
  });
}

function getProductThumbnail(product) {
  if (product?.image) {
    return String(product.image);
  }

  if (Array.isArray(product?.images) && product.images.length > 0) {
    return String(product.images[0]);
  }

  return "";
}

function getProductGalleryImages(product) {
  const thumbnail = getProductThumbnail(product);
  const productImages = Array.isArray(product?.images) ? product.images : [];

  return productImages.filter((image, index) => {
    if (!image) {
      return false;
    }

    if (thumbnail && image === thumbnail && index === 0) {
      return false;
    }

    return true;
  });
}

function getSelectedFileKey(file) {
  return [file?.name ?? "", file?.size ?? 0, file?.lastModified ?? 0].join("-");
}

function getStoredImageLabel(image, fallbackLabel) {
  const value = String(image ?? "").trim();

  if (!value || value.startsWith("data:")) {
    return fallbackLabel;
  }

  const normalizedPath = value.split("?")[0]?.split("#")[0] ?? "";
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  return pathSegments[pathSegments.length - 1] || fallbackLabel;
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M14 5h-5a4 4 0 0 0-4 4v6a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4v-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m15 4 5 5M12 12l8-8M11 13l-1 3 3-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="12"
        cy="12"
        r="2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M3 3 21 21"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M10.7 6.2A10.6 10.6 0 0 1 12 6c6.5 0 10 6 10 6a17.5 17.5 0 0 1-3.2 3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.1 6.9A17.8 17.8 0 0 0 2 12s3.5 6 10 6c1.1 0 2.1-.2 3.1-.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M6 6 18 18M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function formatStatus(status) {
  const key = String(status ?? "")
    .trim()
    .toLowerCase();

  switch (key) {
    case PRODUCT_STATUS.ACTIVE:
      return "Active";
    case PRODUCT_STATUS.DRAFT:
      return "Draft";
    case PRODUCT_STATUS.PENDING:
      return "Pending";
    case PRODUCT_STATUS.INACTIVE:
      return "Inactive";
    case PRODUCT_STATUS.REJECTED:
      return "Rejected";
    case PRODUCT_STATUS.OUT_OF_STOCK:
      return "Out of stock";
    case PRODUCT_STATUS.BANNED:
      return "Rejected";
    default:
      return "Unknown";
  }
}

const VendorProductsListSection = memo(function VendorProductsListSection({
  currentPage,
  isError,
  isLoading,
  isSaving,
  onAction,
  paginatedVendorProducts,
  processingProductId,
  setCurrentPage,
  totalPages,
  vendorProductsCount,
}) {
  return (
    <section className="vendor-products-card">
      <h2>Danh sách sản phẩm</h2>

      {isLoading && <p>Đang tải dữ liệu...</p>}
      {isError && <p>Không thể tải danh sách sản phẩm.</p>}

      {!isLoading && !isError && (
        <div className="vendor-products-table">
          <div className="vendor-products-table__row vendor-products-table__head">
            <span>#</span>
            <span>Item</span>
            <span>Price</span>
            <span>Stock</span>
            <span>Status</span>
            <span>Reason</span>
            <span>Action</span>
          </div>

          {paginatedVendorProducts.map((product, index) => {
            const isRowUpdating =
              processingProductId &&
              String(processingProductId) === String(product.id);
            const normalizedStatus = String(product?.status ?? "")
              .trim()
              .toLowerCase();
            const isRejected = normalizedStatus === PRODUCT_STATUS.REJECTED;
            const isInactive = normalizedStatus === PRODUCT_STATUS.INACTIVE;

            return (
              <div className="vendor-products-table__row" key={product.id}>
                <span>{(currentPage - 1) * ITEMS_PER_PAGE + index + 1}</span>
                <span>
                  <Link to={`/product/${product.id}`} state={{ product }}>
                    {product.title}
                  </Link>
                </span>
                <span>${Number(product.price ?? 0)}</span>
                <span>{product.stock ?? 0}</span>
                <span>
                  <span
                    className={`vendor-status-pill vendor-status-pill--${String(
                      product.status,
                    ).replaceAll("_", "-")}`}
                  >
                    {formatStatus(product.status)}
                  </span>
                </span>
                <span className="vendor-reason-text">
                  {product.reason ? String(product.reason) : "-"}
                </span>
                <span>
                  <span className="vendor-action-control">
                    {isRowUpdating && (
                      <span className="vendor-action-spinner" />
                    )}

                    <button
                      type="button"
                      className="vendor-action-btn vendor-action-btn--icon vendor-action-btn--edit"
                      disabled={isSaving}
                      onClick={() => onAction(product, "edit")}
                      title="Edit"
                      aria-label="Edit product"
                    >
                      <EditIcon />
                    </button>

                    <button
                      type="button"
                      className={`vendor-action-btn vendor-action-btn--icon ${
                        isInactive
                          ? "vendor-action-btn--show"
                          : "vendor-action-btn--hide"
                      }`}
                      disabled={isSaving || isRejected}
                      onClick={() =>
                        onAction(product, isInactive ? "show" : "hide")
                      }
                      title={isInactive ? "Show" : "Hide"}
                      aria-label={isInactive ? "Show product" : "Hide product"}
                    >
                      {isInactive ? <EyeIcon /> : <EyeOffIcon />}
                    </button>

                    <button
                      type="button"
                      className="vendor-action-btn vendor-action-btn--icon vendor-action-btn--delete"
                      disabled={isSaving}
                      onClick={() => onAction(product, "delete")}
                      title="Delete"
                      aria-label="Delete product"
                    >
                      <XIcon />
                    </button>
                  </span>
                </span>
              </div>
            );
          })}

          {paginatedVendorProducts.length === 0 && vendorProductsCount > 0 && (
            <p className="vendor-products-empty">
              Không có sản phẩm nào ở trang này.
            </p>
          )}

          {vendorProductsCount === 0 && (
            <p className="vendor-products-empty">
              Bạn chưa có sản phẩm nào. Hãy đăng sản phẩm đầu tiên.
            </p>
          )}

          {totalPages > 1 && (
            <div className="vendor-pagination">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="vendor-pagination-btn"
              >
                Previous
              </button>

              <span className="vendor-pagination-info">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
                className="vendor-pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
});

export default function VendorProducts() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const { user } = useAuth();
  const vendorEmail = String(user?.email ?? "")
    .trim()
    .toLowerCase();
  const vendorProductsSnapshotKey = `${VENDOR_PRODUCTS_SNAPSHOT_KEY_PREFIX}${vendorEmail}`;
  const storedVendorProducts = useMemo(
    () => readStoredArray(vendorProductsSnapshotKey),
    [vendorProductsSnapshotKey],
  );
  const selectVendorProducts = useCallback(
    (products) =>
      Array.isArray(products)
        ? products.filter((product) => {
            const productOwner = String(product?.vendorEmail ?? "")
              .trim()
              .toLowerCase();
            return productOwner === vendorEmail;
          })
        : [],
    [vendorEmail],
  );
  const {
    data: vendorProductsData,
    isLoading,
    isError,
  } = useAdminProductsQuery({
    enabled: Boolean(vendorEmail),
    select: selectVendorProducts,
  });
  const vendorProducts = Array.isArray(vendorProductsData)
    ? vendorProductsData
    : storedVendorProducts;
  const shouldShowBlockingListLoading =
    isLoading && vendorProducts.length === 0;
  const shouldShowBlockingListError = isError && vendorProducts.length === 0;

  const [form, setForm] = useState(defaultForm);
  const [existingThumbnail, setExistingThumbnail] = useState("");
  const [existingGalleryImages, setExistingGalleryImages] = useState([]);
  const [selectedThumbnailFile, setSelectedThumbnailFile] = useState(null);
  const [selectedGalleryFiles, setSelectedGalleryFiles] = useState([]);
  const [imagePendingRemoval, setImagePendingRemoval] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [processingProductId, setProcessingProductId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const vendorShopName =
    user?.name || (vendorEmail ? vendorEmail.split("@")[0] : "My Shop");

  useEffect(() => {
    if (!vendorEmail || !Array.isArray(vendorProductsData)) {
      return;
    }

    writeStoredArray(vendorProductsSnapshotKey, vendorProductsData);
  }, [vendorEmail, vendorProductsData, vendorProductsSnapshotKey]);

  const paginatedVendorProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return vendorProducts.slice(startIndex, endIndex);
  }, [vendorProducts, currentPage]);

  const totalPages = Math.ceil(vendorProducts.length / ITEMS_PER_PAGE);

  const categories = useMemo(() => {
    const fromData = vendorProducts
      .map((product) =>
        String(product?.category ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
    const predefinedValues = categoryOptions.map((item) => item.value);

    return [...new Set([...predefinedValues, ...fromData])];
  }, [vendorProducts]);

  const selectedCategoryConfig = useMemo(() => {
    return (
      categoryOptions.find((item) => item.value === form.category) ??
      categoryOptions[0]
    );
  }, [form.category]);

  const vendorProductById = useMemo(
    () =>
      new Map(
        vendorProducts.map((product) => [String(product?.id ?? ""), product]),
      ),
    [vendorProducts],
  );

  const editProductIdFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return String(params.get("edit") ?? "").trim();
  }, [location.search]);

  const startEditingProduct = useCallback((product) => {
    setEditingId(String(product.id));
    setForm({
      title: product.title ?? "",
      category: product.category ?? "",
      description: product.description ?? "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? 0),
      colorsText: Array.isArray(product.colors)
        ? product.colors.join(", ")
        : "",
      sizesText: Array.isArray(product.sizes) ? product.sizes.join(", ") : "",
      brand: String(product?.attributes?.brand ?? ""),
      material: String(product?.attributes?.material ?? ""),
      model: String(product?.attributes?.model ?? ""),
      warrantyMonths: String(product?.attributes?.warrantyMonths ?? ""),
      expiryDate: String(product?.attributes?.expiryDate ?? ""),
      weight: String(product?.attributes?.weight ?? ""),
    });
    setExistingThumbnail(getProductThumbnail(product));
    setExistingGalleryImages(getProductGalleryImages(product));
    setSelectedThumbnailFile(null);
    setSelectedGalleryFiles([]);
    setImagePendingRemoval(null);
    setErrorMessage("");
  }, []);

  useEffect(() => {
    if (!editProductIdFromQuery || editingId) {
      return;
    }

    const productToEdit = vendorProductById.get(editProductIdFromQuery);

    if (!productToEdit) {
      return;
    }

    startEditingProduct(productToEdit);
  }, [
    editProductIdFromQuery,
    editingId,
    startEditingProduct,
    vendorProductById,
  ]);

  useEffect(() => {
    if (currentPage <= totalPages) {
      return;
    }

    setCurrentPage(Math.max(totalPages, 1));
  }, [currentPage, totalPages]);

  function handleInputChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleSelectThumbnailFile(event) {
    const file = event.target.files?.[0] ?? null;
    setSelectedThumbnailFile(file);

    event.target.value = "";

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleRemoveSelectedThumbnailFile() {
    setSelectedThumbnailFile(null);

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleRequestRemoveExistingThumbnail() {
    if (!existingThumbnail) {
      return;
    }

    setImagePendingRemoval({
      type: "thumbnail",
      image: existingThumbnail,
      label: getStoredImageLabel(existingThumbnail, "Thumbnail hiện tại"),
    });

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleRemoveExistingThumbnail() {
    setExistingThumbnail("");
    setImagePendingRemoval(null);

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleSelectGalleryFiles(event) {
    const files = Array.from(event.target.files ?? []);
    setSelectedGalleryFiles((prev) => {
      const nextFiles = [...prev];
      const existingKeys = new Set(
        prev.map((file) => getSelectedFileKey(file)),
      );

      files.forEach((file) => {
        const fileKey = getSelectedFileKey(file);

        if (!existingKeys.has(fileKey)) {
          nextFiles.push(file);
          existingKeys.add(fileKey);
        }
      });

      return nextFiles;
    });

    event.target.value = "";

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleRemoveSelectedGalleryFile(fileToRemove) {
    const targetFileKey = getSelectedFileKey(fileToRemove);
    setSelectedGalleryFiles((prev) =>
      prev.filter((file) => getSelectedFileKey(file) !== targetFileKey),
    );

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleRequestRemoveExistingGalleryImage(imageToRemove, index) {
    setImagePendingRemoval({
      type: "gallery",
      image: imageToRemove,
      label: getStoredImageLabel(imageToRemove, `Gallery image ${index + 1}`),
    });

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleRemoveExistingGalleryImage(imageToRemove) {
    setExistingGalleryImages((prev) =>
      prev.filter((image) => image !== imageToRemove),
    );
    setImagePendingRemoval(null);

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleCancelImageRemoval() {
    setImagePendingRemoval(null);
  }

  function handleConfirmImageRemoval() {
    if (!imagePendingRemoval) {
      return;
    }

    if (imagePendingRemoval.type === "thumbnail") {
      handleRemoveExistingThumbnail();
      return;
    }

    handleRemoveExistingGalleryImage(imagePendingRemoval.image);
  }

  const resetForm = useCallback(() => {
    setForm(defaultForm);
    setExistingThumbnail("");
    setExistingGalleryImages([]);
    setSelectedThumbnailFile(null);
    setSelectedGalleryFiles([]);
    setImagePendingRemoval(null);
    setEditingId("");
    setErrorMessage("");
  }, []);

  const handleSubmit = useCallback(
    async (event) => {
      event.preventDefault();

      const title = form.title.trim();
      const description = form.description.trim();
      const category = form.category.trim().toLowerCase();
      const price = Number(form.price);
      const stock = Number(form.stock);

      if (!title || !description || !category) {
        setErrorMessage("Vui lòng nhập title, category và description.");
        return;
      }

      if (!Number.isFinite(price) || price <= 0) {
        setErrorMessage("Price phải là số lớn hơn 0.");
        return;
      }

      if (!Number.isFinite(stock) || stock < 0) {
        setErrorMessage("Stock phải là số lớn hơn hoặc bằng 0.");
        return;
      }

      if (!vendorEmail) {
        setErrorMessage("Không tìm thấy thông tin vendor đang đăng nhập.");
        return;
      }

      try {
        setIsSaving(true);

        const [uploadedThumbnail, uploadedGalleryImages] = await Promise.all([
          selectedThumbnailFile ? readFileAsDataUrl(selectedThumbnailFile) : "",
          Promise.all(
            selectedGalleryFiles.map((file) => readFileAsDataUrl(file)),
          ),
        ]);

        const thumbnail = uploadedThumbnail || existingThumbnail;
        const images = [
          ...new Set([
            ...existingGalleryImages.filter(Boolean),
            ...uploadedGalleryImages.filter(Boolean),
          ]),
        ];

        if (!thumbnail) {
          setErrorMessage("Bạn cần upload ảnh đại diện cho sản phẩm.");
          return;
        }

        const colors = selectedCategoryConfig.flags.useColors
          ? normalizeHexColors(form.colorsText)
          : [];
        const sizes = selectedCategoryConfig.flags.useSizes
          ? parseInputList(form.sizesText)
          : [];

        if (selectedCategoryConfig.flags.useSizes && sizes.length === 0) {
          setErrorMessage("Danh muc fashion can nhap it nhat 1 size.");
          return;
        }

        const attributes = {};

        if (selectedCategoryConfig.flags.useFashionFields) {
          attributes.brand = form.brand.trim();
          attributes.material = form.material.trim();
        }

        if (selectedCategoryConfig.flags.useElectronicsFields) {
          attributes.model = form.model.trim();
          attributes.warrantyMonths = Number(form.warrantyMonths || 0);
        }

        if (selectedCategoryConfig.flags.useFoodFields) {
          attributes.expiryDate = form.expiryDate;
          attributes.weight = form.weight.trim();
        }

        if (selectedCategoryConfig.flags.useHomeFields) {
          attributes.material = form.material.trim();
        }

        const payload = {
          title,
          category,
          description,
          price,
          stock,
          image: thumbnail,
          images,
          colors,
          sizes,
          vendorEmail,
          shopName: vendorShopName,
          attributes,
        };

        if (editingId) {
          await updateProductById({
            id: editingId,
            updates: {
              ...payload,
            },
          });
        } else {
          await createProduct({
            ...payload,
            reason: null,
            rating: 0,
            reviews: 0,
            discountPercentage: 0,
            oldPrice: price,
          });
        }

        resetForm();
        void queryClient.invalidateQueries({ queryKey: ["products"] });
      } catch (error) {
        setErrorMessage(
          error?.message ?? "Không thể lưu sản phẩm. Vui lòng thử lại.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [
      editingId,
      existingGalleryImages,
      existingThumbnail,
      form,
      queryClient,
      resetForm,
      selectedCategoryConfig.flags.useColors,
      selectedCategoryConfig.flags.useElectronicsFields,
      selectedCategoryConfig.flags.useFashionFields,
      selectedCategoryConfig.flags.useFoodFields,
      selectedCategoryConfig.flags.useHomeFields,
      selectedCategoryConfig.flags.useSizes,
      selectedGalleryFiles,
      selectedThumbnailFile,
      vendorEmail,
      vendorShopName,
    ],
  );

  const handleAction = useCallback(
    async (product, action) => {
      if (!action) {
        return;
      }

      const targetProductId = String(product?.id ?? "");

      try {
        setIsSaving(true);
        setProcessingProductId(targetProductId);

        if (action === "edit") {
          startEditingProduct(product);
          return;
        }

        if (action === "hide") {
          const currentStatus = String(product?.status ?? "")
            .trim()
            .toLowerCase();
          const currentReason = product?.reason ?? null;

          await updateProductById({
            id: product.id,
            updates: {
              status: PRODUCT_STATUS.INACTIVE,
              reason: "Vendor hidden",
              [VENDOR_HIDDEN_STATUS_META_KEY]:
                currentStatus || PRODUCT_STATUS.ACTIVE,
              [VENDOR_HIDDEN_REASON_META_KEY]: currentReason,
            },
          });
        }

        if (action === "show") {
          const restoredStatus = String(
            product?.[VENDOR_HIDDEN_STATUS_META_KEY] ?? "",
          )
            .trim()
            .toLowerCase();
          const nextStatus = Object.values(PRODUCT_STATUS).includes(
            restoredStatus,
          )
            ? restoredStatus
            : PRODUCT_STATUS.ACTIVE;
          const restoredReason = product?.[VENDOR_HIDDEN_REASON_META_KEY];

          await updateProductById({
            id: product.id,
            updates: {
              status: nextStatus,
              reason:
                nextStatus === PRODUCT_STATUS.ACTIVE
                  ? null
                  : (restoredReason ?? product?.reason ?? null),
              [VENDOR_HIDDEN_STATUS_META_KEY]: null,
              [VENDOR_HIDDEN_REASON_META_KEY]: null,
            },
          });
        }

        if (action === "delete") {
          await removeProductById(product.id);
        }

        void queryClient.invalidateQueries({ queryKey: ["products"] });
      } catch (error) {
        setErrorMessage(error?.message ?? "Không thể xử lý action sản phẩm.");
      } finally {
        setProcessingProductId("");
        setIsSaving(false);
      }
    },
    [queryClient, startEditingProduct],
  );

  return (
    <div className={`vendor-products-page ${isSaving ? "is-saving" : ""}`}>
      <section className="vendor-products-card">
        <h2>{editingId ? "Cập nhật sản phẩm" : "Đăng sản phẩm mới"}</h2>
        <form className="vendor-products-form" onSubmit={handleSubmit}>
          <fieldset className="vendor-products-fieldset" disabled={isSaving}>
            <label>
              Title
              <input
                name="title"
                type="text"
                value={form.title}
                onChange={handleInputChange}
              />
            </label>

            <label>
              Category
              <select
                name="category"
                value={form.category}
                onChange={handleInputChange}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabelByValue[category] ?? category}
                  </option>
                ))}
              </select>
            </label>

            <label className="is-full">
              Description
              <textarea
                name="description"
                rows="3"
                value={form.description}
                onChange={handleInputChange}
              />
            </label>

            <label>
              Price
              <input
                name="price"
                type="number"
                min="1"
                value={form.price}
                onChange={handleInputChange}
              />
            </label>

            <label>
              Stock
              <input
                name="stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={handleInputChange}
              />
            </label>

            <label>
              Upload thumbnail
              <div className="vendor-products-file-picker">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSelectThumbnailFile}
                />

                {existingThumbnail && (
                  <div className="vendor-products-image-list">
                    <button
                      type="button"
                      className="vendor-products-image-thumb"
                      onClick={handleRequestRemoveExistingThumbnail}
                      title={`Xóa ảnh ${getStoredImageLabel(
                        existingThumbnail,
                        "Thumbnail hiện tại",
                      )}`}
                    >
                      <img src={existingThumbnail} alt="Current thumbnail" />
                    </button>
                  </div>
                )}

                {selectedThumbnailFile && (
                  <div className="vendor-products-file-list">
                    <button
                      type="button"
                      className="vendor-products-file-chip"
                      onClick={handleRemoveSelectedThumbnailFile}
                      title={`Xóa ảnh ${selectedThumbnailFile.name}`}
                    >
                      {selectedThumbnailFile.name}
                    </button>
                  </div>
                )}
              </div>
            </label>

            <label>
              Upload gallery images
              <div className="vendor-products-file-picker">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleSelectGalleryFiles}
                />

                {existingGalleryImages.length > 0 && (
                  <div className="vendor-products-image-list">
                    {existingGalleryImages.map((image, index) => (
                      <button
                        key={`${String(image)}-${index}`}
                        type="button"
                        className="vendor-products-image-thumb"
                        onClick={() =>
                          handleRequestRemoveExistingGalleryImage(image, index)
                        }
                        title={`Xóa ảnh ${getStoredImageLabel(
                          image,
                          `Gallery image ${index + 1}`,
                        )}`}
                      >
                        <img src={image} alt={`Current gallery ${index + 1}`} />
                      </button>
                    ))}
                  </div>
                )}

                {selectedGalleryFiles.length > 0 && (
                  <div className="vendor-products-file-list">
                    {selectedGalleryFiles.map((file) => (
                      <button
                        key={getSelectedFileKey(file)}
                        type="button"
                        className="vendor-products-file-chip"
                        onClick={() => handleRemoveSelectedGalleryFile(file)}
                        title={`Xóa ảnh ${file.name}`}
                      >
                        {file.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </label>

            {selectedCategoryConfig.flags.useColors && (
              <label>
                Colors (hex)
                <input
                  name="colorsText"
                  type="text"
                  placeholder="#000000, #ff8800"
                  value={form.colorsText}
                  onChange={handleInputChange}
                />
              </label>
            )}

            {selectedCategoryConfig.flags.useSizes && (
              <label>
                Sizes
                <input
                  name="sizesText"
                  type="text"
                  placeholder="S, M, L hoặc Standard, Combo..."
                  value={form.sizesText}
                  onChange={handleInputChange}
                />
              </label>
            )}

            {selectedCategoryConfig.flags.useFashionFields && (
              <>
                <label>
                  Brand
                  <input
                    name="brand"
                    type="text"
                    placeholder="VD: Zara, H&M"
                    value={form.brand}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Material
                  <input
                    name="material"
                    type="text"
                    placeholder="Cotton, Linen..."
                    value={form.material}
                    onChange={handleInputChange}
                  />
                </label>
              </>
            )}

            {selectedCategoryConfig.flags.useElectronicsFields && (
              <>
                <label>
                  Model
                  <input
                    name="model"
                    type="text"
                    placeholder="VD: X200 Pro"
                    value={form.model}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Warranty (months)
                  <input
                    name="warrantyMonths"
                    type="number"
                    min="0"
                    value={form.warrantyMonths}
                    onChange={handleInputChange}
                  />
                </label>
              </>
            )}

            {selectedCategoryConfig.flags.useFoodFields && (
              <>
                <label>
                  Expiry date
                  <input
                    name="expiryDate"
                    type="date"
                    value={form.expiryDate}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Weight / Volume
                  <input
                    name="weight"
                    type="text"
                    placeholder="500g, 1L..."
                    value={form.weight}
                    onChange={handleInputChange}
                  />
                </label>
              </>
            )}

            {selectedCategoryConfig.flags.useHomeFields && (
              <label>
                Material
                <input
                  name="material"
                  type="text"
                  placeholder="Nhựa, gỗ, inox..."
                  value={form.material}
                  onChange={handleInputChange}
                />
              </label>
            )}

            {errorMessage && (
              <p className="vendor-products-error">{errorMessage}</p>
            )}

            <div className="vendor-products-actions is-full">
              <button type="button" onClick={resetForm} disabled={isSaving}>
                Reset
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={isSaving ? "is-saving" : ""}
              >
                {editingId
                  ? isSaving
                    ? "Saving..."
                    : "Save changes"
                  : isSaving
                    ? "Submitting..."
                    : "Submit product"}
              </button>
            </div>
          </fieldset>
        </form>
      </section>

      <VendorProductsListSection
        currentPage={currentPage}
        isError={shouldShowBlockingListError}
        isLoading={shouldShowBlockingListLoading}
        isSaving={isSaving}
        onAction={handleAction}
        paginatedVendorProducts={paginatedVendorProducts}
        processingProductId={processingProductId}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        vendorProductsCount={vendorProducts.length}
      />

      {imagePendingRemoval && (
        <div className="vendor-products-modal" role="dialog" aria-modal="true">
          <div
            className="vendor-products-modal__backdrop"
            onClick={handleCancelImageRemoval}
          />
          <div className="vendor-products-modal__card">
            <p className="vendor-products-modal__title">
              Bạn muốn xóa ảnh này?
            </p>
            <div className="vendor-products-modal__actions">
              <button
                type="button"
                className="vendor-products-modal__button vendor-products-modal__button--danger"
                onClick={handleConfirmImageRemoval}
              >
                Xóa
              </button>
              <button
                type="button"
                className="vendor-products-modal__button vendor-products-modal__button--neutral"
                onClick={handleCancelImageRemoval}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
