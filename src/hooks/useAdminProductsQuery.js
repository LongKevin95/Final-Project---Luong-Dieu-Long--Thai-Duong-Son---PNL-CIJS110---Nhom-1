import { useQuery } from "@tanstack/react-query";

import { getAllProducts } from "../api/productApi";

const ADMIN_PRODUCTS_STALE_TIME = 1000 * 60 * 10;
const ADMIN_PRODUCTS_GC_TIME = 1000 * 60 * 30;

export function useAdminProductsQuery(options = {}) {
  return useQuery({
    queryKey: ["products", "admin"],
    queryFn: getAllProducts,
    staleTime: ADMIN_PRODUCTS_STALE_TIME,
    gcTime: ADMIN_PRODUCTS_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });
}
