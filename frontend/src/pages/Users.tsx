import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useAuth } from "../auth";
import { useI18n, type MessageKey } from "../i18n";
import { Cell, Field, PageHeader } from "../ui";

const roles: { value: string; key: MessageKey; access: MessageKey }[] = [
  { value: "ADMIN", key: "admin", access: "accessAdmin" },
  { value: "PHARMACIST", key: "pharmacist", access: "accessPharmacist" },
  { value: "CASHIER", key: "cashier", access: "accessCashier" },
  { value: "STOREKEEPER", key: "storekeeper", access: "accessStorekeeper" },
  { value: "ACCOUNTANT", key: "accountant", access: "accessAccountant" },
];

export function Users() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "staff123", role: "CASHIER" });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await api.get("/users");
    setRows(data);
  }
  useEffect(() => { load(); }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/users", form);
      setOpen(false);
      setError("");
      setMessage(t("userSaved"));
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const adminCount = rows.filter((row) => row.role === "ADMIN" && row.isActive).length;

  function canManage(row: any) {
    if (row.id === user?.id) return false;
    return user?.role === "ADMIN";
  }

  async function setActive(row: any, isActive: boolean) {
    if (!canManage(row)) {
      setMessage(t("cannotChangeAdmin"));
      return;
    }
    if (row.role === "ADMIN" && !isActive && adminCount <= 1) {
      setMessage(t("cannotDeleteLastAdmin"));
      return;
    }
    try {
      await api.patch(`/users/${row.id}`, { isActive });
      setMessage(t("statusSaved"));
      load();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  async function removeUser(row: any) {
    if (!canManage(row)) {
      setMessage(t("cannotChangeAdmin"));
      return;
    }
    if (row.role === "ADMIN" && adminCount <= 1) {
      setMessage(t("cannotDeleteLastAdmin"));
      return;
    }
    try {
      await api.delete(`/users/${row.id}`);
      setMessage(t("userDeleted"));
      load();
    } catch (err) {
      setMessage(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("users")} help={t("usersHelp")} action={<button className="btn btn-primary" onClick={() => setOpen(true)}>{t("addUser")}</button>} />
      {message && <div className="note">{message}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">{t("name")}</th>
              <th className="p-3">{t("email")}</th>
              <th className="p-3">{t("role")}</th>
              <th className="p-3">{t("canAccess")}</th>
              <th className="p-3">{t("status")}</th>
              <th className="p-3">{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const role = roles.find((r) => r.value === u.role);
              return (
                <tr key={u.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <Cell title={t("name")}><span className="font-bold">{u.name}</span></Cell>
                  <Cell title={t("email")}>{u.email}</Cell>
                  <Cell title={t("role")}>{t(role?.key || "cashier")}</Cell>
                  <Cell title={t("canAccess")}><div className="max-w-xs text-xs leading-5">{t(role?.access || "accessCashier")}</div></Cell>
                  <Cell title={t("status")}>{u.isActive ? t("active") : t("disabled")}</Cell>
                  <Cell title={t("action")}>
                    {canManage(u) ? (
                      <div className="flex flex-col items-start gap-1">
                        <button className="btn btn-small btn-edit" onClick={() => setActive(u, !u.isActive)}>
                          {u.isActive ? t("disabled") : t("active")}
                        </button>
                        <button className="btn btn-small btn-danger" onClick={() => removeUser(u)}>{t("deleteUser")}</button>
                      </div>
                    ) : (
                      <span className="text-xs muted">{u.id === user?.id ? t("cannotDeleteSelf") : t("cannotChangeAdmin")}</span>
                    )}
                  </Cell>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <form className="card p-6 w-full max-w-lg space-y-3" onSubmit={onSubmit}>
            <div className="text-xl font-extrabold">{t("newUser")}</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Field title={t("name")}><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field title={t("email")}><input className="field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field title={t("password")}><input className="field" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
            <Field title={t("role")}>
              <select className="field" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {roles.map((role) => (
                  <option key={role.value} value={role.value}>{t(role.key)}</option>
                ))}
              </select>
            </Field>
            <p className="text-xs muted">{t(roles.find((r) => r.value === form.role)?.access || "accessCashier")}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t("cancel")}</button>
              <button className="btn btn-primary">{t("save")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
