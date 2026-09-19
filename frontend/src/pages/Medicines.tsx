import { FormEvent, useEffect, useState } from "react";
import { api, errorMessage } from "../api";
import { useI18n, type MessageKey } from "../i18n";
import { Cell, Field, Money, PageHeader } from "../ui";

const MEDICINE_FORMS: { value: string; key: MessageKey }[] = [
  { value: "Tablet", key: "formTablet" },
  { value: "Capsule", key: "formCapsule" },
  { value: "Syrup", key: "formSyrup" },
  { value: "Injection", key: "formInjection" },
  { value: "Drops", key: "formDrops" },
  { value: "Cream", key: "formCream" },
  { value: "Ointment", key: "formOintment" },
  { value: "Inhaler", key: "formInhaler" },
  { value: "Powder", key: "formPowder" },
  { value: "Sachet", key: "formSachet" },
  { value: "Suspension", key: "formSuspension" },
  { value: "Gel", key: "formGel" },
  { value: "Spray", key: "formSpray" },
  { value: "Other", key: "formOther" },
];

type Category = { id: string; name: string };
type Medicine = {
  id: string;
  sku: string;
  barcode?: string;
  brandName: string;
  genericName: string;
  strength: string;
  form: string;
  packSize: string;
  salePrice: number;
  purchasePrice: number;
  reorderLevel: number;
  isControlled: boolean;
  stock: number;
  category: Category;
};

const empty = {
  sku: "",
  barcode: "",
  brandName: "",
  genericName: "",
  strength: "",
  form: "Tablet",
  packSize: "",
  manufacturer: "",
  salePrice: 0,
  purchasePrice: 0,
  reorderLevel: 10,
  isControlled: false,
  categoryId: "",
};

export function Medicines() {
  const { t } = useI18n();
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const [meds, cats] = await Promise.all([
      api.get("/catalog/medicines", { params: { q: search } }),
      api.get("/catalog/categories"),
    ]);
    setMedicines(meds.data);
    setCategories(cats.data);
    if (!form.categoryId && cats.data[0]) setForm((f) => ({ ...f, categoryId: cats.data[0].id }));
  }

  useEffect(() => {
    const id = window.setTimeout(() => setSearch(query), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    load();
  }, [search]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await api.post("/catalog/medicines", form);
      setOpen(false);
      setForm({ ...empty, categoryId: categories[0]?.id || "" });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("medicines")} help={t("medicinesHelp")} action={<button className="btn btn-primary" onClick={() => setOpen(true)}>{t("addMedicine")}</button>} />
      <Field title={t("searchMedicine")}>
        <input className="field max-w-md" value={query} onChange={(e) => setQuery(e.target.value)} />
      </Field>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="p-3">{t("brand")}</th>
              <th className="p-3">{t("sku")}</th>
              <th className="p-3">{t("category")}</th>
              <th className="p-3">{t("salePrice")}</th>
              <th className="p-3">{t("stock")}</th>
            </tr>
          </thead>
          <tbody>
            {medicines.map((m) => (
              <tr key={m.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                <Cell title={t("brand")}>
                  <div className="font-bold">{m.brandName}</div>
                  <div className="muted">{m.genericName} · {m.strength} · {m.form}</div>
                </Cell>
                <Cell title={t("sku")}>{m.sku}</Cell>
                <Cell title={t("category")}>{m.category.name}</Cell>
                <Cell title={t("salePrice")}><Money value={m.salePrice} /></Cell>
                <Cell title={t("stock")}>
                  <span className={`font-bold ${m.stock <= m.reorderLevel ? "text-amber-700" : ""}`} style={m.stock <= m.reorderLevel ? undefined : { color: "var(--copper-deep)" }}>{m.stock}</span>
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-20">
          <form className="card p-6 w-full max-w-2xl space-y-3" onSubmit={onSubmit}>
            <div className="text-xl font-extrabold">{t("newMedicine")}</div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <div className="grid md:grid-cols-2 gap-3">
              <Field title={t("brand")}><input className="field" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} /></Field>
              <Field title={t("generic")}><input className="field" value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} /></Field>
              <Field title={t("sku")}><input className="field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
              <Field title={t("barcode")}><input className="field" value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} /></Field>
              <Field title={t("strength")}><input className="field" value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} /></Field>
              <Field title={t("form")}>
                <select className="field" value={form.form} onChange={(e) => setForm({ ...form, form: e.target.value })}>
                  {MEDICINE_FORMS.map((item) => (
                    <option key={item.value} value={item.value}>{t(item.key)}</option>
                  ))}
                </select>
              </Field>
              <Field title={t("packSize")}><input className="field" value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} /></Field>
              <Field title={t("category")}>
                <select className="field" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field title={t("salePrice")}><input className="field" type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} /></Field>
              <Field title={t("purchasePrice")}><input className="field" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>{t("cancel")}</button>
              <button className="btn btn-primary">{t("saveMedicine")}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
