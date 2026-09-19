import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pharmacy_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.startsWith("/login")) {
      localStorage.removeItem("pharmacy_token");
      localStorage.removeItem("pharmacy_user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

let moneySymbol = "؋";

export function setMoneySymbol(symbol: string) {
  moneySymbol = symbol || "؋";
}

export function money(value: number | string) {
  return `${moneySymbol} ${Number(value).toLocaleString()}`;
}

export function errorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || "Request failed.";
  }
  return "Something went wrong.";
}
