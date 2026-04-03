import axiosClient from "./axiosClient";

export const getProducts = async () => {
  const res = await axiosClient.get("/resources/ecommerce-data", {
    params: {
      apiKey: "69ca4ee923e7029021931e3a",
    },
  });

  // tương đương const products = res.data.data.data[0].products -> return products
  const {
    data: {
      data: [firstItem],
    },
  } = res.data;

  return firstItem.products;
};
