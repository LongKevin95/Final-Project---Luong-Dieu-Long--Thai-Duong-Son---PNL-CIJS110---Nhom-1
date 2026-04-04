import { fetchResourceDocument, updateResourceData } from "./resourceApi";

const USERS_RESOURCE_NAME = "users";

function resolveUsersSnapshot(dataItem) {
  if (Array.isArray(dataItem?.users)) {
    return {
      dataId: dataItem?._id ?? null,
      users: dataItem.users,
    };
  }

  const nestedList = Array.isArray(dataItem?.data) ? dataItem.data : [];
  const nestedItem = nestedList.find((item) => Array.isArray(item?.users));

  if (!nestedItem) {
    return null;
  }

  return {
    dataId: dataItem?._id ?? null,
    users: nestedItem.users,
  };
}

async function fetchUsersSnapshot() {
  const document = await fetchResourceDocument(USERS_RESOURCE_NAME);
  const dataList = Array.isArray(document?.data) ? document.data : [];

  for (let index = dataList.length - 1; index >= 0; index -= 1) {
    const snapshot = resolveUsersSnapshot(dataList[index]);

    if (snapshot) {
      return snapshot;
    }
  }

  return {
    dataId: null,
    users: [],
  };
}

export const getUsers = async () => {
  const { users } = await fetchUsersSnapshot();
  return users;
};

export const updateVendorStatus = async ({ email, status }) => {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Missing vendor email.");
  }

  const nextStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  const { dataId, users } = await fetchUsersSnapshot();
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
    };
  });

  await updateResourceData({
    resourceName: USERS_RESOURCE_NAME,
    dataId,
    payload: {
      users: nextUsers,
    },
  });
};

export const updateCustomerStatus = async ({ email, status }) => {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Missing customer email.");
  }

  const normalizedStatus = String(status ?? "")
    .trim()
    .toLowerCase();

  const nextStatus = ["active", "banned"].includes(normalizedStatus)
    ? normalizedStatus
    : "active";

  const { dataId, users } = await fetchUsersSnapshot();
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
    };
  });

  await updateResourceData({
    resourceName: USERS_RESOURCE_NAME,
    dataId,
    payload: {
      users: nextUsers,
    },
  });
};

export const deleteUserAccount = async ({ email }) => {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Missing user email.");
  }

  const { dataId, users } = await fetchUsersSnapshot();
  const nextUsers = users.filter((user) => {
    const userEmail = String(user?.email ?? "")
      .trim()
      .toLowerCase();

    return userEmail !== normalizedEmail;
  });

  await updateResourceData({
    resourceName: USERS_RESOURCE_NAME,
    dataId,
    payload: {
      users: nextUsers,
    },
  });
};
