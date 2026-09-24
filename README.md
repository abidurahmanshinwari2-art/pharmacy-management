# Pharmacy Management System

Offline pharmacy shop for one computer: sales, stock, purchases, customers, loan, reports.

Same use as the store system. **Only Node.js** is needed. There is no PostgreSQL.

## Open on this PC

1. Install **Node.js**.
2. Double-click `start-pharmacy.bat`.
3. The first time, a Desktop icon **Pharmacy Management System** is created.
4. Enter the pharmacy name and license key.

Shop data is saved in `pharmacy-data` on that computer.

## Put it on another computer

1. Copy the whole project folder (USB), or download it from GitHub.
2. Install **Node.js** on that computer. Nothing else.
3. Double-click `start-pharmacy.bat`.
4. Enter the same pharmacy name and the same license key.

## License key (you, the owner)

On your computer run `make-license.bat`. Write the pharmacy name exactly. The key is also saved on the Desktop as `pharmacy-license.txt`. Give that same name and key to each shop PC.

## Login after license

- Email: `admin@pharmacy.local`
- Password: `admin123`

## Backup

Settings → **Save backup**. The file is saved on the Desktop and in `pharmacy-data/backups`.

Settings → **Load backup** on another computer to copy the shop data.

## Update

Settings → **Update now**, or run `update-pharmacy.bat`. Shop data in `pharmacy-data` is not replaced.

## GitHub

https://github.com/abidurahmanshinwari2-art/pharmacy-management
