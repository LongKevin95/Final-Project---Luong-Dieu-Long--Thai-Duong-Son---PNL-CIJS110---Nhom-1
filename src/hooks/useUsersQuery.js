import { useQuery } from "@tanstack/react-query";

import { getUsers } from "../api/usersApi";

export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    staleTime: 1000 * 60 * 5,
  });
}
  