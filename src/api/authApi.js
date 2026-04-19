import { fetchUsersSnapshot, persistUsersSnapshot } from "./usersResourceApi";

const DEFAULT_ROLES = ["customer"];

function normalizeUser(user) {
  const roles = Array.isArray(user.roles)
    ? user.roles
    : user.role
      ? [user.role]
      : [];
  const { role: _legacyRole, ...rest } = user;
  const normalizedStatus = String(rest?.status ?? "")
    .trim()
    .toLowerCase();

  const nextStatus = ["banned", "rejected"].includes(normalizedStatus)
    ? normalizedStatus
    : "active";

  return {
    ...rest,
    roles,
    status: nextStatus,
    reason: nextStatus === "active" ? null : (rest?.reason ?? null),
  };
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const normalizedName = String(name ?? "").trim();
  const normalizedPassword = String(password ?? "");

  if (!normalizedEmail || !normalizedPassword || !normalizedName) {
    throw new Error("Vui lòng nhập đủ thông tin để đăng ký.");
  }

  const snapshot = await fetchUsersSnapshot();
  const { users } = snapshot;
  const normalizedUsers = users.map(normalizeUser);
  const existed = normalizedUsers.find(
    (user) => user.email === normalizedEmail,
  );

  if (existed) {
    throw new Error("Email này đã được đăng ký.");
  }

  const nextUser = normalizeUser({
    id: `${Date.now()}`,
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
    roles: DEFAULT_ROLES,
    status: "active",
    phone: "0900000001",
    createdAt: new Date().toISOString(),
  });

  const nextUsers = [...normalizedUsers, nextUser];
  await persistUsersSnapshot(snapshot, nextUsers);

  const { password: PASSWORD, role: _legacyRole, ...publicUser } = nextUser;
  return publicUser;
}

export async function loginWithCredentials({ email, password }) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const normalizedPassword = String(password ?? "");

  const { users } = await fetchUsersSnapshot();
  const normalizedUsers = users.map(normalizeUser);
  const matchedUser = normalizedUsers.find(
    (user) => user.email === normalizedEmail,
  );

  if (!matchedUser || matchedUser.password !== normalizedPassword) {
    throw new Error("Thông tin đăng nhập chưa đúng. Vui lòng thử lại.");
  }

  const {
    password: PASSWORD,
    role: _legacyRole,
    ...publicUser
  } = normalizeUser(matchedUser);
  return publicUser;
}

export async function updateUserRole(email, role) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  const snapshot = await fetchUsersSnapshot();
  const { users } = snapshot;
  const normalizedUsers = users.map(normalizeUser);
  const nextUsers = normalizedUsers.map((user) => {
    if (user.email !== normalizedEmail) {
      return user;
    }

    const nextRoles = user.roles.includes(role)
      ? user.roles
      : [...user.roles, role];

    const nextStatus = user.status;

    return {
      ...user,
      roles: nextRoles,
      status: nextStatus,
      reason: nextStatus === "active" ? null : (user?.reason ?? null),
    };
  });

  await persistUsersSnapshot(snapshot, nextUsers);

  const updatedUser = nextUsers.find((user) => user.email === normalizedEmail);

  if (!updatedUser) {
    throw new Error("Không tìm thấy tài khoản để cập nhật.");
  }

  const { password: PASSWORD, role: _legacyRole, ...publicUser } = updatedUser;
  return publicUser;
}

export async function updateUserProfile(email, updates = {}) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Thiếu email tài khoản để cập nhật profile.");
  }

  const snapshot = await fetchUsersSnapshot();
  const { users } = snapshot;
  const normalizedUsers = users.map(normalizeUser);

  let updatedUser = null;

  const nextUsers = normalizedUsers.map((user) => {
    if (
      String(user?.email ?? "")
        .trim()
        .toLowerCase() !== normalizedEmail
    ) {
      return user;
    }

    const merged = {
      ...user,
      name: String(updates?.name ?? user?.name ?? "").trim(),
      phone: String(updates?.phone ?? user?.phone ?? "").trim(),
      avatarUrl: String(updates?.avatarUrl ?? user?.avatarUrl ?? "").trim(),
      address: String(updates?.address ?? user?.address ?? "").trim(),
      bio: String(updates?.bio ?? user?.bio ?? "").trim(),
      shopName: String(updates?.shopName ?? user?.shopName ?? "").trim(),
      updatedAt: new Date().toISOString(),
    };

    const isVendor =
      Array.isArray(merged.roles) && merged.roles.includes("vendor");

    if (isVendor && !merged.shopName) {
      merged.shopName = merged.name || merged.email.split("@")[0] || "My Shop";
    }

    updatedUser = merged;
    return merged;
  });

  if (!updatedUser) {
    throw new Error("Không tìm thấy tài khoản để cập nhật profile.");
  }

  await persistUsersSnapshot(snapshot, nextUsers);

  const { password: PASSWORD, role: _legacyRole, ...publicUser } = updatedUser;
  return publicUser;
}

export default {
  loginWithCredentials,
  registerUser,
  updateUserRole,
  updateUserProfile,
};
