import { useMemo, useState } from "react";

import { useVendorsQuery } from "../../hooks/useVendorsQuery";
import "./VendorManager.css";

const statusOptions = ["all", "pending", "active", "suspended"];

function formatStatus(status) {
  switch (status) {
    case "pending":
      return "Pending";
    case "active":
      return "Active";
    case "suspended":
      return "Suspended";
    default:
      return "Unknown";
  }
}

export default function VendorManager() {
  const { data = [], isLoading, isError } = useVendorsQuery();
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const filteredVendors = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return data.filter((vendor) => {
      if (statusFilter !== "all" && vendor.status !== statusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [vendor.shopName, vendor.ownerName, vendor.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [data, keyword, statusFilter]);

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p>Quản lý danh sách shop/vendor và trạng thái hoạt động.</p>
        </div>
        <div className="admin-page__filters">
          <input
            type="text"
            placeholder="Tìm theo shop, chủ shop, email"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All Status" : formatStatus(status)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="admin-card">
        {isLoading && <p className="admin-status">Đang tải dữ liệu...</p>}
        {isError && (
          <p className="admin-status admin-status--error">
            Không thể tải danh sách vendor. Vui lòng thử lại.
          </p>
        )}
        {!isLoading && !isError && (
          <div className="admin-table">
            <div className="admin-table__row admin-table__head">
              <span>#</span>
              <span>Shop</span>
              <span>Owner</span>
              <span>Email</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredVendors.map((vendor, index) => (
              <div className="admin-table__row" key={vendor.id}>
                <span>{index + 1}</span>
                <span>{vendor.shopName}</span>
                <span>{vendor.ownerName}</span>
                <span>{vendor.email}</span>
                <span>
                  <span className={`status-pill status-pill--${vendor.status}`}>
                    {formatStatus(vendor.status)}
                  </span>
                </span>
                <span className="admin-actions">
                  <button type="button" className="ghost-btn">
                    Approve
                  </button>
                  <button type="button" className="ghost-btn ghost-btn--danger">
                    Suspend
                  </button>
                </span>
              </div>
            ))}
            {filteredVendors.length === 0 && (
              <p className="admin-status">Không có vendor phù hợp.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
