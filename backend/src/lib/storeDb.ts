import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./appPaths";

export const STORE_FILE = path.join(DATA_DIR, "pharmacy.json");
export const STORE_BAK = path.join(DATA_DIR, "pharmacy.bak");

export function newId() {
  return crypto.randomBytes(12).toString("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export type PharmacyDb = {
  users: any[];
  storeSettings: any[];
  locations: any[];
  categories: any[];
  suppliers: any[];
  customers: any[];
  medicines: any[];
  batches: any[];
  purchases: any[];
  purchaseItems: any[];
  sales: any[];
  saleItems: any[];
  saleReturns: any[];
  saleReturnItems: any[];
  stockAdjustments: any[];
  expenses: any[];
  auditLogs: any[];
};

export function emptyDb(): PharmacyDb {
  return {
    users: [],
    storeSettings: [],
    locations: [],
    categories: [],
    suppliers: [],
    customers: [],
    medicines: [],
    batches: [],
    purchases: [],
    purchaseItems: [],
    sales: [],
    saleItems: [],
    saleReturns: [],
    saleReturnItems: [],
    stockAdjustments: [],
    expenses: [],
    auditLogs: [],
  };
}

function later(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function createSeed(): PharmacyDb {
  const db = emptyDb();
  const passwordHash = bcrypt.hashSync("admin123", 10);
  const adminId = newId();
  const createdAt = nowIso();

  db.users = [
    { id: adminId, name: "Hasan Ali", email: "admin@pharmacy.local", passwordHash, role: "ADMIN", isActive: true, createdAt, updatedAt: createdAt },
    { id: newId(), name: "Ayesha Khan", email: "pharmacist@pharmacy.local", passwordHash, role: "PHARMACIST", isActive: true, createdAt, updatedAt: createdAt },
    { id: newId(), name: "Bilal Ahmed", email: "cashier@pharmacy.local", passwordHash, role: "CASHIER", isActive: true, createdAt, updatedAt: createdAt },
  ];

  db.storeSettings = [{
    id: newId(),
    name: "Noor Pharmacy",
    tagline: "Your health, our care",
    address: "Shop 12, Main Road, Kabul",
    phone: "+93 700 123456",
    email: "shop@noorpharmacy.local",
    licenseNo: "PH-KBL-2026-014",
    taxId: "3277876-1",
    currency: "AFN",
    currencySymbol: "؋",
    taxName: "Tax",
    taxPercent: 0,
    invoicePrefix: "INV",
    purchasePrefix: "PO",
    receiptFooter: "Get well soon. Please keep this receipt for returns within 3 days.",
  }];

  db.locations = [
    { id: newId(), name: "Main shelf", address: "Front of shop" },
    { id: newId(), name: "Fridge", address: "Cold room" },
    { id: newId(), name: "Store room", address: "Back room" },
  ];

  const antibiotic = { id: newId(), name: "Antibiotics" };
  const pain = { id: newId(), name: "Pain Relief" };
  const otc = { id: newId(), name: "OTC / Flu" };
  const chronic = { id: newId(), name: "Chronic Care" };
  const syrup = { id: newId(), name: "Syrups & Drops" };
  db.categories = [antibiotic, pain, otc, chronic, syrup];

  const med = (
    sku: string,
    barcode: string,
    brandName: string,
    genericName: string,
    strength: string,
    form: string,
    packSize: string,
    manufacturer: string,
    salePrice: number,
    purchasePrice: number,
    reorderLevel: number,
    categoryId: string
  ) => ({
    id: newId(),
    sku,
    barcode,
    brandName,
    genericName,
    strength,
    form,
    packSize,
    manufacturer,
    salePrice,
    purchasePrice,
    taxPercent: 0,
    reorderLevel,
    isControlled: false,
    isActive: true,
    categoryId,
    createdAt,
    updatedAt: createdAt,
  });

  const medicines = [
    med("MED-001", "890123456001", "Augmentin", "Amoxicillin + Clavulanate", "625 mg", "Tablet", "Strip of 6", "GSK", 380, 290, 20, antibiotic.id),
    med("MED-002", "890123456002", "Panadol Extra", "Paracetamol + Caffeine", "500 mg", "Tablet", "Strip of 10", "GSK", 45, 28, 40, pain.id),
    med("MED-003", "890123456003", "Brufen", "Ibuprofen", "400 mg", "Tablet", "Strip of 10", "Abbott", 95, 62, 25, pain.id),
    med("MED-004", "890123456004", "Rigix", "Cetirizine", "10 mg", "Tablet", "Strip of 10", "Getz", 85, 52, 20, otc.id),
    med("MED-005", "890123456005", "Risek", "Omeprazole", "20 mg", "Capsule", "Strip of 14", "Getz", 220, 150, 15, chronic.id),
    med("MED-006", "890123456006", "Glucophage", "Metformin", "500 mg", "Tablet", "Strip of 10", "Martin Dow", 70, 42, 30, chronic.id),
    med("MED-007", "890123456007", "Calpol", "Paracetamol", "120 mg/5ml", "Syrup", "60 ml", "GSK", 165, 110, 12, syrup.id),
    med("MED-008", "890123456008", "Flagyl", "Metronidazole", "400 mg", "Tablet", "Strip of 10", "Sanofi", 120, 78, 18, antibiotic.id),
  ];
  db.medicines = medicines;

  const batch = (medicineId: string, batchNo: string, days: number, quantity: number, costPrice: number) => ({
    id: newId(),
    medicineId,
    batchNo,
    expiryDate: later(days),
    quantity,
    costPrice,
    location: "Main shelf",
    createdAt,
  });

  db.batches = [
    batch(medicines[0].id, "AUG-2401", 400, 48, 290),
    batch(medicines[1].id, "PND-1188", 18, 8, 28),
    batch(medicines[1].id, "PND-2210", 320, 90, 28),
    batch(medicines[2].id, "BRF-0902", 210, 36, 62),
    batch(medicines[3].id, "RGX-4411", 12, 6, 52),
    batch(medicines[4].id, "RSK-3301", 500, 22, 150),
    batch(medicines[5].id, "GLU-1022", 260, 4, 42),
    batch(medicines[6].id, "CLP-0771", 90, 16, 110),
    batch(medicines[7].id, "FLG-5510", -5, 5, 78),
  ];

  db.suppliers = [
    { id: newId(), name: "Macter International", phone: "042-111000111", email: "orders@macter.pk", address: "Ferozepur Road, Lahore", taxId: "", paymentTerms: "Net 15", isActive: true, createdAt },
    { id: newId(), name: "Getz Pharma Distributor", phone: "021-111111111", email: "sales@getzpharma.com", address: "Korangi, Karachi", taxId: "", paymentTerms: "Net 30", isActive: true, createdAt },
  ];

  db.customers = [
    { id: newId(), name: "Ali Raza", phone: "03001234567", address: "Johar Town", creditLimit: 5000, outstanding: 0, notes: "", createdAt },
    { id: newId(), name: "Sana Malik", phone: "03219876543", address: "Model Town", creditLimit: 0, outstanding: 0, notes: "", createdAt },
  ];

  return db;
}

function normalizeDb(raw: any): PharmacyDb {
  const base = emptyDb();
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base) as (keyof PharmacyDb)[]) {
    base[key] = Array.isArray(raw[key]) ? raw[key] : [];
  }
  return base;
}

