import { fetchResourceData } from "./resourceApi";

export const getUsers = async () => {
  const payload = await fetchResourceData();
  return payload?.users ?? [];
};
