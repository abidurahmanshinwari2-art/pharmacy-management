import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";

export type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "PHARMACIST" | "CASHIER" | "STOREKEEPER" | "ACCOUNTANT";
};

type AuthContextValue = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem("pharmacy_user");
    return raw ? (JSON.parse(raw) as User) : null;
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      async login(email, password) {
        const { data } = await api.post("/auth/login", { email, password });
        localStorage.setItem("pharmacy_token", data.token);
        localStorage.setItem("pharmacy_user", JSON.stringify(data.user));
        setUser(data.user);
        window.dispatchEvent(new Event("pharmacy-auth"));
      },
      logout() {
        localStorage.removeItem("pharmacy_token");
        localStorage.removeItem("pharmacy_user");
        setUser(null);
      },
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider missing");
  return ctx;
}
