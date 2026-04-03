import { fetchResourceData } from "./resourceApi";

export const getVendors = async () => {
  const payload = await fetchResourceData();
  return payload?.vendors ?? [];
};
