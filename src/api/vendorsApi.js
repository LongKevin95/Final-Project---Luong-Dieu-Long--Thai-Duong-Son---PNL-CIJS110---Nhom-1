import { getUsers } from "./usersApi";

function normalizeRoles(user) {
  if (Array.isArray(user?.roles)) {
    return user.roles;
  }

  if (user?.role) {
    return [user.role];
  }

  return [];
}

export const getVendors = async () => {
  const users = await getUsers();

  return users.filter((user) =>
    normalizeRoles(user).some((role) => String(role).trim().toLowerCase() === "vendor"),
  );
};
