import axios, { AxiosError, AxiosRequestConfig } from "axios";

const baseURL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";
const api = axios.create({ baseURL, withCredentials: true });

const rawClient = axios.create({ baseURL, withCredentials: true });

let isRefreshing = false;
let failedQueue: {
  resolve: (value?: unknown) => void;
  reject: (error: any) => void;
  config: AxiosRequestConfig;
}[] = [];

function processQueue(error?: any) {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) reject(error);
    else resolve(api.request(config));
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (res) => res,
  async (err: AxiosError & { config?: AxiosRequestConfig }) => {
    const original = err.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;
    if (!original) return Promise.reject(err);

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: original });
        });
      }

      isRefreshing = true;

      try {
        // usa rawClient para evitar circular import / interceptors
        await rawClient.post("/auth/refresh", {}, { withCredentials: true });
        processQueue(null);
        return api.request(original);
      } catch (refreshErr) {
        processQueue(refreshErr);
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
