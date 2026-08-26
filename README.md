# MoneyMap

A front end for the budget spreadsheet you already keep — not a replacement for it.

The `.xlsx` stays the source of truth. MoneyMap reads it, charts it, and writes
back into it: new entries land in the real cell, inside the real formula, and
your charts and formulas survive untouched. Close the app and the spreadsheet is
still a spreadsheet.

It also mirrors a Trading 212 account and folds the dividends and interest it
finds into the same budget.

## How it works

A budget folder holds one `.xlsx` per year, with the year in the filename
(`2026.xlsx`). On startup, everything in that folder is imported and verified to
the cent against the sheet — if a single monthly total disagrees, the import is
refused rather than half-applied.

Writing back is surgical. The sheet's XML is patched in place, so a cell that
reads `=42.88+11.39` becomes `=42.88+11.39+12.50` and the two charts in the
workbook are left exactly as they were. Each amount can carry a label, stored as
`N("Groceries")` inside the formula — `N()` of text is worth zero in both Excel
and LibreOffice, so the cell's total never changes, and the app can show you
what each parcel was.

If Excel has the file locked, the entry is queued instead of lost, and applied
the next time the file is free.

## Features

- Import a year's workbook by dropping it in, or point the app at a folder and
  let it pick up every year it finds
- Add income, savings and expense entries without opening Excel, each with an
  optional label
- A whole year at a glance: cashflow per month, cumulative totals, where the
  money went by group, and what stands out this month
- Month detail down to the individual parcels that make up each cell
- Compare years side by side
- Hide every amount and leave only the percentages, for when someone is looking
  over your shoulder
- Trading 212: holdings, daily portfolio snapshots, orders, dividends and cash
  flow, with dividends and interest bridged into the budget

## Not there yet

- Editing or deleting an entry already written to the sheet — that is still a
  trip to Excel
- Creating the workbook for a new year

## Stack

- **Frontend**: Next.js, React, Tailwind, Recharts
- **Backend**: Node.js, Express, Zod
- **Database**: PostgreSQL, via Prisma
- **Containers**: Docker Compose, for the database and the API

The frontend deliberately runs **outside** Docker: it is the only piece that
writes to the `.xlsx`, and the budget folder is a path on your machine that a
Linux container cannot reach.

## Setup

**1. Environment files.** Three of them, none committed:

`db.env` — the Postgres container:

```env
POSTGRES_USER=moneymap_user
POSTGRES_PASSWORD=...
POSTGRES_DB=moneymap
```

`backend/.env` — the API:

```env
DATABASE_URL="postgresql://moneymap_user:...@db:5432/moneymap"
ACCESS_SECRET=...
REFRESH_SECRET=...
FRONTEND_ORIGIN=http://localhost:3000
```

`frontend/.env.local` — the budget folder, kept server-side so the path never
reaches the browser:

```env
BUDGET_FOLDER=D:\budget
NEXT_PUBLIC_API_BASE=http://localhost:5000
```

**2. Database and API:**

```bash
docker compose up -d
```

The API container generates the Prisma client, pushes the schema and seeds on
start — no separate migration step.

**3. Frontend**, in its own terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open <http://localhost:3000>.

## Trading 212 (optional)

Leave `T212_API_KEY` unset and the investments page simply says it is not
configured; everything else works.

```env
T212_API_KEY=...
T212_ENV=live            # or demo
T212_USER_EMAIL=you@example.com
T212_SYNC_INTERVAL_HOURS=6
T212_BRIDGE_FROM=2026-09-01
```

`T212_BRIDGE_FROM` is a floor, not an override: nothing before that date is
written into the budget. The effective cutoff is the later of it and the last
month the spreadsheet already accounts for, so a month is never counted twice.

## Tests

```bash
cd backend  && npm test    # 298
cd frontend && npm test    # 214
```

Type checking is the other gate — `npx tsc --noEmit` in either folder. There is
no linter, on purpose.

## Contributing

Issues and pull requests are welcome.

## License

MIT.
