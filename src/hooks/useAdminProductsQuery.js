import { useQuery } from "@tanstack/react-query";

import { getAllProducts } from "../api/productApi";

export function useAdminProductsQuery(options = {}) {
  return useQuery({
    queryKey: ["products", "admin"],
    queryFn: getAllProducts,
    staleTime: 1000 * 60 * 5,
    ...options,
  });
}
