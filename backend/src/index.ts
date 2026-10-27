import express from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { settingsRouter } from "./routes/settings";
import { catalogRouter } from "./routes/catalog";
import { inventoryRouter } from "./routes/inventory";
import { suppliersRouter } from "./routes/suppliers";
import { customersRouter } from "./routes/customers";
import { purchasesRouter } from "./routes/purchases";
import { salesRouter } from "./routes/sales";
import { reportsRouter } from "./routes/reports";
import { expensesRouter } from "./routes/expenses";
import { systemRouter } from "./routes/system";
import { licenseStatus } from "./lib/license";
import { APP_ROOT, DATA_DIR, appConfig } from "./lib/appPaths";
import { lanUrls } from "./lib/lan";

const app = express();
app.use(cors());
app.use(express.json({ limit: "80mb" }));

app.use((req, res, next) => {
  if (!req.path.startsWith("/api")) return next();
  const open = new Set([
    "/api/health",
    "/api/license",
    "/api/settings/public",
    "/api/update",
    "/api/update/apply",
  ]);
  if (open.has(req.path)) return next();
  if (licenseStatus().licensed) return next();
  return res.status(403).json({ message: "Enter the license key first.", needLicense: true });
});

app.use("/api", systemRouter);
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/settings", settingsRouter);
app.use("/api/catalog", catalogRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/purchases", purchasesRouter);
app.use("/api/suppliers", suppliersRouter);
app.use("/api/customers", customersRouter);
app.use("/api/sales", salesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/expenses", expensesRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: "Something went wrong on the server." });
});

const dist = path.join(APP_ROOT, "frontend", "dist");
if (fs.existsSync(path.join(dist, "index.html"))) {
  app.use(express.static(dist));
  app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(dist, "index.html"));
  });
}

const port = Number(process.env.PORT || appConfig().port || 4050);
app.listen(port, "0.0.0.0", () => {
  console.log(`Pharmacy is open on http://localhost:${port}`);
  for (const url of lanUrls(port)) {
    console.log(`Other PC in this shop: ${url}`);
  }
  console.log(`Shop data is saved in ${DATA_DIR}`);
  console.log("This PC can work offline. Keep this window open if another PC is selling.");
});
