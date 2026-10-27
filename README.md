# Pharmacy Management System

Offline pharmacy shop. **Only Node.js** is needed. There is no PostgreSQL. Internet is not needed after Node.js and the first package install.

## Open on the main shop PC

1. Install **Node.js**.
2. Double-click `start-pharmacy.bat`.
3. Enter the pharmacy name and license key.

Shop data is saved in `pharmacy-data` on this computer.

## Second PC in the same pharmacy (shared data)

Use **one license** for the shop. Do not start a second shop database.

1. Keep the **main shop PC** open.
2. On the second PC, install Node.js, copy the same program folder.
3. Double-click `join-pharmacy.bat`.
4. Type the address shown in Settings on the main PC, for example `192.168.1.20`.
5. Open **Pharmacy Management System**. This PC uses the main shop stock and bills.
6. Both PCs can sell at the same time. Login with cashier on one PC and manager/admin on the other.

The two computers must be on the same shop Wi-Fi or cable.

## License key (you, the owner)

On your computer run `make-license.bat`. Write the pharmacy name exactly. The key is also saved on the Desktop as `pharmacy-license.txt`.

## Login

| Who | Email | Password |
| --- | --- | --- |
| Admin / main | `admin@pharmacy.local` | `admin123` |
| Manager | `manager@pharmacy.local` | `admin123` |
| Cashier | `cashier@pharmacy.local` | `admin123` |
| Pharmacist | `pharmacist@pharmacy.local` | `admin123` |

## Backup

Settings → **Save backup**. The file is saved on the Desktop and in `pharmacy-data/backups`.

## Update

Settings → **Update now**, or run `update-pharmacy.bat`. Shop data in `pharmacy-data` is not replaced.

## GitHub

https://github.com/abidurahmanshinwari2-art/pharmacy-management
