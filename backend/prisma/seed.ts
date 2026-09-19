import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.saleReturnItem.deleteMany();
  await prisma.saleReturn.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.stockAdjustment.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.medicine.deleteMany();
  await prisma.category.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.location.deleteMany();
  await prisma.storeSetting.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: { name: "Hasan Ali", email: "admin@pharmacy.local", passwordHash: password, role: "ADMIN" },
  });
  await prisma.user.create({
    data: { name: "Ayesha Khan", email: "pharmacist@pharmacy.local", passwordHash: password, role: "PHARMACIST" },
  });
  await prisma.user.create({
    data: { name: "Bilal Ahmed", email: "cashier@pharmacy.local", passwordHash: password, role: "CASHIER" },
  });

  await prisma.storeSetting.create({
    data: {
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
    },
  });
  await prisma.location.createMany({
    data: [
      { name: "Main shelf", address: "Front of shop" },
      { name: "Fridge", address: "Cold room" },
      { name: "Store room", address: "Back room" },
    ],
  });

  const [antibiotic, pain, otc, chronic, syrup] = await Promise.all([
    prisma.category.create({ data: { name: "Antibiotics" } }),
    prisma.category.create({ data: { name: "Pain Relief" } }),
    prisma.category.create({ data: { name: "OTC / Flu" } }),
    prisma.category.create({ data: { name: "Chronic Care" } }),
    prisma.category.create({ data: { name: "Syrups & Drops" } }),
  ]);

  const medicines = await Promise.all([
    prisma.medicine.create({
      data: {
        sku: "MED-001",
        barcode: "890123456001",
        brandName: "Augmentin",
        genericName: "Amoxicillin + Clavulanate",
        strength: "625 mg",
        form: "Tablet",
        packSize: "Strip of 6",
        manufacturer: "GSK",
        salePrice: 380,
        purchasePrice: 290,
        reorderLevel: 20,
        categoryId: antibiotic.id,
      },
    }),
    prisma.medicine.create({
      data: {
        sku: "MED-002",
        barcode: "890123456002",
        brandName: "Panadol Extra",
        genericName: "Paracetamol + Caffeine",
        strength: "500 mg",
        form: "Tablet",
        packSize: "Strip of 10",
        manufacturer: "GSK",
        salePrice: 45,
        purchasePrice: 28,
        reorderLevel: 40,
        categoryId: pain.id,
      },
    }),
    prisma.medicine.create({
      data: {
        sku: "MED-003",
        barcode: "890123456003",
        brandName: "Brufen",
        genericName: "Ibuprofen",
        strength: "400 mg",
        form: "Tablet",
        packSize: "Strip of 10",
        manufacturer: "Abbott",
        salePrice: 95,
        purchasePrice: 62,
        reorderLevel: 25,
        categoryId: pain.id,
      },
    }),
    prisma.medicine.create({
      data: {
        sku: "MED-004",
        barcode: "890123456004",
        brandName: "Rigix",
        genericName: "Cetirizine",
        strength: "10 mg",
        form: "Tablet",
        packSize: "Strip of 10",
        manufacturer: "Getz",
        salePrice: 85,
        purchasePrice: 52,
        reorderLevel: 20,
        categoryId: otc.id,
      },
    }),
    prisma.medicine.create({
      data: {
        sku: "MED-005",
        barcode: "890123456005",
        brandName: "Risek",
        genericName: "Omeprazole",
        strength: "20 mg",
        form: "Capsule",
        packSize: "Strip of 14",
        manufacturer: "Getz",
        salePrice: 220,
        purchasePrice: 150,
        reorderLevel: 15,
        categoryId: chronic.id,
      },
    }),
    prisma.medicine.create({
      data: {
        sku: "MED-006",
        barcode: "890123456006",
        brandName: "Glucophage",
        genericName: "Metformin",
        strength: "500 mg",
        form: "Tablet",
        packSize: "Strip of 10",
        manufacturer: "Martin Dow",
        salePrice: 70,
        purchasePrice: 42,
        reorderLevel: 30,
        categoryId: chronic.id,
      },
    }),
    prisma.medicine.create({
      data: {
        sku: "MED-007",
        barcode: "890123456007",
        brandName: "Calpol",
        genericName: "Paracetamol",
        strength: "120 mg/5ml",
        form: "Syrup",
        packSize: "60 ml",
        manufacturer: "GSK",
        salePrice: 165,
        purchasePrice: 110,
        reorderLevel: 12,
        categoryId: syrup.id,
      },
    }),
    prisma.medicine.create({
      data: {
        sku: "MED-008",
        barcode: "890123456008",
        brandName: "Flagyl",
        genericName: "Metronidazole",
        strength: "400 mg",
        form: "Tablet",
        packSize: "Strip of 10",
        manufacturer: "Sanofi",
        salePrice: 120,
        purchasePrice: 78,
        reorderLevel: 18,
        isControlled: false,
        categoryId: antibiotic.id,
      },
    }),
  ]);

  const later = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  };

  await prisma.batch.createMany({
    data: [
      { medicineId: medicines[0].id, batchNo: "AUG-2401", expiryDate: later(400), quantity: 48, costPrice: 290 },
      { medicineId: medicines[1].id, batchNo: "PND-1188", expiryDate: later(18), quantity: 8, costPrice: 28 },
      { medicineId: medicines[1].id, batchNo: "PND-2210", expiryDate: later(320), quantity: 90, costPrice: 28 },
      { medicineId: medicines[2].id, batchNo: "BRF-0902", expiryDate: later(210), quantity: 36, costPrice: 62 },
      { medicineId: medicines[3].id, batchNo: "RGX-4411", expiryDate: later(12), quantity: 6, costPrice: 52 },
      { medicineId: medicines[4].id, batchNo: "RSK-3301", expiryDate: later(500), quantity: 22, costPrice: 150 },
      { medicineId: medicines[5].id, batchNo: "GLU-1022", expiryDate: later(260), quantity: 4, costPrice: 42 },
      { medicineId: medicines[6].id, batchNo: "CLP-0771", expiryDate: later(90), quantity: 16, costPrice: 110 },
      { medicineId: medicines[7].id, batchNo: "FLG-5510", expiryDate: later(-5), quantity: 5, costPrice: 78 },
    ],
  });

  const supplier = await prisma.supplier.create({
    data: {
      name: "Macter International",
      phone: "042-111000111",
      email: "orders@macter.pk",
      address: "Ferozepur Road, Lahore",
      paymentTerms: "Net 15",
    },
  });
  await prisma.supplier.create({
    data: {
      name: "Getz Pharma Distributor",
      phone: "021-111111111",
      email: "sales@getzpharma.com",
      address: "Korangi, Karachi",
      paymentTerms: "Net 30",
    },
  });

  const customer = await prisma.customer.create({
    data: {
      name: "Ali Raza",
      phone: "03001234567",
      address: "Johar Town",
      creditLimit: 5000,
    },
  });
  await prisma.customer.create({
    data: { name: "Sana Malik", phone: "03219876543", address: "Model Town" },
  });

  const panadolBatch = await prisma.batch.findFirst({ where: { batchNo: "PND-2210" } });
  const risekBatch = await prisma.batch.findFirst({ where: { batchNo: "RSK-3301" } });

  if (panadolBatch && risekBatch) {
    await prisma.sale.create({
      data: {
        invoiceNo: "INV-20260912-0001",
        customerId: customer.id,
        type: "WALK_IN",
        subtotal: 310,
        discount: 10,
        tax: 0,
        total: 300,
        paid: 300,
        paymentMethod: "CASH",
        createdById: admin.id,
        items: {
          create: [
            {
              medicineId: medicines[1].id,
              batchId: panadolBatch.id,
              quantity: 2,
              unitPrice: 45,
              lineTotal: 90,
              costPrice: 28,
            },
            {
              medicineId: medicines[4].id,
              batchId: risekBatch.id,
              quantity: 1,
              unitPrice: 220,
              lineTotal: 220,
              costPrice: 150,
            },
          ],
        },
      },
    });

    await prisma.batch.update({ where: { id: panadolBatch.id }, data: { quantity: { decrement: 2 } } });
    await prisma.batch.update({ where: { id: risekBatch.id }, data: { quantity: { decrement: 1 } } });
  }

  await prisma.purchase.create({
    data: {
      invoiceNo: "PO-20260910-0001",
      supplierId: supplier.id,
      subtotal: 5800,
      tax: 0,
      total: 5800,
      createdById: admin.id,
      items: {
        create: {
          medicineId: medicines[0].id,
          batchNo: "AUG-2401",
          expiryDate: later(400),
          quantity: 20,
          costPrice: 290,
          lineTotal: 5800,
        },
      },
    },
  });

  console.log("Seeded Noor Pharmacy demo data.");
  console.log("Login: admin@pharmacy.local / admin123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
