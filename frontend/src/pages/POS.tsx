import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BillReceipt, printTicket } from "../components/BillReceipt";
import { api, errorMessage } from "../api";
import { useI18n } from "../i18n";
import { Field, InfoBit, Money, PageHeader } from "../ui";

type Batch = { id: string; batchNo: string; expiryDate: string; quantity: number };
type Medicine = {
  id: string;
  sku: string;
  barcode?: string | null;
  brandName: string;
  genericName: string;
  strength: string;
  form: string;
  salePrice: number;
  stock: number;
  isControlled: boolean;
  batches: Batch[];
};
type Customer = {
  id: string;
  name: string;
  phone?: string;
  creditLimit?: number;
  remaining?: number;
  paidToUs?: number;
  totalLoan?: number;
};
type CartLine = {
  medicine: Medicine;
  batch: Batch;
  quantity: number;
  unitPrice: number;
};

function toReceipt(invoiceNo: string, cart: CartLine[], discount: number, tax = 0, paid?: number) {
  const items = cart.map((line) => ({
    name: line.medicine.brandName,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.quantity * line.unitPrice,
  }));
  const subtotal = items.reduce((sum, line) => sum + line.lineTotal, 0);
  const total = Math.max(subtotal - discount + tax, 0);
  return { invoiceNo, items, subtotal, discount, tax, total, paid };
}

function exactMedicine(list: Medicine[], q: string) {
  const code = q.trim();
  if (!code) return null;
  return (
    list.find((m) => m.barcode && m.barcode === code) ||
    list.find((m) => m.sku && m.sku.toLowerCase() === code.toLowerCase()) ||
    null
  );
}

