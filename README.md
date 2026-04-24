# Crown Cars Ltd — Account Management System

School route transport management for WSCC contracts.

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173

## Features

- **Dashboard** — Monthly KPIs: invoiced, received, outstanding, staff costs, net profit, VAT
- **Routes** — Manage school routes with assigned drivers, PA, daily rate, PO number
- **Invoices** — Bulk drag-and-drop PDF import. Parses invoice number, route, days, unit price, net, VAT, total automatically
- **Remittances** — Upload WSCC remittance advice PDF → auto-reconciles matching invoices
- **Staff** — Driver and PA profiles with bank details
- **Staff Payments** — Log regular, advance and partial payments with month attribution
- **Reports** — Annual P&L, quarterly VAT summary, per-route profitability, staff cost breakdown

## PDF parsing

### Invoice PDFs (your invoices to WSCC)
Drop one or many invoice PDFs on the Invoices page. The system extracts:
- Invoice number, date, PO number
- Route number and name
- Days worked, unit price, net total, VAT, total

### Remittance PDFs (WSCC payment advice)
Upload on the Remittances page. Extracts invoice numbers and amounts, then automatically marks matched invoices as paid/partial.

## Data storage

Currently uses `localStorage` (browser storage). Data persists in the browser only.

**Planned:** Supabase backend with login, cloud storage, and multi-device access.

## Project structure

```
src/
├── context/AppContext.jsx   # Global state (routes, invoices, staff, payments, remittances)
├── lib/
│   ├── pdfParser.js         # Invoice + remittance PDF parsers (PDF.js)
│   └── utils.js             # Formatters and constants
├── components/
│   ├── Layout.jsx           # Sidebar + navigation
│   ├── Modal.jsx            # Modal with portal rendering
│   ├── Badge.jsx            # Status badges
│   ├── MetricCard.jsx       # KPI cards
│   ├── EmptyState.jsx       # Empty state component
│   └── DropZone.jsx         # Drag-and-drop PDF upload
└── pages/
    ├── Dashboard.jsx
    ├── Routes.jsx
    ├── Invoices.jsx
    ├── Remittances.jsx
    ├── Staff.jsx
    ├── Payments.jsx
    └── Reports.jsx
```

## GitHub Pages deployment

```bash
npm run build
# Push dist/ to gh-pages branch, or use Netlify/Vercel for automatic deploys
```
