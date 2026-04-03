import { useQuery } from "@tanstack/react-query";

import { getOrders } from "../api/ordersApi";

export function useOrdersQuery() {
  return useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    staleTime: 1000 * 60 * 5,
  });
}
