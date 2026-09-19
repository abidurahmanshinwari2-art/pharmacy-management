import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useI18n } from "../i18n";
import { Cell, Field, Money, PageHeader } from "../ui";

export function Customers() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", address: "", creditLimit: 0 });
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const { data } = await api.get("/customers");
    setRows(data);
  }
  useEffect(() => { load(); }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/customers", form);
      setOpen(false);
      setForm({ name: "", phone: "", address: "", creditLimit: 0 });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function savePay(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post(`/customers/${pay.id}/pay`, { amount: Number(amount) });
      setPay(null);
      setAmount("");
      setMessage(t("paymentSaved"));
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("customers")} help={t("customersHelp")} action={<button className="btn btn-primary" onClick={() => setOpen(true)}>{t("addCustomer")}</button>} />
      {message && <div className="note">{message}</div>}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">{t("name")}</th>
              <th className="p-3">{t("phone")}</th>
              <th className="p-3">{t("creditLimit")}</th>
              <th className="p-3">{t("totalLoan")}</th>
              <th className="p-3">{t("paidToUs")}</th>
              <th className="p-3">{t("remaining")}</th>
              <th className="p-3">{t("billsCount")}</th>
              <th className="p-3">{t("action")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <Cell title={t("name")}><span className="font-bold">{c.name}</span></Cell>
                <Cell title={t("phone")}>{c.phone || "-"}</Cell>
                <Cell title={t("creditLimit")}><Money value={c.creditLimit} /></Cell>
                <Cell title={t("totalLoan")}><Money value={c.totalLoan} /></Cell>
                <Cell title={t("paidToUs")}><Money value={c.paidToUs} /></Cell>
                <Cell title={t("remaining")}><Money value={c.remaining} /></Cell>
                <Cell title={t("billsCount")}>{c._count.sales}</Cell>
                <Cell title={t("action")}>
                  <button
                    className="btn btn-small btn-edit"
                    disabled={!(Number(c.remaining) > 0)}
                    onClick={() => {
                      setError("");
                      setPay(c);
                      setAmount(String(c.remaining || ""));
                    }}
                  >
                    {t("receivePay")}
                  </button>
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <form className="card p-6 w-full max-w-lg space-y-3" onSubmit={onSubmit}>
            <div className="text-xl font-extrabold">{t("newCustomer")}</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Field title={t("name")}><input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
            <Field title={t("phone")}><input className="field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
            <Field title={t("address")}><input className="field" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            <Field title={t("creditLimit")}>
              <input className="field" type="number" min={0} value={form.creditLimit} onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })} />
              <div className="muted text-xs mt-1">{t("creditLimitHelp")}</div>
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t("cancel")}</button>
              <button className="btn btn-primary">{t("save")}</button>
            </div>
          </form>
        </div>
      )}
      {pay && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <form className="card p-6 w-full max-w-lg space-y-3" onSubmit={savePay}>
            <div className="text-xl font-extrabold">{pay.name}</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="soft-label">{t("totalLoan")}</div>
                <Money value={pay.totalLoan} />
              </div>
              <div>
                <div className="soft-label">{t("paidToUs")}</div>
                <Money value={pay.paidToUs} />
              </div>
              <div>
                <div className="soft-label">{t("remaining")}</div>
                <Money value={pay.remaining} />
              </div>
            </div>
            <Field title={t("payAmount")}>
              <input
                className="field"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                max={Number(pay.remaining)}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setPay(null)}>{t("cancel")}</button>
              <button className="btn btn-primary">{t("receivePay")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
