# Pharmacy Management System

Offline pharmacy ERP for one shop: sales, stock, purchases, customers, loan, reports.

## Open on this PC

1. Install **Node.js** and **PostgreSQL**.
2. Copy `backend/.env.example` to `backend/.env` and set the database URL.
3. In `backend`: `npx prisma db push` then `npm run db:seed` (first time).
4. Double-click `start-pharmacy.bat`.
5. The first screen asks for the **pharmacy name** and **license key**.

## License key (you, the owner)

On your computer run `make-license.bat`.

Write the pharmacy name exactly as the shop will type it. Example:

```
Pharmacy: Noor Pharmacy
Key:      PMS-XXXX-XXXX-XXXX-XXXX
```

Give that same name and key to each computer for that shop.

## Put it on another computer

1. Copy the whole project folder (USB or disk).
2. Install Node.js and PostgreSQL there.
3. Create the database and set `backend/.env`.
4. Run `start-pharmacy.bat`.
5. Enter the pharmacy name and license key.
6. Shop data stays on that computer unless you load a backup.

## Backup

Settings → **Save backup**. The file is saved on the Desktop and in `pharmacy-data/backups`. Copy it to USB.

Settings → **Load backup** to put that file onto another computer.

## GitHub

https://github.com/abidurahmanshinwari2-art/pharmacy-management

## Update

Settings → **Update now**, or run `update-pharmacy.bat`. Shop data in `pharmacy-data` and the PostgreSQL database are not replaced.

## Login after license

- Email: `admin@pharmacy.local`
- Password: `admin123`
