import axiosClient from "./axiosClient";

const DEFAULT_RESOURCE_NAME = "ecommerce-data";
const FALLBACK_API_KEY = "69ca4ee923e7029021931e3a";

const apiKey = import.meta.env.VITE_API_KEY || FALLBACK_API_KEY;

export const getResourceDocument = (response) => response?.data?.data ?? null;

export const getResourcePayload = (responseOrDocument) => {
  const document = responseOrDocument?.data?.data
    ? responseOrDocument.data.data
    : responseOrDocument;
  return document?.data?.[0] ?? null;
};

export const fetchResourceData = async (
  resourceName = DEFAULT_RESOURCE_NAME,
) => {
  const res = await axiosClient.get(`/resources/${resourceName}`, {
    params: {
      apiKey,
    },
  });

  return getResourcePayload(res);
};

export const fetchResourceDocument = async (
  resourceName = DEFAULT_RESOURCE_NAME,
) => {
  const res = await axiosClient.get(`/resources/${resourceName}`, {
    params: {
      apiKey,
    },
  });

  return getResourceDocument(res);
};

export const updateResourceData = async ({
  payload,
  resourceName = DEFAULT_RESOURCE_NAME,
  dataId,
}) => {
  const requestConfig = {
    params: {
      apiKey,
    },
  };

  const res = dataId
    ? await axiosClient.put(
        `/resources/${resourceName}/${dataId}`,
        payload,
        requestConfig,
      )
    : await axiosClient.post(
        `/resources/${resourceName}`,
        {
          name: resourceName,
          data: [payload],
        },
        requestConfig,
      );

  return getResourcePayload(res);
};
