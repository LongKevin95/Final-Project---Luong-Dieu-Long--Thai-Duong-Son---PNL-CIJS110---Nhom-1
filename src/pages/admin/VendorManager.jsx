import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useUsersQuery } from "../../hooks/useUsersQuery";
import { deleteUserAccount, updateVendorStatus } from "../../api/usersApi";
import "./VendorManager.css";

const statusOptions = ["all", "pending", "approved", "rejected"];

function normalizeVendorStatus(status) {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  if (normalizedStatus === "active") {
    return "approved";
  }

  if (normalizedStatus === "suspended") {
    return "rejected";
  }

  if (["pending", "approved", "rejected"].includes(normalizedStatus)) {
    return normalizedStatus;
  }

  return "pending";
}

function formatStatus(status) {
  switch (status) {
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    default:
      return "Unknown";
  }
}

function formatCreatedSince(createdAt) {
  if (!createdAt) {
    return "N/A";
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }

  return date.toLocaleDateString("en-GB");
}

export default function VendorManager() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, isError } = useUsersQuery();
  const [processingVendorEmail, setProcessingVendorEmail] = useState("");
  const [deletingVendor, setDeletingVendor] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const vendorUsers = useMemo(() => {
    return users
      .map((user) => {
        const roles = Array.isArray(user?.roles)
          ? user.roles
          : user?.role
            ? [user.role]
            : [];

        return {
          ...user,
          roles,
          vendorName: user?.name ?? user?.ownerName ?? user?.shopName ?? "N/A",
          status: normalizeVendorStatus(user?.status),
        };
      })
      .filter((user) => user.roles.includes("vendor"));
  }, [users]);

  const filteredVendors = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return vendorUsers.filter((vendor) => {
      if (statusFilter !== "all" && vendor.status !== statusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [vendor.vendorName, vendor.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [keyword, statusFilter, vendorUsers]);

  async function handleUpdateStatus(email, status) {
    const normalizedEmail = String(email ?? "")
      .trim()
      .toLowerCase();

    try {
      setProcessingVendorEmail(normalizedEmail);
      await updateVendorStatus({ email: normalizedEmail, status });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } finally {
      setProcessingVendorEmail("");
    }
  }

  async function handleConfirmDelete() {
    const normalizedEmail = String(deletingVendor?.email ?? "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      return;
    }

    try {
      setProcessingVendorEmail(normalizedEmail);
      await deleteUserAccount({ email: normalizedEmail });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingVendor(null);
    } finally {
      setProcessingVendorEmail("");
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div></div>
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
          <button type="button" className="btn-vendor-delete-all">
            Delete All
          </button>
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
          <div className="manage-vendor-table">
            <div className="manage-vendor-table__row manage-vendor-table__head">
              <span>STT</span>
              <span>Vendor</span>
              <span>Email</span>
              <span>Created Since</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredVendors.map((vendor, index) => {
              const vendorEmail = String(vendor.email ?? "")
                .trim()
                .toLowerCase();
              const isRowUpdating = processingVendorEmail === vendorEmail;

              return (
                <div
                  className="manage-vendor-table__row"
                  key={vendor.id ?? vendor.email}
                >
                  <span>{index + 1}</span>
                  <span>{vendor.vendorName}</span>
                  <span>{vendor.email}</span>
                  <span>{formatCreatedSince(vendor.createdAt)}</span>
                  <span>
                    <span
                      className={`status-pill status-pill--${vendor.status}`}
                    >
                      {formatStatus(vendor.status)}
                    </span>
                  </span>
                  <span className="admin-actions">
                    <span className="admin-action-control">
                      <select
                        className="admin-action-select"
                        defaultValue=""
                        disabled={isRowUpdating}
                        onChange={(event) => {
                          const selectedAction = event.target.value;

                          if (!selectedAction) {
                            return;
                          }

                          if (selectedAction === "delete") {
                            setDeletingVendor({
                              email: vendor.email,
                              vendorName: vendor.vendorName,
                            });
                            event.target.value = "";
                            return;
                          }

                          handleUpdateStatus(vendor.email, selectedAction);
                          event.target.value = "";
                        }}
                      >
                        <option value="">Select</option>
                        <option value="approved">Approve</option>
                        <option value="rejected">Reject</option>
                        <option value="delete">Delete</option>
                      </select>
                      {isRowUpdating && (
                        <span className="admin-action-spinner" />
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
            {filteredVendors.length === 0 && (
              <p className="admin-status">Không có vendor phù hợp.</p>
            )}
          </div>
        )}
      </section>

      {deletingVendor && (
        <div className="admin-delete-modal-backdrop" role="presentation">
          <div className="admin-delete-modal" role="dialog" aria-modal="true">
            <div className="admin-delete-modal__header">
              <h3 style={{ fontWeight: "bold" }}>Delete confirmation</h3>
              <button
                type="button"
                className="admin-delete-modal__close"
                onClick={() => setDeletingVendor(null)}
                aria-label="Close"
                disabled={processingVendorEmail === deletingVendor.email}
              >
                ×
              </button>
            </div>
            <p>Are you sure you want to delete this account?</p>
            <div className="admin-delete-modal__actions">
              <button
                type="button"
                className="admin-delete-modal__btn admin-delete-modal__btn--cancel"
                onClick={() => setDeletingVendor(null)}
                disabled={processingVendorEmail === deletingVendor.email}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-delete-modal__btn admin-delete-modal__btn--delete"
                onClick={handleConfirmDelete}
                disabled={processingVendorEmail === deletingVendor.email}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
