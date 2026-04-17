import { useQuery } from "@tanstack/react-query";

import { getVendors } from "../api/vendorsApi";

export function useVendorsQuery() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: getVendors,
    staleTime: 1000 * 60 * 5,
  });
}
