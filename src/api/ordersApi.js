import { fetchResourceData } from "./resourceApi";

export const getOrders = async () => {
  const payload = await fetchResourceData();
  return payload?.orders ?? [];
};
