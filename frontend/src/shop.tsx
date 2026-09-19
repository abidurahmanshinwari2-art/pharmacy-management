import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setMoneySymbol } from "./api";
import { useAuth } from "./auth";

const MONEY_CACHE = "pharmacy_money";

function cachedSymbol() {
  try {
    return localStorage.getItem(MONEY_CACHE) || "";
  } catch {
    return "";
  }
}

function rememberSymbol(symbol: string) {
  try {
    localStorage.setItem(MONEY_CACHE, symbol);
  } catch {
    /* ignore */
  }
  setMoneySymbol(symbol);
}

export type ShopSettings = {
  id?: string;
  name: string;
  tagline: string;
  address: string;
  phone: string;
  email: string;
  licenseNo: string;
  taxId: string;
  currency: string;
  currencySymbol: string;
  taxName: string;
  taxPercent: number;
  invoicePrefix: string;
  purchasePrefix: string;
  receiptFooter: string;
};

export type Room = { id: string; name: string; address: string };

type ShopValue = {
  settings: ShopSettings;
  rooms: Room[];
  symbol: string;
  setSymbol: (symbol: string) => void;
  reload: () => Promise<void>;
};

const empty: ShopSettings = {
  name: "Noor Pharmacy",
  tagline: "",
  address: "",
  phone: "",
  email: "",
  licenseNo: "",
  taxId: "",
  currency: "AFN",
  currencySymbol: "؋",
  taxName: "Tax",
  taxPercent: 0,
  invoicePrefix: "INV",
  purchasePrefix: "PO",
  receiptFooter: "",
};

const ShopContext = createContext<ShopValue | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ShopSettings>(() => ({
    ...empty,
    currencySymbol: cachedSymbol() || empty.currencySymbol,
  }));
  const [rooms, setRooms] = useState<Room[]>([]);

  async function reload() {
    try {
      const { data } = await api.get("/settings");
      const symbol = String(data.currencySymbol || cachedSymbol() || "؋");
      const next = {
        ...empty,
        ...data,
        currencySymbol: symbol,
        taxPercent: Number(data.taxPercent || 0),
      };
      setSettings(next);
      setRooms(data.locations || []);
      rememberSymbol(symbol);
    } catch {
      try {
        const { data } = await api.get("/settings/public");
        setSettings((prev) => ({ ...prev, name: data.name || prev.name, tagline: data.tagline || prev.tagline }));
      } catch {
        // offline or first install
      }
    }
  }

  useEffect(() => {
    void reload();
  }, [user?.id]);

  function setSymbol(next: string) {
    const symbol = String(next || "؋");
    rememberSymbol(symbol);
    setSettings((prev) => ({ ...prev, currencySymbol: symbol }));
  }

  const symbol = settings.currencySymbol || cachedSymbol() || "؋";
  const value = useMemo(
    () => ({ settings, rooms, symbol, setSymbol, reload }),
    [settings, rooms, symbol]
  );
  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("ShopProvider missing");
  return ctx;
}
