import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useI18n } from "../i18n";
import { Cell, DualDate, Field, Money, PageHeader } from "../ui";

export function Expenses() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: 0, category: "Rent", date: new Date().toISOString().slice(0, 10), notes: "" });
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/expenses");
    setRows(data);
  }
  useEffect(() => { load(); }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/expenses", { ...form, amount: Number(form.amount) });
      setOpen(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div className="space-y-5">
      <PageHeader title={t("expenses")} help={t("expensesHelp")} action={<button className="btn btn-primary" onClick={() => setOpen(true)}>{t("addExpense")}</button>} />
      <div className="card p-5">
        <div className="text-sm font-bold">{t("total")}</div>
        <div className="text-2xl font-extrabold"><Money value={total} /></div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">{t("name")}</th>
              <th className="p-3">{t("category")}</th>
              <th className="p-3">{t("amount")}</th>
              <th className="p-3">{t("date")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[var(--line)]">
                <Cell title={t("name")}><span className="font-bold">{row.title}</span></Cell>
                <Cell title={t("category")}>{row.category}</Cell>
                <Cell title={t("amount")}><Money value={row.amount} /></Cell>
                <Cell title={t("date")}><DualDate value={row.date} /></Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <form className="card p-6 w-full max-w-lg space-y-3" onSubmit={onSubmit}>
            <div className="text-xl font-extrabold">{t("addExpense")}</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Field title={t("name")}><input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field title={t("amount")}><input className="field" type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
            <Field title={t("category")}>
              <select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="Rent">{t("expRent")}</option>
                <option value="Power">{t("expPower")}</option>
                <option value="Salary">{t("expSalary")}</option>
                <option value="Other">{t("expOther")}</option>
              </select>
            </Field>
            <Field title={`${t("date")} (${t("meladi")})`}><input className="field" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field title={t("notes")}><input className="field" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
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
