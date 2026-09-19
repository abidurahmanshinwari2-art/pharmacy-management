import { Money } from "../ui";

export function printTicket() {
  document.body.classList.add("ticket-print");
  const done = () => {
    document.body.classList.remove("ticket-print");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.setTimeout(() => window.print(), 50);
}
import { useI18n } from "../i18n";
import { useShop } from "../shop";

type Line = {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export function BillReceipt({
  sale,
  forPrint = true,
}: {
  sale: {
    invoiceNo: string;
    items: Line[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paid?: number;
  } | null;
  forPrint?: boolean;
}) {
  const { t } = useI18n();
  const { settings } = useShop();
  if (!sale) return null;
  return (
    <div className={`receipt${forPrint ? " receipt-print" : ""}`} dir="ltr">
      <h2>{settings.name}</h2>
      <p>
        {settings.address}
        <br />
        {settings.phone}
      </p>
      <p><b>{sale.invoiceNo}</b></p>
      <table>
        <tbody>
          {sale.items.map((line, index) => (
            <tr key={line.id || index}>
              <td>{line.name} × {line.quantity}</td>
              <td><Money value={line.lineTotal} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {Number(sale.discount) > 0 ? <p>{t("discount")}: <Money value={sale.discount} /></p> : null}
      <p>{settings.taxName || t("taxName")}: <Money value={sale.tax} /></p>
      <p><b>{t("total")} <Money value={sale.total} /></b></p>
      {sale.paid != null ? <p>{t("paid")} <Money value={sale.paid} /></p> : null}
      <p>{settings.receiptFooter || t("thankYou")}</p>
    </div>
  );
}
