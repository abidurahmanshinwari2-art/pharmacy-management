import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLayout } from "./layout/AppLayout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { POS } from "./pages/POS";
import { Medicines } from "./pages/Medicines";
import { Inventory } from "./pages/Inventory";
import { Purchases } from "./pages/Purchases";
import { Suppliers } from "./pages/Suppliers";
import { Customers } from "./pages/Customers";
import { Sales } from "./pages/Sales";
import { Reports } from "./pages/Reports";
import { Users } from "./pages/Users";
import { Settings } from "./pages/Settings";
import { Expenses } from "./pages/Expenses";
import { LicenseGate } from "./license";

function Guard({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <LicenseGate>
      <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Guard>
            <AppLayout />
          </Guard>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="medicines" element={<Medicines />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="sales" element={<Sales />} />
        <Route path="reports" element={<Reports />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="users" element={<Users />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      </Routes>
    </LicenseGate>
  );
}
