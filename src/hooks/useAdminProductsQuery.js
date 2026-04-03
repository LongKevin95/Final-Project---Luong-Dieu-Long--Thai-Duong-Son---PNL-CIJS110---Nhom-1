import { useQuery } from "@tanstack/react-query";

import { getProducts } from "../api/productApi";

export function useAdminProductsQuery() {
  return useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
    staleTime: 1000 * 60 * 5,
  });
}
