import { fetchResourceDocument, updateResourceData } from "./resourceApi";

const DEFAULT_ROLES = ["customer"];
const USERS_RESOURCE_NAME = "users";

function buildNextUsersPayload(_payload, nextUsers) {
  return {
    users: nextUsers,
  };
}

function resolveUsersSnapshot(dataItem) {
  if (Array.isArray(dataItem?.users)) {
    return {
      payload: dataItem,
      users: dataItem.users,
      dataId: dataItem?._id ?? null,
    };
  }

  const nestedList = Array.isArray(dataItem?.data) ? dataItem.data : [];
  const nestedItem = nestedList.find((item) => Array.isArray(item?.users));

  if (!nestedItem) {
    return null;
  }

  return {
    payload: nestedItem,
    users: nestedItem.users,
    dataId: dataItem?._id ?? null,
  };
}

function normalizeUser(user) {
  const roles = Array.isArray(user.roles)
    ? user.roles
    : user.role
      ? [user.role]
      : [];
  const { role: _legacyRole, ...rest } = user;

  return {
    ...rest,
    roles,
  };
}

async function fetchUsersPayload() {
  const document = await fetchResourceDocument(USERS_RESOURCE_NAME);
  const dataList = Array.isArray(document?.data) ? document.data : [];

  for (let index = dataList.length - 1; index >= 0; index -= 1) {
    const snapshot = resolveUsersSnapshot(dataList[index]);

    if (snapshot) {
      return snapshot;
    }
  }

  return {
    payload: null,
    users: [],
    dataId: null,
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

  const { payload, users, dataId } = await fetchUsersPayload();
  const normalizedUsers = users.map(normalizeUser);
  const existed = normalizedUsers.find(
    (user) => user.email === normalizedEmail,
  );

  if (existed) {
    throw new Error("Email này đã được đăng ký.");
  }

  const nextUser = normalizeUser({
    id: `customer-${Date.now()}`,
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
    roles: DEFAULT_ROLES,
    status: "active",
    phone: "0900000001",
    createdAt: new Date().toISOString(),
  });

  const nextUsers = [...normalizedUsers, nextUser];
  await updateResourceData({
    resourceName: USERS_RESOURCE_NAME,
    dataId,
    payload: buildNextUsersPayload(payload, nextUsers),
  });

  const { password: PASSWORD, role: _legacyRole, ...publicUser } = nextUser;
  return publicUser;
}

export async function loginWithCredentials({ email, password }) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const normalizedPassword = String(password ?? "");

  const { users } = await fetchUsersPayload();
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

  const { payload, users, dataId } = await fetchUsersPayload();
  const normalizedUsers = users.map(normalizeUser);
  const nextUsers = normalizedUsers.map((user) => {
    if (user.email !== normalizedEmail) {
      return user;
    }

    const nextRoles = user.roles.includes(role)
      ? user.roles
      : [...user.roles, role];

    const nextStatus =
      role === "vendor" && !["approved", "rejected"].includes(user.status)
        ? "pending"
        : user.status;

    return {
      ...user,
      roles: nextRoles,
      status: nextStatus,
    };
  });

  await updateResourceData({
    resourceName: USERS_RESOURCE_NAME,
    dataId,
    payload: buildNextUsersPayload(payload, nextUsers),
  });

  const updatedUser = nextUsers.find((user) => user.email === normalizedEmail);

  if (!updatedUser) {
    throw new Error("Không tìm thấy tài khoản để cập nhật.");
  }

  const { password: PASSWORD, role: _legacyRole, ...publicUser } = updatedUser;
  return publicUser;
}

export default {
  loginWithCredentials,
  registerUser,
  updateUserRole,
};
