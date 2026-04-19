import axiosClient from "./axiosClient";

const DEFAULT_RESOURCE_NAME = "ecommerce-data";
const FALLBACK_API_KEY = "69e4178ba9ba7d3635d97510";
const RESOURCE_DOCUMENT_CACHE_TTL = 1000 * 5;

const apiKey = import.meta.env.VITE_API_KEY || FALLBACK_API_KEY;
const resourceDocumentCache = new Map();

function normalizeResourceName(resourceName = DEFAULT_RESOURCE_NAME) {
  const normalizedName = String(resourceName ?? DEFAULT_RESOURCE_NAME).trim();
  return normalizedName || DEFAULT_RESOURCE_NAME;
}

function createResourceRequestConfig() {
  return {
    params: {
      apiKey,
    },
  };
}

function readCachedResourceDocument(resourceName = DEFAULT_RESOURCE_NAME) {
  const cacheKey = normalizeResourceName(resourceName);
  const cachedEntry = resourceDocumentCache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.document && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.document;
  }

  if (cachedEntry.promise) {
    return cachedEntry.promise;
  }

  resourceDocumentCache.delete(cacheKey);
  return null;
}

async function requestResourceDocument(resourceName = DEFAULT_RESOURCE_NAME) {
  const normalizedResourceName = normalizeResourceName(resourceName);
  const res = await axiosClient.get(
    `/resources/${normalizedResourceName}`,
    createResourceRequestConfig(),
  );

  return getResourceDocument(res);
}

function cacheResourceDocument(resourceName, document) {
  const cacheKey = normalizeResourceName(resourceName);
  resourceDocumentCache.set(cacheKey, {
    document,
    expiresAt: Date.now() + RESOURCE_DOCUMENT_CACHE_TTL,
  });
  return document;
}

export function clearResourceDocumentCache(
  resourceName = DEFAULT_RESOURCE_NAME,
) {
  resourceDocumentCache.delete(normalizeResourceName(resourceName));
}

async function fetchCachedResourceDocument(
  resourceName = DEFAULT_RESOURCE_NAME,
) {
  const cachedValue = readCachedResourceDocument(resourceName);

  if (cachedValue) {
    return cachedValue;
  }

  const cacheKey = normalizeResourceName(resourceName);
  const requestPromise = requestResourceDocument(cacheKey)
    .then((document) => cacheResourceDocument(cacheKey, document))
    .catch((error) => {
      resourceDocumentCache.delete(cacheKey);
      throw error;
    });

  resourceDocumentCache.set(cacheKey, {
    promise: requestPromise,
    expiresAt: 0,
  });

  return requestPromise;
}

export const getResourceDocument = (responseOrDocument) =>
  responseOrDocument?.data?.data
    ? responseOrDocument.data.data
    : responseOrDocument;

export const getResourceEntries = (responseOrDocument) => {
  const document = getResourceDocument(responseOrDocument);
  return Array.isArray(document?.data) ? document.data : [];
};

export const getResourcePayload = (responseOrDocument) => {
  const entries = getResourceEntries(responseOrDocument);
  return entries.length > 0 ? entries[entries.length - 1] : null;
};

export const findLatestResourceEntry = (responseOrDocument, predicate) => {
  const entries = getResourceEntries(responseOrDocument);

  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];

    if (typeof predicate !== "function" || predicate(entry, index, entries)) {
      return entry;
    }
  }

  return null;
};

export const fetchResourceData = async (
  resourceName = DEFAULT_RESOURCE_NAME,
) => {
  const document = await fetchCachedResourceDocument(resourceName);
  return getResourcePayload(document);
};

export const fetchLatestResourceEntry = async ({
  resourceName = DEFAULT_RESOURCE_NAME,
  predicate,
} = {}) => {
  const document = await fetchCachedResourceDocument(resourceName);
  return findLatestResourceEntry(document, predicate);
};

export const fetchResourceDocument = async (
  resourceName = DEFAULT_RESOURCE_NAME,
) => {
  return fetchCachedResourceDocument(resourceName);
};

export const updateResourceData = async ({
  payload,
  resourceName = DEFAULT_RESOURCE_NAME,
  dataId,
}) => {
  const normalizedResourceName = normalizeResourceName(resourceName);
  const requestConfig = createResourceRequestConfig();

  clearResourceDocumentCache(normalizedResourceName);

  const res = dataId
    ? await axiosClient.put(
        `/resources/${normalizedResourceName}/${dataId}`,
        payload,
        requestConfig,
      )
    : await axiosClient.post(
        `/resources/${normalizedResourceName}`,
        {
          name: normalizedResourceName,
          data: [payload],
        },
        requestConfig,
      );

  clearResourceDocumentCache(normalizedResourceName);

  return getResourcePayload(res);
};
