import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Boxes,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Pill,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  BarChart3,
  UserRound,
  Wallet,
} from "lucide-react";
import { useAuth } from "../auth";
import { Calculator } from "../components/Calculator";
import { LanguageSwitch, useI18n, type MessageKey } from "../i18n";
import { useShop } from "../shop";
import { LiveClock } from "../ui";

const links: { to: string; key: MessageKey; icon: typeof LayoutDashboard; roles?: string[] }[] = [
  { to: "/", key: "dashboard", icon: LayoutDashboard },
  { to: "/pos", key: "pos", icon: ShoppingCart },
  { to: "/sales", key: "sales", icon: ClipboardList },
  { to: "/medicines", key: "medicines", icon: Pill },
  { to: "/inventory", key: "inventory", icon: Boxes },
  { to: "/purchases", key: "purchases", icon: PackagePlus },
  { to: "/suppliers", key: "suppliers", icon: Truck },
  { to: "/customers", key: "customers", icon: UserRound },
  { to: "/expenses", key: "expenses", icon: Wallet, roles: ["ADMIN", "ACCOUNTANT"] },
  { to: "/reports", key: "reports", icon: BarChart3 },
  { to: "/users", key: "users", icon: Users, roles: ["ADMIN"] },
  { to: "/settings", key: "settings", icon: Settings, roles: ["ADMIN"] },
];

const ROLE_PATHS: Record<string, string[]> = {
  ADMIN: ["/", "/pos", "/sales", "/medicines", "/inventory", "/purchases", "/suppliers", "/customers", "/expenses", "/reports", "/users", "/settings"],
  PHARMACIST: ["/", "/pos", "/sales", "/medicines", "/inventory", "/purchases", "/customers", "/reports"],
  CASHIER: ["/", "/pos", "/sales", "/customers"],
  STOREKEEPER: ["/", "/medicines", "/inventory", "/purchases", "/suppliers"],
  ACCOUNTANT: ["/", "/customers", "/suppliers", "/expenses", "/reports"],
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { settings } = useShop();

  const roleKey: Record<string, MessageKey> = {
    ADMIN: "admin",
    PHARMACIST: "pharmacist",
    CASHIER: "cashier",
    STOREKEEPER: "storekeeper",
    ACCOUNTANT: "accountant",
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <aside className="fixed inset-y-0 left-0 w-72 p-5 flex flex-col" style={{ background: "linear-gradient(180deg, var(--sidebar), var(--sidebar-end))", color: "var(--sidebar-text)" }}>
        <div className="px-2 py-3 mb-6">
          <div className="text-xs uppercase tracking-[0.2em]" style={{ color: "var(--sidebar-muted)" }}>{t("appName")}</div>
          <div className="text-2xl font-extrabold mt-1">{settings.name || t("shopName")}</div>
          {settings.tagline ? <div className="text-xs mt-1" style={{ color: "var(--sidebar-muted)" }}>{settings.tagline}</div> : null}
        </div>
        <nav className="space-y-1 flex-1 overflow-auto">
          {links
            .filter((link) => {
              const allowed = ROLE_PATHS[user?.role || "CASHIER"] || ROLE_PATHS.CASHIER;
              if (!allowed.includes(link.to)) return false;
              return !link.roles || (user && link.roles.includes(user.role));
            })
            .map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
                    isActive ? "bg-[var(--card)] text-[var(--ink)]" : "hover:bg-[var(--sidebar-2)]"
                  }`
                }
              >
                <link.icon size={18} />
                {t(link.key)}
              </NavLink>
            ))}
        </nav>
        <button
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-[var(--sidebar-2)]"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          <LogOut size={18} />
          {t("signOut")}
        </button>
      </aside>

      <div className="ml-72 min-h-screen">
        <header className="sticky top-0 z-10 backdrop-blur border-b px-8 py-4 flex items-center justify-between gap-4" style={{ background: "color-mix(in srgb, var(--paper) 90%, white)", borderColor: "var(--line)" }}>
          <div>
            <div className="text-xs" style={{ color: "var(--muted)" }}>{t("welcome")}</div>
            <div className="font-bold">{user?.name}</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Calculator />
            <LiveClock />
            <LanguageSwitch />
            <div className="rounded-full bg-white border px-4 py-2 text-sm font-semibold" style={{ borderColor: "var(--line)" }}>
              {user ? t(roleKey[user.role] || "cashier") : ""}
            </div>
          </div>
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
