import axiosClient from "./axiosClient";

const RESOURCE_NAME = "ecommerce-data";
const FALLBACK_API_KEY = "69ca4ee923e7029021931e3a";

const apiKey = import.meta.env.VITE_API_KEY || FALLBACK_API_KEY;

export const getResourcePayload = (response) =>
  response?.data?.data?.data?.[0] ?? null;

export const fetchResourceData = async () => {
  const res = await axiosClient.get(`/resources/${RESOURCE_NAME}`, {
    params: {
      apiKey,
    },
  });

  return getResourcePayload(res);
};
