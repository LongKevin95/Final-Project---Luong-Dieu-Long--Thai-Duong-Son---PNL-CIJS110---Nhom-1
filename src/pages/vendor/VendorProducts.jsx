import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
  category: "",
  description: "",
  price: "",
  stock: "",
  thumbnail: "",
  imagesText: "",
  colorsText: "",
  sizesText: "",
};

const fallbackCategories = [
  "electronics",
  "fashion",
  "home",
  "beauty",
  "sports",
  "books",
  "other",
];

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

export default function VendorProducts() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data: products = [], isLoading, isError } = useAdminProductsQuery();

  const [form, setForm] = useState(defaultForm);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [processingProductId, setProcessingProductId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

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

  const paginatedVendorProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return vendorProducts.slice(startIndex, endIndex);
  }, [vendorProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(vendorProducts.length / itemsPerPage);

  const categories = useMemo(() => {
    const fromData = products
      .map((product) =>
        String(product?.category ?? "")
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);

    return [...new Set([...fallbackCategories, ...fromData])];
  }, [products]);

  function handleInputChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function handleSelectFiles(event) {
    const files = Array.from(event.target.files ?? []);
    setSelectedFiles(files);

    if (errorMessage) {
      setErrorMessage("");
    }
  }

  function resetForm() {
    setForm(defaultForm);
    setSelectedFiles([]);
    setEditingId("");
    setErrorMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const title = form.title.trim();
    const description = form.description.trim();
    const category = form.category.trim().toLowerCase();
    const price = Number(form.price);
    const stock = Number(form.stock);
    const manualImages = parseInputList(form.imagesText);

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

      const uploadedImages = await Promise.all(
        selectedFiles.map((file) => readFileAsDataUrl(file)),
      );

      const images = [...new Set([...manualImages, ...uploadedImages])];

      if (images.length === 0) {
        setErrorMessage("Bạn cần chọn tối thiểu 1 ảnh sản phẩm.");
        setIsSaving(false);
        return;
      }

      const thumbnail = form.thumbnail.trim() || images[0];
      const colors = normalizeHexColors(form.colorsText);
      const sizes = parseInputList(form.sizesText);

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

      await queryClient.invalidateQueries({ queryKey: ["products", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["products", "public"] });
      resetForm();
    } catch (error) {
      setErrorMessage(
        error?.message ?? "Không thể lưu sản phẩm. Vui lòng thử lại.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAction(product, action) {
    if (!action) {
      return;
    }

    const targetProductId = String(product?.id ?? "");

    try {
      setIsSaving(true);
      setProcessingProductId(targetProductId);

      if (action === "edit") {
        setEditingId(String(product.id));
        setForm({
          title: product.title ?? "",
          category: product.category ?? "",
          description: product.description ?? "",
          price: String(product.price ?? ""),
          stock: String(product.stock ?? 0),
          thumbnail: product.image ?? "",
          imagesText: Array.isArray(product.images)
            ? product.images.join("\n")
            : "",
          colorsText: Array.isArray(product.colors)
            ? product.colors.join(", ")
            : "",
          sizesText: Array.isArray(product.sizes)
            ? product.sizes.join(", ")
            : "",
        });
        setSelectedFiles([]);
        return;
      }

      if (action === "hide") {
        await updateProductById({
          id: product.id,
          updates: {
            status: PRODUCT_STATUS.INACTIVE,
            reason: "Vendor hidden",
          },
        });
      }

      if (action === "show") {
        await updateProductById({
          id: product.id,
          updates: {
            status: PRODUCT_STATUS.ACTIVE,
            reason: null,
          },
        });
      }

      if (action === "delete") {
        await removeProductById(product.id);
      }

      await queryClient.invalidateQueries({ queryKey: ["products", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["products", "public"] });
    } catch (error) {
      setErrorMessage(error?.message ?? "Không thể xử lý action sản phẩm.");
    } finally {
      setProcessingProductId("");
      setIsSaving(false);
    }
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
        return "Banned";
      default:
        return "Unknown";
    }
  }

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
                <option value="">Chọn category</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
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
              Thumbnail URL
              <input
                name="thumbnail"
                type="text"
                placeholder="Để trống sẽ lấy ảnh đầu tiên"
                value={form.thumbnail}
                onChange={handleInputChange}
              />
            </label>

            <label>
              Upload images
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleSelectFiles}
              />
            </label>

            <label className="is-full">
              Images URL (mỗi dòng hoặc ngăn cách bằng dấu phẩy)
              <textarea
                name="imagesText"
                rows="3"
                value={form.imagesText}
                onChange={handleInputChange}
              />
            </label>

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

            <label>
              Sizes (optional)
              <input
                name="sizesText"
                type="text"
                placeholder="S, M, L hoặc Standard, Combo..."
                value={form.sizesText}
                onChange={handleInputChange}
              />
            </label>

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

      <section className="vendor-products-card">
        <h2>Danh sách sản phẩm</h2>

        {isLoading && <p>Đang tải dữ liệu...</p>}
        {isError && <p>Không thể tải danh sách sản phẩm.</p>}

        {!isLoading && !isError && (
          <div className="vendor-products-table">
            <div className="vendor-products-table__row vendor-products-table__head">
              <span>Item</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Status</span>
              <span>Reason</span>
              <span>Action</span>
            </div>

            {paginatedVendorProducts.map((product) => {
              const isRowUpdating =
                processingProductId &&
                String(processingProductId) === String(product.id);
              const isBannedOrRejected =
                String(product?.status ?? "")
                  .trim()
                  .toLowerCase() === PRODUCT_STATUS.BANNED ||
                String(product?.status ?? "")
                  .trim()
                  .toLowerCase() === PRODUCT_STATUS.REJECTED;
              const isInactive =
                String(product?.status ?? "")
                  .trim()
                  .toLowerCase() === PRODUCT_STATUS.INACTIVE;

              return (
                <div className="vendor-products-table__row" key={product.id}>
                  <span>
                    <Link to={`/product/${product.id}`}>{product.title}</Link>
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
                      <select
                        defaultValue=""
                        disabled={isSaving}
                        onChange={(event) => {
                          const action = event.target.value;
                          event.target.value = "";
                          handleAction(product, action);
                        }}
                      >
                        <option value="">Select</option>
                        {!isBannedOrRejected && (
                          <option value="edit">Edit</option>
                        )}
                        {isInactive ? (
                          <option value="show">Show</option>
                        ) : (
                          <option value="hide">Hide</option>
                        )}
                        <option value="delete">Delete</option>
                      </select>
                      {isRowUpdating && (
                        <span className="vendor-action-spinner" />
                      )}
                    </span>
                  </span>
                </div>
              );
            })}

            {paginatedVendorProducts.length === 0 &&
              vendorProducts.length > 0 && (
                <p className="vendor-products-empty">
                  Không có sản phẩm nào ở trang này.
                </p>
              )}

            {vendorProducts.length === 0 && (
              <p className="vendor-products-empty">
                Bạn chưa có sản phẩm nào. Hãy đăng sản phẩm đầu tiên.
              </p>
            )}

            {totalPages > 1 && (
              <div className="vendor-pagination">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
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
    </div>
  );
}
