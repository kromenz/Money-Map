import axios from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE || "/api";

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
