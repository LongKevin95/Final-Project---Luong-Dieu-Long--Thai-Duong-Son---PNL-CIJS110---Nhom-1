import { fetchUsersSnapshot, persistUsersSnapshot } from "./usersResourceApi";

export const getUsers = async () => {
  const { users } = await fetchUsersSnapshot();
  return users;
};

export const updateVendorStatus = async ({ email, status, reason = null }) => {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Missing vendor email.");
  }

  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();
  const normalizedReason = String(reason ?? "").trim();
  const nextStatus = ["active", "rejected"].includes(normalizedStatus)
    ? normalizedStatus
    : "active";
  const nextReason = nextStatus === "active" ? null : normalizedReason || null;

  const snapshot = await fetchUsersSnapshot();
  const { users } = snapshot;
  const nextUsers = users.map((user) => {
    const userEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();

    if (userEmail !== normalizedEmail) {
      return user;
    }

    return {
      ...user,
      status: nextStatus,
      reason: nextReason,
    };
  });

  await persistUsersSnapshot(snapshot, nextUsers);
};

export const updateCustomerStatus = async ({
  email,
  status,
  reason = null,
}) => {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Missing customer email.");
  }

  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();
  const normalizedReason = String(reason ?? "").trim();

  const nextStatus = ["active", "banned", "rejected"].includes(normalizedStatus)
    ? normalizedStatus
    : "active";

  const snapshot = await fetchUsersSnapshot();
  const { users } = snapshot;
  const nextUsers = users.map((user) => {
    const userEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();

    if (userEmail !== normalizedEmail) {
      return user;
    }

    return {
      ...user,
      status: nextStatus,
      reason: nextStatus === "active" ? null : normalizedReason || null,
    };
  });

  await persistUsersSnapshot(snapshot, nextUsers);
};

export const deleteUserAccount = async ({ email }) => {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Missing user email.");
  }

  const snapshot = await fetchUsersSnapshot();
  const { users } = snapshot;
  const nextUsers = users.filter((user) => {
    const userEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();

    return userEmail !== normalizedEmail;
  });

  await persistUsersSnapshot(snapshot, nextUsers);
};