export function loadDb(): PharmacyDb {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    const seeded = createSeed();
    saveDb(seeded);
    return seeded;
  }
  try {
    return normalizeDb(JSON.parse(fs.readFileSync(STORE_FILE, "utf8")));
  } catch {
    if (fs.existsSync(STORE_BAK)) {
      try {
        return normalizeDb(JSON.parse(fs.readFileSync(STORE_BAK, "utf8")));
      } catch {
        // fall through
      }
    }
    const seeded = createSeed();
    saveDb(seeded);
    return seeded;
  }
}

export function saveDb(db: PharmacyDb) {
  if (!db || typeof db !== "object") throw new Error("Pharmacy data is not valid.");
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(STORE_FILE)) {
    try {
      fs.copyFileSync(STORE_FILE, STORE_BAK);
    } catch {
      // keep going even if backup fails
    }
  }
  fs.writeFileSync(STORE_FILE, JSON.stringify(db, null, 2));
  return db;
}

export function withDb<T>(fn: (db: PharmacyDb) => T): T {
  const db = loadDb();
  const result = fn(db);
  saveDb(db);
  return result;
}

export function stockOf(db: PharmacyDb, medicineId: string) {
  return db.batches.filter((b) => b.medicineId === medicineId).reduce((sum, b) => sum + Number(b.quantity || 0), 0);
}

export function withMedicine(db: PharmacyDb, medicine: any, lite = false) {
  let batches = db.batches.filter((b) => b.medicineId === medicine.id);
  batches.sort((a, b) => +new Date(a.expiryDate) - +new Date(b.expiryDate));
  if (lite) batches = batches.filter((b) => Number(b.quantity) > 0).slice(0, 4);
  return {
    ...medicine,
    category: db.categories.find((c) => c.id === medicine.categoryId) || null,
    batches,
    stock: stockOf(db, medicine.id),
  };
}

export function withSale(db: PharmacyDb, sale: any, detail = false) {
  const customer = sale.customerId ? db.customers.find((c) => c.id === sale.customerId) || null : null;
  const user = db.users.find((u) => u.id === sale.createdById);
  const items = db.saleItems
    .filter((i) => i.saleId === sale.id)
    .map((item) => ({
      ...item,
      medicine: db.medicines.find((m) => m.id === item.medicineId) || null,
      batch: db.batches.find((b) => b.id === item.batchId) || null,
    }));
  return {
    ...sale,
    customer: detail ? customer : customer ? { id: customer.id, name: customer.name } : null,
    createdBy: { name: user?.name || "" },
    items,
    returns: detail ? db.saleReturns.filter((r) => r.saleId === sale.id) : undefined,
  };
}

export function withPurchase(db: PharmacyDb, purchase: any) {
  const supplier = db.suppliers.find((s) => s.id === purchase.supplierId) || null;
  const user = db.users.find((u) => u.id === purchase.createdById);
  const items = db.purchaseItems
    .filter((i) => i.purchaseId === purchase.id)
    .map((item) => ({
      ...item,
      medicine: db.medicines.find((m) => m.id === item.medicineId) || null,
    }));
  return { ...purchase, supplier, createdBy: { name: user?.name || "" }, items };
}

export function withCustomer(db: PharmacyDb, customer: any) {
  const sales = db.sales.filter((s) => s.customerId === customer.id);
  const loanSales = sales.filter((sale) => sale.paymentMethod === "CREDIT" && sale.status !== "VOID" && sale.status !== "RETURNED");
  const paidLoan = loanSales.reduce((sum, sale) => sum + Number(sale.paid || 0), 0);
  const remaining = Number(customer.outstanding || 0);
  return {
    ...customer,
    outstanding: remaining,
    paidToUs: paidLoan,
    paidLoan,
    remaining,
    totalLoan: paidLoan + remaining,
    _count: { sales: sales.length },
  };
}
