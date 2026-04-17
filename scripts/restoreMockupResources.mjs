import axios from "axios";

const DEFAULT_API_KEY =
  process.env.MOCKUP_API_KEY ||
  process.env.VITE_API_KEY ||
  "69ca4ee923e7029021931e3a";
const BASE_URL =
  process.env.MOCKUP_BASE_URL ||
  "https://mindx-mockup-server.vercel.app/api";
const args = new Set(process.argv.slice(2));
const isDryRun = args.has("--dry-run");
const shouldVerify = !args.has("--skip-verify");
const createdAt = new Date().toISOString();

const defaultUsers = [
  {
    id: "admin-1",
    name: "Admin",
    email: "admin@gmail.com",
    password: "admin",
    roles: ["admin"],
    status: "active",
    reason: null,
    createdAt,
  },
  {
    id: "customer-demo-1",
    name: "Test Customer",
    email: "test@mail.com",
    password: "123456",
    roles: ["customer"],
    status: "active",
    reason: null,
    phone: "0900000001",
    createdAt,
  },
];

const restoreTasks = [
  {
    key: "users",
    resourceName: "users",
    payload: {
      users: defaultUsers,
    },
  },
  {
    key: "shops",
    resourceName: "shops",
    payload: {
      shops: [],
    },
  },
  {
    key: "products",
    resourceName: "ecommerce-data",
    payload: {
      products: [],
    },
  },
  {
    key: "orders",
    resourceName: "ecommerce-data",
    payload: {
      orders: [],
    },
  },
];

function createClient() {
  return axios.create({
    baseURL: BASE_URL,
    timeout: 20000,
    headers: {
      Accept: "application/json",
    },
  });
}

function buildRequestBody(resourceName, payload) {
  return {
    name: resourceName,
    data: [payload],
  };
}

function summarizePayload(payload) {
  if (Array.isArray(payload?.users)) {
    return {
      users: payload.users.length,
    };
  }

  if (Array.isArray(payload?.shops)) {
    return {
      shops: payload.shops.length,
    };
  }

  if (Array.isArray(payload?.products)) {
    return {
      products: payload.products.length,
    };
  }

  if (Array.isArray(payload?.orders)) {
    return {
      orders: payload.orders.length,
    };
  }

  return payload;
}

async function postResource(client, task) {
  const response = await client.post(
    `/resources/${task.resourceName}`,
    buildRequestBody(task.resourceName, task.payload),
    {
      params: {
        apiKey: DEFAULT_API_KEY,
      },
    },
  );

  return response.data;
}

async function verifyResource(client, resourceName) {
  const response = await client.get(`/resources/${resourceName}`, {
    params: {
      apiKey: DEFAULT_API_KEY,
    },
  });

  return response.data;
}

function printError(error) {
  const status = error?.response?.status ?? null;
  const data = error?.response?.data ?? null;
  const message = error?.message ?? "Unknown error";

  console.error(
    JSON.stringify(
      {
        status,
        data,
        message,
      },
      null,
      2,
    ),
  );
}

async function main() {
  if (!DEFAULT_API_KEY) {
    throw new Error("Missing mockup server api key.");
  }

  if (isDryRun) {
    console.log(
      JSON.stringify(
        {
          baseURL: BASE_URL,
          verify: shouldVerify,
          tasks: restoreTasks.map((task) => ({
            key: task.key,
            resourceName: task.resourceName,
            summary: summarizePayload(task.payload),
          })),
        },
        null,
        2,
      ),
    );
    return;
  }

  const client = createClient();
  const results = [];

  for (const task of restoreTasks) {
    const response = await postResource(client, task);
    results.push({
      key: task.key,
      resourceName: task.resourceName,
      summary: summarizePayload(task.payload),
      response,
    });
  }

  const verification = shouldVerify
    ? {
        users: await verifyResource(client, "users"),
        shops: await verifyResource(client, "shops"),
        ecommerceData: await verifyResource(client, "ecommerce-data"),
      }
    : null;

  console.log(
    JSON.stringify(
      {
        restoredAt: createdAt,
        baseURL: BASE_URL,
        results,
        verification,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  printError(error);
  process.exit(1);
});
