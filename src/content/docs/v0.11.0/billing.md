---
title: MSP billing
version: v0.11.0
order: 29
since: v0.11.0
summary: MSP mode — customer companies, rate cards with after-hours / weekend multipliers and per-work-type / per-tech overrides, bill types (hourly, prepaid block, covered, non-billable), contracts, prepaid block alerts, the approval queue, and utilization.
---

## MSP mode

Billing is off by default. Turn it on with **Admin → Branding → Customer companies (MSP mode)** (`enable_customer_companies`). Admins also get the same switch on the internal company's page under **Admin → Companies**. Turning it off hides customer companies and billing settings; nothing is deleted.

With MSP mode on:

- Companies gain the `customer` kind, with **Contacts / Locations / Projects / Billing** tabs.
- **Admin → Time tracking** shows Billable hours, Rate cards, Bill types and Timesheets & utilization.
- **Time → Approvals** appears for Admin / Manager.
- Ticket time panels show who the ticket bills to and, for Admin / Manager, rates and amounts.

Billable-hours rules (rounding, minimums, approval, currency, re-pricing) are covered in the time tracking doc. Money is held in integer cents.

All `/api/billing/*` routes are Admin / Manager. Rate cards and bill types are read by both but written by Admin only; contracts can be managed by either.

---

## Pricing pipeline

Per customer:

1. **Billable units** — per ticket, each billable entry's session minutes after rounding and the session minimum, plus any ticket-minimum top-ups.
2. **Pricing** — each unit, in time order, under the contract in force on its date:

| Bill type behavior | Pricing |
|---|---|
| `hourly` — *Hourly (time & materials)* | Billable minutes × rate. |
| `prepaid_block` — *Prepaid block* | Minutes draw down the contract's block (per term or per month); the rest bills as overage at the rate. |
| `covered` — *Covered (managed / flat fee)* | Tracked and counted, billed at $0. |
| `non_billable` — *Non-billable* | Nothing on the contract is billable. |

A customer with no contract in force bills hourly at the default rate card.

---

## Rate cards

**Admin → Time tracking → Rate cards.** What an hour of billable time costs, in the billing currency.

| Field | Notes |
|---|---|
| Name, hourly rate | Base rate. |
| After-hours multiplier | 0–10, default 1. Time that starts outside the ticket's business hours. |
| Weekend multiplier | 0–10, default 1. Time on a non-working day or a whole-day holiday. |
| Default | One card is the default; the first card created becomes it. Customers without a contract card use it. |

**Overrides** on a card price a work type, a tech, or a tech doing a work type. The most specific match wins: tech + work type → work type → tech → card base rate.

Hours classes come from the business-hours policy: a day outside its days, or a whole-day holiday, is *weekend*; outside its window, or after an early-close holiday's closing time, is *after hours*. Without a business-hours policy, Saturday and Sunday are weekend and nothing is after hours.

---

## Bill types

**Admin → Time tracking → Bill types.** The kinds of agreement a customer can be on. Each has a name, one of the four behaviors above, and an optional **External code** (an item or account code in your accounting system) that rides along on exports. Deleting a bill type or rate card that a contract uses retires it instead; a retired bill type can't be picked for new contracts.

---

## Customers, projects and contracts

A customer company is linked to the projects it owns under **Admin → Companies → {customer} → Projects** (`company_projects`).

A ticket bills to:

1. `tickets.billing_company_id` when set — **Bills to → Customer** on the ticket's time panel (Admin / Manager, `PUT /api/tickets/:id/billing-customer`), or
2. the one customer its project is linked to.

A project linked to several customers needs the ticket-level pick. A project linked to none shows *This ticket's project isn't linked to a customer*.

**Contracts** live on **Admin → Companies → {customer} → Billing**:

| Field | Notes |
|---|---|
| Name | e.g. *2026 managed services*. |
| Bill type | Required. |
| Rate card | Optional; blank = **Default card**. |
| Starts on / Ends on | Ends blank = open-ended. |
| Block hours | Required for a prepaid block. |
| Block period | **Never — one block for the whole term** (`term`) or **Every month** (`monthly`). |
| External ref | Accounting contact / contract id, carried on exports. |
| Notes, Active | |

The contract in force on a date is the active one that has started and not ended; when terms overlap, the latest start wins. The list marks it **In force** and shows block usage for prepaid blocks.

---

## Prepaid block alerts

Set **Admin → Time tracking → Prepaid block alert → Warn at N % used** (default 80; 0 = only when used up).

Admins and Managers get one notification per contract, per block period, per level:

- **Threshold** — the block reached the alert percentage.
- **Exhausted** — the block is used up; further time bills as overage.

Crossing both at once sends only the stronger one. Blocks are checked every 30 minutes and right after time is logged on one of the customer's tickets. Sent alerts are recorded in `contract_block_alerts`.

---

## Approval queue

With **Billable time needs Admin/Manager approval** on, billable time waits for sign-off before export. Approved time locks for techs; invoiced time can't be approved or un-approved. Review it under **Time → Approvals** (see the time tracking doc), or per ticket from its time panel.

---

## Utilization

**Admin → Time tracking → Timesheets & utilization**, defaulting to last week (range up to one year). Per tech: entries, time logged, billable and non-billable minutes, utilization (billable ÷ logged), and the billed amount after rates and contracts.

---

## Export

**Admin → Time tracking → Export time.** In MSP mode each row also carries the customer, contract and its external ref, bill type and its external code, rate, coverage and amount, ready to pass to an accounting system. Optionally limited to approved time.

---

## Endpoints

```
GET/POST              /api/billing/rate-cards                     — writes Admin
PATCH/DELETE          /api/billing/rate-cards/:id
PUT                   /api/billing/rate-cards/:id/rates           — set an override
DELETE                /api/billing/rate-cards/:id/rates/:rateId
GET/POST              /api/billing/types                          — writes Admin
PATCH/DELETE          /api/billing/types/:id
GET/POST              /api/billing/companies/:companyId/contracts
PATCH/DELETE          /api/billing/companies/:companyId/contracts/:id
GET/POST              /api/billing/approvals
GET                   /api/billing/report/utilisation             — ?from= ?to=
PUT                   /api/tickets/:id/billing-customer
```
