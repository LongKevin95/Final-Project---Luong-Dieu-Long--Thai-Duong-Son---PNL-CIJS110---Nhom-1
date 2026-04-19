import { fetchResourceDocument, updateResourceData } from "./resourceApi";

const ECOMMERCE_RESOURCE_NAME = "ecommerce-data";

function resolveUsersSnapshot(
  dataItem,
  resourceName = ECOMMERCE_RESOURCE_NAME,
) {
  if (Array.isArray(dataItem?.users)) {
    return {
      payload: dataItem,
      dataId: dataItem?._id ?? null,
      users: dataItem.users,
      resourceName,
      storage: "direct",
      nestedIndex: -1,
    };
  }

  const nestedList = Array.isArray(dataItem?.data) ? dataItem.data : [];
  const nestedIndex = nestedList.findIndex((item) =>
    Array.isArray(item?.users),
  );

  if (nestedIndex < 0) {
    return null;
  }

  return {
    payload: dataItem,
    dataId: dataItem?._id ?? null,
    users: nestedList[nestedIndex].users,
    resourceName,
    storage: "nested",
    nestedIndex,
  };
}

function findUsersSnapshotInDocument(
  document,
  resourceName = ECOMMERCE_RESOURCE_NAME,
) {
  const dataList = Array.isArray(document?.data) ? document.data : [];

  for (let index = dataList.length - 1; index >= 0; index -= 1) {
    const snapshot = resolveUsersSnapshot(dataList[index], resourceName);

    if (snapshot) {
      return snapshot;
    }
  }

  return null;
}

function createEmptyUsersSnapshot(document) {
  const dataList = Array.isArray(document?.data) ? document.data : [];
  const latestEntry =
    dataList.length > 0 ? dataList[dataList.length - 1] : null;
  const nestedList = Array.isArray(latestEntry?.data) ? latestEntry.data : [];

  return {
    payload: latestEntry,
    dataId: latestEntry?._id ?? null,
    users: [],
    resourceName: ECOMMERCE_RESOURCE_NAME,
    storage: nestedList.length > 0 ? "nested" : "direct",
    nestedIndex: nestedList.length > 0 ? 0 : -1,
  };
}

export async function fetchUsersSnapshot() {
  const document = await fetchResourceDocument(ECOMMERCE_RESOURCE_NAME).catch(
    () => null,
  );
  const fallbackSnapshot = findUsersSnapshotInDocument(
    document,
    ECOMMERCE_RESOURCE_NAME,
  );

  if (fallbackSnapshot) {
    return fallbackSnapshot;
  }

  return createEmptyUsersSnapshot(document);
}

function buildUsersPayload(snapshot, nextUsers) {
  const payload = snapshot?.payload ?? null;

  if (snapshot?.storage === "nested") {
    const currentData = Array.isArray(payload?.data) ? payload.data : [];
    const nextData = currentData.map((item, index) =>
      index === snapshot.nestedIndex ? { ...item, users: nextUsers } : item,
    );

    return {
      ...(payload ?? {}),
      data: nextData.length > 0 ? nextData : [{ users: nextUsers }],
    };
  }

  return {
    ...(payload ?? {}),
    users: nextUsers,
  };
}

export async function persistUsersSnapshot(snapshot, nextUsers) {
  await updateResourceData({
    resourceName: snapshot?.resourceName ?? ECOMMERCE_RESOURCE_NAME,
    dataId: snapshot?.dataId ?? null,
    payload: buildUsersPayload(snapshot, nextUsers),
  });
}
