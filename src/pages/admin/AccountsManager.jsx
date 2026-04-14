import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { updateCustomerStatus, updateVendorStatus } from "../../api/usersApi";
import { useUsersQuery } from "../../hooks/useUsersQuery";
import "./VendorManager.css";

const statusOptions = ["all", "active", "banned", "rejected"];

function getRoles(user) {
  if (Array.isArray(user?.roles)) {
    return user.roles;
  }

  if (user?.role) {
    return [user.role];
  }

  return [];
}

function resolveAccountRole(user) {
  const roles = getRoles(user);

  if (roles.includes("vendor")) {
    return "vendor";
  }

  return "customer";
}

function normalizeStatusByRole(role, status) {
  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  if (role === "vendor") {
    return normalizedStatus === "rejected" ? "rejected" : "active";
  }

  if (["banned", "suspended", "rejected"].includes(normalizedStatus)) {
    return "banned";
  }

  return "active";
}

function formatStatus(status) {
  switch (status) {
    case "active":
      return "Active";
    case "banned":
      return "Banned";
    case "rejected":
      return "Rejected";
    default:
      return "Unknown";
  }
}

function formatRole(role) {
  return role === "vendor" ? "Vendor" : "Customer";
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

function getCreatedAtTimestamp(createdAt) {
  if (!createdAt) {
    return 0;
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return 0;
  }

  return date.getTime();
}

export default function AccountsManager() {
  const queryClient = useQueryClient();
  const { data: users = [], isLoading, isError } = useUsersQuery();
  const actionMenuRef = useRef(null);
  const [processingEmail, setProcessingEmail] = useState("");
  const [openActionEmail, setOpenActionEmail] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [reasonByEmail, setReasonByEmail] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (!openActionEmail) {
      return undefined;
    }

    const handlePointerDownOutside = (event) => {
      if (!actionMenuRef.current?.contains(event.target)) {
        setOpenActionEmail("");
      }
    };

    document.addEventListener("mousedown", handlePointerDownOutside);

    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [openActionEmail]);

  const getReasonValue = (account) => {
    const accountEmail = String(account?.email ?? "")
      .trim()
      .toLowerCase();

    if (typeof reasonByEmail[accountEmail] === "string") {
      return reasonByEmail[accountEmail];
    }

    return String(account?.reason ?? "");
  };

  const accounts = useMemo(() => {
    return users
      .filter((user) => {
        const roles = getRoles(user);
        return roles.includes("customer") || roles.includes("vendor");
      })
      .map((user) => {
        const role = resolveAccountRole(user);

        return {
          ...user,
          accountName:
            user?.name ??
            user?.ownerName ??
            user?.shopName ??
            user?.email ??
            "N/A",
          role,
          status: normalizeStatusByRole(role, user?.status),
          reason: user?.reason ?? null,
        };
      })
      .sort(
        (accountA, accountB) =>
          getCreatedAtTimestamp(accountB.createdAt) -
          getCreatedAtTimestamp(accountA.createdAt),
      );
  }, [users]);

  const filteredAccounts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    return accounts.filter((account) => {
      if (statusFilter !== "all" && account.status !== statusFilter) {
        return false;
      }

      if (!normalizedKeyword) {
        return true;
      }

      return [account.accountName, account.email, account.role]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(normalizedKeyword),
        );
    });
  }, [accounts, keyword, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, keyword]);

  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return filteredAccounts.slice(startIndex, endIndex);
  }, [filteredAccounts, currentPage, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / itemsPerPage));

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  async function handleUpdateStatus(account, status) {
    const normalizedEmail = String(account?.email ?? "")
      .trim()
      .toLowerCase();
    const reason = getReasonValue(account).trim();

    if (!normalizedEmail) {
      return;
    }

    if (account.role === "vendor" && status === "rejected" && !reason) {
      window.alert(
        "Vui lòng nhập lý do từ chối tài khoản trước khi tiến hành!",
      );
      return;
    }

    if (account.role === "customer" && status === "banned" && !reason) {
      window.alert("Vui lòng nhập lý do khóa tài khoản trước khi tiến hành!");
      return;
    }

    try {
      setProcessingEmail(normalizedEmail);

      if (account.role === "vendor") {
        await updateVendorStatus({ email: normalizedEmail, status, reason });
      } else {
        await updateCustomerStatus({ email: normalizedEmail, status, reason });
      }

      if (status === "active") {
        setReasonByEmail((previousState) => ({
          ...previousState,
          [normalizedEmail]: "",
        }));
      }

      await queryClient.invalidateQueries({ queryKey: ["users"] });
    } finally {
      setProcessingEmail("");
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div></div>
        <div className="admin-page__filters">
          <input
            type="text"
            placeholder="Tìm theo tên, email, role"
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
            Không thể tải danh sách tài khoản. Vui lòng thử lại.
          </p>
        )}
        {!isLoading && !isError && (
          <div className="manage-vendor-table manage-vendor-table--accounts">
            <div className="manage-vendor-table__row manage-vendor-table__head">
              <span>STT</span>
              <span>ID</span>
              <span>User Name</span>
              <span>Email</span>
              <span>Role</span>
              <span>Created Since</span>
              <span>Status</span>
              <span>Reason</span>
              <span>Actions</span>
            </div>
            {paginatedAccounts.map((account, index) => {
              const accountEmail = String(account.email ?? "")
                .trim()
                .toLowerCase();
              const isRowUpdating = processingEmail === accountEmail;
              const isActiveAccount = account.status === "active";
              const isActionMenuOpen = openActionEmail === accountEmail;

              return (
                <div
                  className="manage-vendor-table__row"
                  key={account.id ?? account.email}
                >
                  <span>{(currentPage - 1) * itemsPerPage + index + 1}</span>
                  <span>{account.id || "N/A"}</span>
                  <span>{account.accountName}</span>
                  <span>{account.email}</span>
                  <span>{formatRole(account.role)}</span>
                  <span>{formatCreatedSince(account.createdAt)}</span>
                  <span>
                    <span
                      className={`status-pill status-pill--${account.status}`}
                    >
                      {formatStatus(account.status)}
                    </span>
                  </span>
                  <span>
                    <input
                      className="admin-reason-input"
                      type="text"
                      placeholder="Nhập lý do..."
                      value={getReasonValue(account)}
                      disabled={isRowUpdating}
                      onChange={(event) => {
                        setReasonByEmail((previousState) => ({
                          ...previousState,
                          [accountEmail]: event.target.value,
                        }));
                      }}
                    />
                  </span>
                  <span className="admin-actions">
                    <span
                      className="admin-action-control admin-action-menu"
                      ref={isActionMenuOpen ? actionMenuRef : null}
                    >
                      <button
                        type="button"
                        className="admin-action-trigger"
                        disabled={isRowUpdating}
                        onClick={() => {
                          setOpenActionEmail((previousState) =>
                            previousState === accountEmail ? "" : accountEmail,
                          );
                        }}
                      >
                        <span>Select</span>
                        <span
                          className="admin-action-trigger__arrow"
                          aria-hidden="true"
                        >
                          ▾
                        </span>
                      </button>
                      {isActionMenuOpen && (
                        <div className="admin-action-menu__panel">
                          <button
                            type="button"
                            className={
                              isActiveAccount
                                ? "admin-action-menu__item admin-action-menu__item--disabled"
                                : "admin-action-menu__item"
                            }
                            disabled={isActiveAccount}
                            onClick={() => {
                              handleUpdateStatus(account, "active");
                              setOpenActionEmail("");
                            }}
                            title={
                              isActiveAccount
                                ? "Tài khoản này đang ở trạng thái Active"
                                : "Approve"
                            }
                          >
                            Approve
                          </button>
                          {account.role === "vendor" ? (
                            <button
                              type="button"
                              className="admin-action-menu__item"
                              onClick={() => {
                                handleUpdateStatus(account, "rejected");
                                setOpenActionEmail("");
                              }}
                            >
                              Reject
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="admin-action-menu__item"
                              onClick={() => {
                                handleUpdateStatus(account, "banned");
                                setOpenActionEmail("");
                              }}
                            >
                              Ban
                            </button>
                          )}
                        </div>
                      )}
                      {isRowUpdating && (
                        <span className="admin-action-spinner" />
                      )}
                    </span>
                  </span>
                </div>
              );
            })}
            {paginatedAccounts.length === 0 && filteredAccounts.length > 0 && (
              <p className="admin-status">Không có tài khoản phù hợp.</p>
            )}
            {filteredAccounts.length === 0 && (
              <p className="admin-status">Không có tài khoản phù hợp.</p>
            )}
            <div className="admin-pagination">
              <button
                type="button"
                className="admin-pagination-btn"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <span className="admin-pagination-info">
                Page {currentPage} of {totalPages}
              </span>
              <button
                type="button"
                className="admin-pagination-btn"
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={currentPage === totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

