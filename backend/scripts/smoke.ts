import "dotenv/config";

async function main() {
  const health = await fetch("http://localhost:4000/api/health");
  const healthJson = await health.json();
  console.log("health", health.status, healthJson);

  const login = await fetch("http://localhost:4000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.SMOKE_EMAIL,
      password: process.env.SMOKE_PASSWORD,
    }),
  });
  const loginJson = await login.json();
  console.log("login", login.status, loginJson.user?.role || loginJson.message);

  if (!loginJson.token) process.exit(1);

  const dashboard = await fetch("http://localhost:4000/api/reports/dashboard", {
    headers: { Authorization: `Bearer ${loginJson.token}` },
  });
  const dash = await dashboard.json();
  console.log("dashboard", dashboard.status, {
    todayBills: dash.todayBills,
    medicines: dash.medicineCount,
    customers: dash.customerCount,
  });

  const medicines = await fetch("http://localhost:4000/api/catalog/medicines", {
    headers: { Authorization: `Bearer ${loginJson.token}` },
  });
  const meds = await medicines.json();
  console.log("medicines", medicines.status, meds.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
