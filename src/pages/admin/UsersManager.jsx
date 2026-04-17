import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { deleteUserAccount, updateCustomerStatus } from "../../api/usersApi";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./VendorManager.css";

const statusOptions = ["all", "active", "banned"];

function normalizeCustomerStatus(status) {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  if (["banned", "suspended", "rejected"].includes(normalizedStatus)) {
    return "banned";
  }

  if (["active", "approved"].includes(normalizedStatus)) {
    return "active";
  }

  return "active";
}

function formatStatus(status) {
  switch (status) {
    case "active":
      return "Active";
    case "banned":
      return "Banned";
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

export default function UsersManager() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, isError } = useUsersQuery();
  const [processingCustomerEmail, setProcessingCustomerEmail] = useState("");
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");

  const customerUsers = useMemo(() => {
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
          customerName: user?.name ?? "N/A",
          status: normalizeCustomerStatus(user?.status),
        };
      })
      .filter((user) => user.roles.includes("customer"));
  }, [users]);

  const filteredCustomers = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return customerUsers.filter((customer) => {
      if (statusFilter !== "all" && customer.status !== statusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [customer.customerName, customer.email]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedKeyword));
    });
  }, [customerUsers, keyword, statusFilter]);

  async function handleUpdateStatus(email, status) {
    const normalizedEmail = String(email ?? "")
      .trim()
      .toLowerCase();

    try {
      setProcessingCustomerEmail(normalizedEmail);
      await updateCustomerStatus({ email: normalizedEmail, status });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } finally {
      setProcessingCustomerEmail("");
    }
  }

  async function handleConfirmDelete() {
    const normalizedEmail = String(deletingCustomer?.email ?? "")
      .trim()
      .toLowerCase();

    if (!normalizedEmail) {
      return;
    }

    try {
      setProcessingCustomerEmail(normalizedEmail);
      await deleteUserAccount({ email: normalizedEmail });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setDeletingCustomer(null);
    } finally {
      setProcessingCustomerEmail("");
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div></div>
        <div className="admin-page__filters">
          <input
            type="text"
            placeholder="Tìm theo tên, email"
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
            Không thể tải danh sách customer. Vui lòng thử lại.
          </p>
        )}
        {!isLoading && !isError && (
          <div className="manage-vendor-table">
            <div className="manage-vendor-table__row manage-vendor-table__head">
              <span>STT</span>
              <span>Customer</span>
              <span>Email</span>
              <span>Created Since</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {filteredCustomers.map((customer, index) => {
              const customerEmail = String(customer.email ?? "")
                .trim()
                .toLowerCase();
              const isRowUpdating = processingCustomerEmail === customerEmail;

              return (
                <div
                  className="manage-vendor-table__row"
                  key={customer.id ?? customer.email}
                >
                  <span>{index + 1}</span>
                  <span>{customer.customerName}</span>
                  <span>{customer.email}</span>
                  <span>{formatCreatedSince(customer.createdAt)}</span>
                  <span>
                    <span
                      className={`status-pill status-pill--${customer.status}`}
                    >
                      {formatStatus(customer.status)}
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
                            setDeletingCustomer({
                              email: customer.email,
                              customerName: customer.customerName,
                            });
                            event.target.value = "";
                            return;
                          }

                          handleUpdateStatus(customer.email, selectedAction);
                          event.target.value = "";
                        }}
                      >
                        <option value="">Select</option>
                        <option value="active">Approve</option>
                        <option value="banned">Ban</option>
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
            {filteredCustomers.length === 0 && (
              <p className="admin-status">Không có customer phù hợp.</p>
            )}
          </div>
        )}
      </section>

      {deletingCustomer && (
        <div className="admin-delete-modal-backdrop" role="presentation">
          <div className="admin-delete-modal" role="dialog" aria-modal="true">
            <div className="admin-delete-modal__header">
              <h3 style={{ fontWeight: "bold" }}>Delete confirmation</h3>
              <button
                type="button"
                className="admin-delete-modal__close"
                onClick={() => setDeletingCustomer(null)}
                aria-label="Close"
                disabled={processingCustomerEmail === deletingCustomer.email}
              >
                ×
              </button>
            </div>
            <p>Are you sure you want to delete this customer account?</p>
            <div className="admin-delete-modal__actions">
              <button
                type="button"
                className="admin-delete-modal__btn admin-delete-modal__btn--cancel"
                onClick={() => setDeletingCustomer(null)}
                disabled={processingCustomerEmail === deletingCustomer.email}
              >
                Cancel
              </button>
              <button
                type="button"
                className="admin-delete-modal__btn admin-delete-modal__btn--delete"
                onClick={handleConfirmDelete}
                disabled={processingCustomerEmail === deletingCustomer.email}
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
