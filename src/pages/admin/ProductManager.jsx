import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { PRODUCT_STATUS, updateProductById } from "../../api/productApi";
import { useAdminProductsQuery } from "../../hooks/useAdminProductsQuery";
import "./ProductManager.css";

function formatStatus(status) {
  switch (
    String(status ?? "")
      .trim()
      .toLowerCase()
  ) {
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

export default function ProductManager() {
  const queryClient = useQueryClient();
  const { data: products = [], isLoading, isError } = useAdminProductsQuery();

  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [processingId, setProcessingId] = useState("");
  const [reasonByProductId, setReasonByProductId] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const getReasonValue = (product) => {
    const productId = String(product?.id ?? "");

    if (typeof reasonByProductId[productId] === "string") {
      return reasonByProductId[productId];
    }

    return String(product?.reason ?? "");
  };

  const filteredProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return products.filter((product) => {
      const productStatus = String(product?.status ?? "")
        .trim()
        .toLowerCase();

      if (statusFilter !== "all" && productStatus !== statusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [product?.id, product?.title, product?.category]
        .filter(Boolean)
        .some((item) => String(item).toLowerCase().includes(normalizedKeyword));
    });
  }, [keyword, products, statusFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, keyword]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  async function handleAdminAction(product, action) {
    const normalizedId = String(product?.id ?? "").trim();
    const reason = getReasonValue(product).trim();

    if (!normalizedId || !action) {
      return;
    }

    if (action === "reject" && !reason) {
      window.alert("Vui lòng nhập lý do từ chối sản phẩm trước khi tiến hành!");
      return;
    }

    try {
      setProcessingId(normalizedId);

      if (action === "approve") {
        await updateProductById({
          id: normalizedId,
          updates: {
            status: PRODUCT_STATUS.ACTIVE,
            reason: null,
          },
        });

        setReasonByProductId((previousState) => ({
          ...previousState,
          [normalizedId]: "",
        }));
      }

      if (action === "reject") {
        await updateProductById({
          id: normalizedId,
          updates: {
            status: PRODUCT_STATUS.REJECTED,
            reason,
          },
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["products", "admin"] });
      await queryClient.invalidateQueries({ queryKey: ["products", "public"] });
    } finally {
      setProcessingId("");
    }
  }

  return (
    <div className="admin-products-page">
      <div className="admin-page__header">
        <div></div>
        <div className="admin-page__filters">
          <input
            type="text"
            placeholder="Tìm theo id, title, category"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All Status</option>
            <option value={PRODUCT_STATUS.ACTIVE}>Active</option>
            <option value={PRODUCT_STATUS.DRAFT}>Draft</option>
            <option value={PRODUCT_STATUS.PENDING}>Pending</option>
            <option value={PRODUCT_STATUS.INACTIVE}>Inactive</option>
            <option value={PRODUCT_STATUS.REJECTED}>Rejected</option>
            <option value={PRODUCT_STATUS.OUT_OF_STOCK}>Out of stock</option>
          </select>
        </div>
      </div>

      <section className="admin-card">
        {isLoading && (
          <p className="admin-status">Đang tải danh sách products...</p>
        )}

        {isError && (
          <p className="admin-status admin-status--error">
            Không thể tải danh sách products. Vui lòng thử lại.
          </p>
        )}

        {!isLoading && !isError && (
          <div className="admin-products-table">
            <div className="admin-products-table__row admin-products-table__head">
              <span>Item</span>
              <span>Shop</span>
              <span>ID</span>
              <span>Price</span>
              <span>Stock</span>
              <span>Status</span>
              <span>Reason</span>
              <span>Action</span>
            </div>

            {paginatedProducts.map((product) => {
              const productId = String(product.id ?? "");
              const isProcessing = processingId === productId;
              const statusValue = String(product.status ?? "")
                .trim()
                .toLowerCase();
              const isInactive = statusValue === PRODUCT_STATUS.INACTIVE;

              return (
                <div className="admin-products-table__row" key={product.id}>
                  <span>
                    <Link to={`/product/${product.id}`}>{product.title}</Link>
                  </span>
                  <span>
                    {product.shopName ||
                      (product.vendorEmail
                        ? String(product.vendorEmail).split("@")[0]
                        : "Marketplace")}
                  </span>
                  <span>{product.id || "N/A"}</span>
                  <span>${Number(product.price ?? 0)}</span>
                  <span>{product.stock ?? 0}</span>
                  <span>
                    <span
                      className={`status-pill status-pill--${statusValue.replaceAll("_", "-")}`}
                    >
                      {formatStatus(statusValue)}
                    </span>
                  </span>
                  <span>
                    <input
                      className="admin-reason-input"
                      type="text"
                      placeholder="Nhập lý do..."
                      value={getReasonValue(product)}
                      disabled={isProcessing || isInactive}
                      onChange={(event) => {
                        setReasonByProductId((previousState) => ({
                          ...previousState,
                          [productId]: event.target.value,
                        }));
                      }}
                    />
                  </span>
                  <span className="admin-actions">
                    <span className="admin-action-control">
                      <select
                        className="admin-action-select"
                        defaultValue=""
                        disabled={isProcessing}
                        onChange={(event) => {
                          const action = event.target.value;
                          event.target.value = "";
                          handleAdminAction(product, action);
                        }}
                      >
                        <option value="">Select</option>
                        <option value="approve">Approve</option>
                        <option value="reject">Reject</option>
                      </select>
                      {isProcessing && (
                        <span className="admin-action-spinner" />
                      )}
                    </span>
                  </span>
                </div>
              );
            })}

            {paginatedProducts.length === 0 && filteredProducts.length > 0 && (
              <p className="admin-status">Không có sản phẩm phù hợp.</p>
            )}

            {filteredProducts.length === 0 && (
              <p className="admin-status">Không có sản phẩm phù hợp.</p>
            )}

            {totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="admin-pagination-btn"
                >
                  Previous
                </button>

                <span className="admin-pagination-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="admin-pagination-btn"
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
