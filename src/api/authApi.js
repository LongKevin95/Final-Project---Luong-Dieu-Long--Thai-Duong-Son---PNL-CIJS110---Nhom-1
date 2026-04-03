const USERS_STORAGE_KEY = "ls-ecommerce-users";

const DEMO_ADMIN_ACCOUNT = Object.freeze({
  id: "admin-1",
  name: "Admin",
  email: "admin@gmail.com",
  password: "admin",
  role: "admin",
});

const DEMO_CUSTOMER_ACCOUNT = Object.freeze({
  id: "customer-demo-1",
  name: "Test Customer",
  email: "test@mail.com",
  password: "123456",
  role: "customer",
});

export const demoCustomerCredentials = {
  email: DEMO_CUSTOMER_ACCOUNT.email,
  password: DEMO_CUSTOMER_ACCOUNT.password,
};

function readStoredUsers() {
  try {
    const stored = window.localStorage.getItem(USERS_STORAGE_KEY);

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    window.localStorage.removeItem(USERS_STORAGE_KEY);
    return [];
  }
}

function saveUsers(users) {
  window.localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function ensureDefaultUsers() {
  const users = readStoredUsers();

  if (users.length === 0) {
    const nextUsers = [DEMO_ADMIN_ACCOUNT, DEMO_CUSTOMER_ACCOUNT];
    saveUsers(nextUsers);
    return nextUsers;
  }

  return users;
}

export async function registerUser({ name, email, password }) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const normalizedName = String(name ?? "").trim();
  const normalizedPassword = String(password ?? "");

  if (!normalizedEmail || !normalizedPassword || !normalizedName) {
    throw new Error("Vui lòng nhập đủ thông tin để đăng ký.");
  }

  const users = ensureDefaultUsers();
  const existed = users.find((user) => user.email === normalizedEmail);

  if (existed) {
    throw new Error("Email này đã được đăng ký.");
  }

  const nextUser = {
    id: `customer-${Date.now()}`,
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
    role: "customer",
  };

  const nextUsers = [...users, nextUser];
  saveUsers(nextUsers);

  const { password: PASSWORD, ...publicUser } = nextUser;
  return publicUser;
}

export async function loginWithCredentials({ email, password }) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();
  const normalizedPassword = String(password ?? "");

  const users = ensureDefaultUsers();
  const matchedUser = users.find((user) => user.email === normalizedEmail);

  if (!matchedUser || matchedUser.password !== normalizedPassword) {
    throw new Error("Thông tin đăng nhập chưa đúng. Vui lòng thử lại.");
  }

  const { password: PASSWORD, ...publicUser } = matchedUser;
  return publicUser;
}

export async function updateUserRole(email, role) {
  const normalizedEmail = String(email ?? "")
    .trim()
    .toLowerCase();

  const users = ensureDefaultUsers();
  const nextUsers = users.map((user) =>
    user.email === normalizedEmail ? { ...user, role } : user,
  );

  saveUsers(nextUsers);

  const updatedUser = nextUsers.find((user) => user.email === normalizedEmail);

  if (!updatedUser) {
    throw new Error("Không tìm thấy tài khoản để cập nhật.");
  }

  const { password: PASSWORD, ...publicUser } = updatedUser;
  return publicUser;
}

export default {
  loginWithCredentials,
  registerUser,
  updateUserRole,
  demoCustomerCredentials,
};
