import { useQuery } from "@tanstack/react-query";

import { getUsers } from "../api/usersApi";

const USERS_STALE_TIME = 1000 * 60 * 10;
const USERS_GC_TIME = 1000 * 60 * 30;

export function useUsersQuery() {
  return useQuery({
    queryKey: ["users"],
    queryFn: getUsers,
    staleTime: USERS_STALE_TIME,
    gcTime: USERS_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