export function POS() {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [type, setType] = useState("WALK_IN");
  const [doctorName, setDoctorName] = useState("");
  const [rxNumber, setRxNumber] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [message, setMessage] = useState("");
  const [receipt, setReceipt] = useState<any>(null);
  const [printSale, setPrintSale] = useState<any>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const handledCode = useRef("");

  useEffect(() => {
    api.get("/customers").then((res) => setCustomers(res.data));
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!q) handledCode.current = "";
    const delay = q ? 180 : 0;
    const id = window.setTimeout(async () => {
      const { data } = await api.get("/catalog/medicines", { params: { q, lite: 1 } });
      const scanned = q ? data.find((m: Medicine) => m.barcode && m.barcode === q) : null;
      if (scanned) {
        if (handledCode.current === q) {
          setMedicines(data);
          return;
        }
        handledCode.current = q;
        addMedicine(scanned);
        setQuery("");
        setMedicines(data);
        searchRef.current?.focus();
        return;
      }
      setMedicines(data);
    }, delay);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    if (!printSale) return;
    const id = window.setTimeout(() => printTicket(), 80);
    return () => window.clearTimeout(id);
  }, [printSale]);

  const subtotal = cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const total = Math.max(subtotal - discount, 0);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  function addMedicine(medicine: Medicine) {
    const batch = [...medicine.batches].sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate)).find((b) => b.quantity > 0);
    if (!batch) {
      setMessage(`${medicine.brandName} ${t("outOfStock")}`);
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.medicine.id === medicine.id && line.batch.id === batch.id);
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: Math.min(line.quantity + 1, batch.quantity) } : line
        );
      }
      return [...current, { medicine, batch, quantity: 1, unitPrice: Number(medicine.salePrice) }];
    });
    setMessage(`${t("addedToBill")}: ${medicine.brandName}`);
  }

  function setQty(index: number, quantity: number) {
    setCart((current) =>
      current.map((item, i) => {
        if (i !== index) return item;
        const next = Math.max(1, Math.min(quantity, item.batch.quantity));
        return { ...item, quantity: next };
      })
    );
  }

  function printCurrent() {
    if (receipt) {
      setPrintSale({
        invoiceNo: receipt.invoiceNo,
        items: (receipt.items || []).map((item: any) => ({
          name: item.medicine?.brandName,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
        subtotal: Number(receipt.subtotal),
        discount: Number(receipt.discount),
        tax: Number(receipt.tax),
        total: Number(receipt.total),
        paid: Number(receipt.paid),
      });
    } else if (cart.length) {
      setPrintSale(toReceipt(t("currentBill"), cart, discount, 0, paymentMethod === "CREDIT" ? 0 : total));
    }
  }

  async function checkout() {
    try {
      if (paymentMethod === "CREDIT" && !customerId) {
        setMessage(t("needCustomerCredit"));
        return;
      }
      if (paymentMethod === "CREDIT" && selectedCustomer) {
        const left = Math.max(Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.remaining || 0), 0);
        if (total > left) {
          setMessage(t("overCredit"));
          return;
        }
      }
      const { data } = await api.post("/sales", {
        customerId: customerId || null,
        type,
        doctorName,
        rxNumber,
        discount,
        paymentMethod,
        paid: paymentMethod === "CREDIT" ? 0 : total,
        items: cart.map((line) => ({
          medicineId: line.medicine.id,
          batchId: line.batch.id,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          discount: 0,
        })),
      });
      setReceipt(data);
      setMessage(`${t("savedBill")}: ${data.invoiceNo}`);
      setCart([]);
      setDiscount(0);
      setDoctorName("");
      setRxNumber("");
      setQuery("");
      searchRef.current?.focus();
      const people = await api.get("/customers");
      setCustomers(people.data);
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    try {
      const { data } = await api.get("/catalog/medicines", { params: { q, lite: 1 } });
      const hit = exactMedicine(data, q);
      if (hit || data.length === 1) {
        const medicine = hit || data[0];
        handledCode.current = q;
        addMedicine(medicine);
        setQuery("");
        setMedicines(data);
        return;
      }
      setMedicines(data);
      if (!data.length) setMessage(t("noBarcode"));
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  return (
    <div className="grid xl:grid-cols-[1.3fr_0.9fr] gap-5">
      <div className="space-y-4">
        <PageHeader title={t("pos")} help={t("posHelp")} />
        <Field title={t("searchMedicine")}>
          <input
            ref={searchRef}
            className="field text-lg py-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            placeholder={`${t("barcode")} / ${t("generic")} / ${t("brand")}`}
            autoFocus
          />
        </Field>
        <div className="grid md:grid-cols-2 gap-3">
          {medicines.slice(0, 10).map((medicine) => (
            <button key={medicine.id} className="card p-4 text-start hover:border-[var(--copper)]" onClick={() => addMedicine(medicine)}>
              <div className="grid grid-cols-2 gap-2">
                <InfoBit title={t("brand")}>{medicine.brandName}</InfoBit>
                <InfoBit title={t("price")}><Money value={medicine.salePrice} /></InfoBit>
                <InfoBit title={t("generic")}>{medicine.genericName}</InfoBit>
                <InfoBit title={t("stock")}>
                  <span className={medicine.stock <= 0 ? "text-red-600" : ""} style={medicine.stock <= 0 ? undefined : { color: "var(--copper-deep)" }}>{medicine.stock}</span>
                </InfoBit>
                <InfoBit title={t("barcode")}>{medicine.barcode || medicine.sku}</InfoBit>
                <InfoBit title={t("form")}>{medicine.form}</InfoBit>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <div className="font-extrabold text-lg">{t("currentBill")}</div>
        {message && <div className="note">{message}</div>}
        <div className="space-y-3 max-h-72 overflow-auto">
          {cart.length === 0 && <div className="text-sm muted">{t("noItems")}</div>}
          {cart.map((line, index) => (
            <div key={`${line.medicine.id}-${line.batch.id}`} className="border-b pb-3 space-y-2" style={{ borderColor: "var(--line)" }}>
              <div className="grid grid-cols-2 gap-2">
                <InfoBit title={t("brand")}>{line.medicine.brandName}</InfoBit>
                <InfoBit title={t("generic")}>{line.medicine.genericName}</InfoBit>
              </div>
              <div className="flex items-end gap-2">
                <Field title={t("quantity")} className="flex-1">
                  <div className="qty-row">
                    <button type="button" className="btn btn-small btn-ghost" onClick={() => setQty(index, line.quantity - 1)}>-</button>
                    <input
                      className="field"
                      type="number"
                      min={1}
                      max={line.batch.quantity}
                      value={line.quantity}
                      onChange={(e) => setQty(index, Number(e.target.value))}
                    />
                    <button type="button" className="btn btn-small btn-ghost" onClick={() => setQty(index, line.quantity + 1)}>+</button>
                  </div>
                </Field>
                <InfoBit title={t("lineTotal")}><Money value={line.quantity * line.unitPrice} /></InfoBit>
                <button className="btn btn-small btn-danger" onClick={() => setCart((current) => current.filter((_, i) => i !== index))}>
                  {t("remove")}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field title={t("customerTitle")}>
            <select
              className="field"
              value={customerId}
              onChange={(e) => {
                const next = e.target.value;
                setCustomerId(next);
                if (!next && paymentMethod === "CREDIT") setPaymentMethod("CASH");
              }}
            >
              <option value="">{t("walkIn")}</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          {selectedCustomer && (
            <div className="col-span-2 rounded-xl p-3 text-sm" style={{ background: "color-mix(in srgb, var(--copper) 10%, white)" }}>
              <div className="grid grid-cols-4 gap-2">
                <InfoBit title={t("creditLimit")}><Money value={selectedCustomer.creditLimit || 0} /></InfoBit>
                <InfoBit title={t("totalLoan")}><Money value={selectedCustomer.totalLoan || 0} /></InfoBit>
                <InfoBit title={t("remaining")}><Money value={selectedCustomer.remaining || 0} /></InfoBit>
                <InfoBit title={t("creditLeft")}><Money value={Math.max(Number(selectedCustomer.creditLimit || 0) - Number(selectedCustomer.remaining || 0), 0)} /></InfoBit>
              </div>
            </div>
          )}
          <Field title={t("saleType")}>
            <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="WALK_IN">{t("walkInSale")}</option>
              <option value="PRESCRIPTION">{t("prescriptionSale")}</option>
            </select>
          </Field>
          {type === "PRESCRIPTION" && (
            <>
              <Field title={t("doctorName")}>
                <input className="field" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
              </Field>
              <Field title={t("rxNumber")}>
                <input className="field" value={rxNumber} onChange={(e) => setRxNumber(e.target.value)} />
              </Field>
            </>
          )}
          <Field title={t("discount")}>
            <input className="field" type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </Field>
          <Field title={t("paymentMethod")}>
            <select className="field" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">{t("cash")}</option>
              <option value="CARD">{t("card")}</option>
              <option value="WALLET">{t("wallet")}</option>
              {customerId ? <option value="CREDIT">{t("credit")}</option> : null}
            </select>
          </Field>
        </div>

        <div className="rounded-2xl p-4" style={{ background: "var(--sidebar)", color: "var(--sidebar-text)" }}>
          <div className="flex justify-between text-sm">
            <span>{t("subtotal")}</span>
            <Money value={subtotal} />
          </div>
          <div className="flex justify-between text-3xl font-extrabold mt-2">
            <span>{t("total")}</span>
            <Money value={total} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-print py-3" disabled={cart.length === 0 && !receipt} onClick={printCurrent}>{t("printBill")}</button>
          <button className="btn btn-primary py-3" disabled={cart.length === 0} onClick={checkout}>{t("completeSale")}</button>
        </div>
        {receipt && (
          <div className="note">
            {t("savedBill")}: {receipt.invoiceNo} · <Money value={receipt.total} />
          </div>
        )}
        <BillReceipt sale={printSale} />
      </div>
    </div>
  );
}
