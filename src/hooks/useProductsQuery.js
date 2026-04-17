import { useQuery } from "@tanstack/react-query";

import { getProducts } from "../api/productApi";

const PRODUCTS_STALE_TIME = 1000 * 60 * 10;
const PRODUCTS_GC_TIME = 1000 * 60 * 30;

export function useProductsQuery(options = {}) {
  return useQuery({
    queryKey: ["products", "public"],
    queryFn: getProducts,
    staleTime: PRODUCTS_STALE_TIME,
    gcTime: PRODUCTS_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });
}
