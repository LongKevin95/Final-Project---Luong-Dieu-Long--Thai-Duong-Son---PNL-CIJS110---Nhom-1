import { useQuery } from "@tanstack/react-query";

import { getProducts } from "../api/productApi";

export function useProductsQuery() {
  return useQuery({
    queryKey: ["products", "public"],
    queryFn: getProducts,
    staleTime: 1000 * 60 * 5,
  });
}
