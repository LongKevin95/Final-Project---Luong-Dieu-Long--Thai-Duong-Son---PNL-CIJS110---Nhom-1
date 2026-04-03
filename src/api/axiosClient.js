import axios from "axios";

const axiosClient = axios.create({
  baseURL: "https://mindx-mockup-server.vercel.app/api",
  timeout: 15000,
  headers: {
    Accept: "application/json",
  },
});

export default axiosClient;
