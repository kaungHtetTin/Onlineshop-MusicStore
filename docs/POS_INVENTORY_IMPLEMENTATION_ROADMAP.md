# POS, Role Permissions, and Multi-Location Inventory Roadmap

**Project:** Musical Store / LaLaPick  
**Last updated:** July 14, 2026  
**Document status:** Implementation in progress
**Target stack:** Laravel 9, MySQL, Inertia.js, React 18, MUI/admin UI kit

## 1. Goal

Extend the current ecommerce application into an operations system that supports:

1. Database-managed roles and permissions for Admin, Manager, Inventory Staff, and Sales.
2. A fast POS interface for in-store sales.
3. Stock tracking by location, starting with one warehouse and one store.
4. Warehouse/store stock import, receiving, stock adjustment, stock transfer, reservation, and stock history workflows.
5. Near real-time inventory updates across open admin and POS screens.
6. An interface that can grow to multiple warehouses and stores without changing the core data model.

## 2. Current Project Baseline

The project already provides a useful foundation:

- Staff CRUD at `/admin/users`.
- Hard-coded roles: `super_admin`, `manager`, `cashier`, and `support`.
- Per-user permissions stored as JSON on `users.permissions`.
- Products with multiple SKUs, barcodes, prices, costs, and one `skus.stock_qty` value.
- Ecommerce orders, order items, payments, payment review, cancellation, returns, and audit logs.
- Stock deduction when an online order payment is confirmed and stock restoration when applicable.
- Laravel broadcasting configuration and React Query are available, but inventory broadcasting is not implemented.
- Admin pages use the existing compact admin UI kit; storefront pages use MUI.

### Current gaps

- A SKU has one global quantity, so the system cannot distinguish warehouse stock from store stock.
- Stock changes are not recorded in a dedicated, immutable inventory ledger.
- Product editing can directly replace a SKU quantity without a stock reason or audit trail.
- Roles and permissions are defined in code, making custom roles difficult.
- Manager access is broadly allowed by middleware instead of being fully permission-driven.
- There is no POS, register shift, receipt, stock receiving, adjustment, or transfer workflow.
- There is no validated stock import for loading warehouse/store quantities and SKU prices in bulk.
- Online orders do not reserve a quantity while manual payment is waiting for review, which can allow overselling.
- The automated test baseline needs alignment with the current application behavior and XAMPP subdirectory URL before this larger change begins.

## 3. Business Naming and Assumptions

Use these names in the UI while migrating existing data safely:

| Requested role | Initial system mapping | Purpose |
| --- | --- | --- |
| Admin | Existing `super_admin` | System owner with all permissions |
| Manager | Existing `manager` | Runs locations, staff, inventory, POS, and reports |
| Inventory Staff | New role | Receives, counts, adjusts, and transfers inventory |
| Sales | Existing `cashier` | Uses POS and views stock at assigned stores |

The existing Support role should remain because it is used by customer chat. Roles will become database records, so more roles can be added later without code changes.

Initial operational assumptions:

- Create one `warehouse` location and one `store` location during setup.
- Every staff member can be assigned to one or more locations.
- Every POS register belongs to a store location.
- Online orders use a configured fulfillment location; they must not silently consume stock from every location.
- SKU quantities are whole numbers unless a future requirement introduces weight or length-based products.
- One import batch targets one location. Importing stock for both the warehouse and store requires separate, traceable batches.
- Base SKU prices are shared across locations by default. Location-specific price overrides are a future feature, not part of the initial stock import.
- MySQL is the source of truth. WebSocket messages only notify clients to refresh committed data.

## 4. Recommended Architecture

### 4.1 Database-driven RBAC

Replace role checks and JSON-only permissions with relational role and permission tables. Prefer a Laravel 9/PHP 8 compatible release of `spatie/laravel-permission`, or implement the equivalent schema if adding the package is not desired.

Required concepts:

- `roles`
- `permissions`
- user-to-role assignment
- role-to-permission assignment
- optional direct user permissions for rare exceptions
- location assignment kept separate from role assignment

Policies and permission middleware must enforce authorization on the backend. Hiding a menu item is only a UI convenience and is not authorization.

### 4.2 Location-aware stock

Move inventory ownership from `skus.stock_qty` to a balance per SKU and location.

```text
Product
  -> SKU
       -> Inventory Balance at Main Warehouse
       -> Inventory Balance at Downtown Store
       -> Inventory Movements (complete history)
```

Use two complementary records:

- `inventory_balances` is the fast current snapshot used by lists, availability checks, and POS.
- `inventory_movements` is the append-only ledger that explains every quantity change.

The balance must only be changed through an inventory domain service. Controllers, order services, seeders, and admin forms must not directly increment or decrement stock after migration.

### 4.3 One sale model

Reuse the existing `orders`, `order_items`, and `payments` as the canonical sales records. Add a sales channel and POS references instead of creating a second, disconnected sales system.

```text
Online checkout -> Order(channel=online) -> Inventory reservation/sale
POS checkout    -> Order(channel=pos)    -> Immediate payment and inventory sale
```

This keeps customer history, returns, finance, reporting, and SKU sales totals consistent.

### 4.4 Transaction and concurrency rules

Every stock-changing operation must:

1. Start a database transaction.
2. Lock affected `inventory_balances` rows with `lockForUpdate()` in a consistent order.
3. Validate available quantity and operation status.
4. Update the balance.
5. Append movement rows with before/after quantities and an idempotency key.
6. Commit the transaction.
7. Broadcast an inventory-changed event after commit.

This is necessary to prevent two POS terminals, an online checkout, and a transfer from selling or moving the same final item.

### 4.5 Stock import and pricing rules

The import workflow must be a controlled inventory operation, not a direct database replacement. A user selects the destination warehouse or store, uploads a file, reviews validation results, and explicitly posts the batch.

Use this pricing mapping:

| Import field | Application field | Meaning |
| --- | --- | --- |
| `original_price` | Existing `skus.market_price` | Reference/list price, often displayed as the crossed-out price |
| `retail_price` | Existing `skus.price` | Normal customer selling price used by storefront and POS |
| `wholesale_price` | New `skus.wholesale_price` | Base wholesale selling price for authorized wholesale sales |
| `cost` | Existing `skus.cost` | Optional acquisition cost used for margin and valuation reports |

The meaning of `original_price` must be confirmed in Phase 0. If the business uses "original price" to mean purchase cost, map it to `cost` instead and keep `market_price` as a separate optional list-price field.

Stock import rules:

- Default modes are `stock_receipt` (add quantity), `opening_balance` (initial setup only), and `price_only`.
- A normal import adds quantity; it never silently replaces an existing balance.
- A physical-count import that replaces the expected quantity must create a stock adjustment and require the normal approval workflow.
- Blank price cells preserve current values. A zero price is an explicit value and must not be treated as blank.
- Price changes require `pricing.manage`; quantity posting requires `inventory.import` and access to the selected location.
- The same SKU cannot appear twice in one import. Duplicate rows must be corrected during preview.
- Price conflicts are shown before posting because a SKU's base prices apply to every location.
- `retail_price`, `wholesale_price`, and `original_price` must be non-negative. Wholesale-above-retail or retail-above-original values should generate warnings and require confirmation rather than always being rejected.
- Posting creates inventory movements and a source receipt/adjustment document. It must never update only `inventory_balances`.
- Every posted row uses a batch/row idempotency key so retries cannot add the quantity twice.

## 5. Proposed Data Model

Names may be adjusted to match project conventions during implementation.

### 5.1 Access control

| Table | Important fields |
| --- | --- |
| `roles` | `id`, `name`, `display_name`, `is_system`, timestamps |
| `permissions` | `id`, `name`, `display_name`, `group`, timestamps |
| role/user pivots | Standard role and permission relationships |
| `location_user` | `location_id`, `user_id`, `is_default`, timestamps |

### 5.2 Locations and balances

| Table | Important fields |
| --- | --- |
| `locations` | `id`, `code`, `name`, `type` (`warehouse`/`store`), address, phone, timezone, `is_active`, `is_default_fulfillment` |
| `inventory_balances` | `location_id`, `sku_id`, `on_hand_qty`, `reserved_qty`, `reorder_point`, `par_level`, `version`, timestamps |
| `inventory_movements` | `location_id`, `sku_id`, `type`, signed `quantity_delta`, `balance_before`, `balance_after`, `reference_type`, `reference_id`, `reason_code`, notes, `created_by`, `occurred_at`, `idempotency_key` |

Constraints and indexes:

- Unique balance on `(location_id, sku_id)`.
- Unique location code.
- Unique movement idempotency key when provided.
- Index movements on `(location_id, sku_id, occurred_at)` and `(reference_type, reference_id)`.
- Quantities cannot become negative unless an explicit, Admin-only emergency policy is enabled.
- `available_qty` is calculated as `on_hand_qty - reserved_qty`; do not allow it to drift as a separately edited value.

### 5.3 Receiving and adjustments

| Table | Important fields |
| --- | --- |
| `stock_receipts` | receipt number, destination location, supplier/reference, status, received by, received at, notes |
| `stock_receipt_items` | receipt, SKU, expected quantity, received quantity, unit cost |
| `stock_adjustments` | adjustment number, location, reason, status, created/approved by, notes, posted at |
| `stock_adjustment_items` | adjustment, SKU, system quantity, counted quantity, quantity delta, item note |

Posted documents are immutable. Corrections are made by a reversal or a new correcting document, not by editing movement history.

### 5.4 Transfers

| Table | Important fields |
| --- | --- |
| `stock_transfers` | transfer number, source, destination, status, requested/approved/shipped/received by, timestamps, notes |
| `stock_transfer_items` | transfer, SKU, requested quantity, shipped quantity, received quantity, discrepancy reason |

Transfer statuses:

```text
draft -> submitted -> approved -> in_transit -> received
  |          |           |
  +----------+-----------+-> cancelled (before shipment only)
```

- Shipment removes on-hand quantity from the source and creates `transfer_out` movements.
- Receipt adds on-hand quantity to the destination and creates `transfer_in` movements.
- While in transit, quantities appear in a separate in-transit figure and are not sellable at either location.
- Short or damaged receipts require a discrepancy reason and manager approval.

### 5.5 POS

| Table/change | Important fields |
| --- | --- |
| `pos_registers` | store location, code, name, active status |
| `pos_shifts` | register, cashier, opened/closed at, opening cash, expected cash, counted cash, variance, status |
| `held_carts` | location, register, cashier, optional customer, cart payload, expiry |
| `orders` additions | nullable customer, `sales_channel`, `location_id`, `register_id`, `shift_id`, `served_by`, receipt number |
| `payments` additions | tender details needed for cash, card, mobile payment, and optional split payments |

Do not store completed POS transactions only in browser state. The final checkout must be atomic on the server.

### 5.6 Stock imports and wholesale pricing

Add `wholesale_price` as a nullable decimal field on `skus`. Keep prices global at SKU level in the first release. If different stores later require different prices, add a separate `location_sku_prices` table instead of duplicating SKUs.

| Table/change | Important fields |
| --- | --- |
| `skus` addition | nullable `wholesale_price` with the same currency precision as retail price |
| `inventory_imports` | batch number, location, mode, status, original filename, stored file path, total/valid/error/posted row counts, created/posted by, posted at |
| `inventory_import_rows` | import, row number, SKU, raw data, quantity, original/retail/wholesale price, cost, validation errors/warnings, status, movement/reference IDs, idempotency key |

Suggested batch statuses:

```text
uploaded -> validating -> ready -> posting -> completed
                 |          |          |
                 +----------+----------+-> failed
                            +------------> cancelled
```

Uploaded files must be stored outside the public directory, restricted by permission, and removed according to a configurable retention period. The system should retain normalized row data and posting references for audit purposes.

## 6. Permission Catalogue and Default Matrix

Permission names should describe actions rather than pages.

Legend: `Full` = all actions in the group, `Limited` = assigned location or approval limits, `View` = read only, `-` = denied by default.

| Permission group | Admin | Manager | Inventory Staff | Sales |
| --- | --- | --- | --- | --- |
| Roles and permissions | Full | - | - | - |
| Staff accounts | Full | Limited | - | - |
| Locations and registers | Full | Full | View | View assigned |
| Products and pricing | Full | Full | View | View |
| Inventory balances/history | Full | Full | Assigned locations | Assigned store |
| Import stock | Full | Full | Assigned locations | - |
| Receive stock | Full | Full | Assigned locations | - |
| Create adjustment | Full | Full | Assigned locations | - |
| Approve/post adjustment | Full | Full | Optional by policy | - |
| Create transfer | Full | Full | Assigned locations | - |
| Approve transfer | Full | Full | - | - |
| Ship/receive transfer | Full | Full | Assigned locations | - |
| POS access | Full | Full | - | Assigned store |
| POS discount | Full | Configurable limit | - | Configurable limit |
| Void/refund POS sale | Full | Full | - | Request only |
| Sales/inventory reports | Full | Full | Inventory only | Own shift only |
| Audit logs | Full | View | - | - |

Suggested permission keys:

```text
roles.manage
staff.view, staff.create, staff.update, staff.suspend
locations.view, locations.manage, registers.manage
catalog.view, catalog.manage, pricing.manage
inventory.view, inventory.history
inventory.import
inventory.receive, inventory.adjust.create, inventory.adjust.approve
inventory.transfer.create, inventory.transfer.approve
inventory.transfer.ship, inventory.transfer.receive
pos.access, pos.shift.open, pos.shift.close
pos.discount, pos.hold, pos.void, pos.refund
reports.sales, reports.inventory, audit.view
```

## 7. Inventory Rules

### Quantity definitions

- **On hand:** Physical quantity currently at the location.
- **Reserved:** On-hand quantity promised to open online orders.
- **Available:** `on hand - reserved`; the quantity allowed for a new sale or transfer.
- **In transit:** Quantity shipped from one location but not received at another.
- **Reorder point:** Threshold used to show low-stock warnings.

### Movement types

At minimum support:

```text
opening_balance
receipt
sale
sale_return
reservation
reservation_release
transfer_out
transfer_in
adjustment_gain
adjustment_loss
damage
write_off
reversal
```

Reservations can be represented with dedicated reservation records plus reservation movements. They change `reserved_qty`, not physical `on_hand_qty`, until the sale is confirmed.

### Online order allocation

- Each online order receives a fulfillment location when placed.
- Reserve stock at order creation, including orders waiting for manual payment review.
- On payment confirmation, convert the reservation into a sale movement and reduce on-hand quantity.
- On payment rejection, cancellation, or reservation expiry, release the reservation.
- A scheduled command should expire abandoned reservations using a configurable timeout.
- If the default store lacks stock, staff may transfer stock or explicitly reallocate the order. The system should not automatically take warehouse stock without an auditable action.

### POS allocation

- POS can sell only available stock at its register's store.
- Completing a paid POS order creates the order, payments, stock movements, and balance updates in one transaction.
- Returns create new positive inventory movements according to item condition; they never delete the original sale movement.

## 8. UX Plan

### 8.1 Inventory overview

Route: `/admin/inventory`

Primary interface:

- Location selector with Warehouse, Store, and All Locations options.
- Search by product name, SKU, or barcode.
- Filters for category, low stock, out of stock, active SKU, and location type.
- Columns: product/SKU, location, on hand, reserved, available, in transit, reorder point, last movement.
- A comparison mode that displays one column per selected location.
- Row actions for history, receive, adjust, and transfer, shown only when permitted.
- Pagination or server-side virtualized data; do not load the full catalogue into the browser.
- Auto-refresh indicator and a visible "last updated" timestamp.

The product form should manage product identity, variants, barcode, price, and cost. After inventory migration, it should no longer provide unrestricted stock quantity editing.

### 8.2 SKU stock detail

Route: `/admin/inventory/skus/{sku}`

- Summary by location.
- Movement timeline with type, quantity, before/after balance, user, document link, and timestamp.
- Date, type, user, and location filters.
- Links to the related receipt, transfer, adjustment, online order, or POS receipt.
- Export to CSV for authorized users.

### 8.3 Receiving

Route: `/admin/inventory/receipts/create`

- Select destination location and optional supplier/reference.
- Barcode scanning and keyboard-first SKU search.
- Editable received quantity and unit cost.
- Save draft, review, and post actions.
- Duplicate barcode warning and clear validation per row.

### 8.4 Warehouse/store stock import

Routes: `/admin/inventory/imports` and `/admin/inventory/imports/create`

- Select exactly one destination warehouse or store before uploading.
- Select import mode: Stock receipt, Opening balance, Price only, or Physical count adjustment.
- Provide downloadable CSV and XLSX templates.
- Required stock columns: `sku_code` or `barcode`, plus `quantity` for quantity-changing modes.
- Supported price columns: `original_price`, `retail_price`, `wholesale_price`, and optional `cost`.
- Optional columns: supplier/reference, reorder point, note, and product/SKU labels for human review.
- Match existing SKUs by SKU code first and barcode second. Do not create products or SKUs silently in the inventory import.
- Show a preview table with matched SKU, current location quantity, quantity to add/count, resulting quantity, current prices, new prices, warnings, and errors.
- Allow filtering preview rows by Valid, Warning, and Error.
- Require all blocking errors to be fixed before posting; offer an error file containing row number and reason.
- Confirm a summary of stock value and price changes before posting.
- Queue validation for large files and show progress without requiring the page to remain open.
- Display completed batches with document links, posted user, row counts, and downloadable result report.
- Do not provide an "undo" that deletes movements. Reversal creates a new receipt reversal or adjustment document.

Example template:

```csv
sku_code,barcode,quantity,original_price,retail_price,wholesale_price,cost,reorder_point,note
GTR-001,885000000001,20,350.00,320.00,285.00,230.00,5,Initial warehouse receipt
```

### 8.5 Adjustment/count

Route: `/admin/inventory/adjustments/create`

- Select location and mandatory reason.
- Show system on-hand quantity beside counted quantity.
- Calculate variance automatically.
- Require item notes for losses or damaged stock.
- Show a final impact summary before posting.
- Require manager approval above configurable quantity or value thresholds.

### 8.6 Transfer workspace

Routes: `/admin/inventory/transfers` and `/admin/inventory/transfers/{transfer}`

- Source and destination are required and cannot match.
- Show source available quantity while entering each line.
- Barcode-friendly item entry.
- Clear document status and action bar for submit, approve, ship, and receive.
- Timeline of staff actions.
- Receiving view compares requested, shipped, and received quantities and captures discrepancies.

### 8.7 POS interface

Route: `/admin/pos`

Use a full-height, work-focused interface:

- Top bar: location, register, cashier, shift status, connectivity, and current time.
- Product area: barcode input, search, category filter, compact products, stock at this store, and variant selection.
- Cart area: item list, quantity stepper, remove action, subtotal, discounts, tax, and total.
- Customer is optional; allow quick customer search or creation where permitted.
- Payment dialog: cash, card, mobile payment, amount tendered, change, and optional split payment.
- Hold/resume sale, clear cart, and print receipt actions.
- Keyboard shortcuts and scanner behavior implemented without visible tutorial text in the main workspace.
- Tablet and desktop are primary. Mobile should support basic sale completion but is not the main cashier layout.

## 9. Real-Time Update Design

Recommended first production option: Laravel Echo with Pusher or a Pusher-compatible Soketi server. Laravel Reverb should only be considered after a framework compatibility review or Laravel upgrade.

Events:

- `InventoryBalanceChanged`
- `StockTransferStatusChanged`
- `StockAdjustmentPosted`
- `PosSaleCompleted`

Channels:

```text
private-inventory.location.{locationId}
private-inventory.all                 # Admin/authorized managers only
private-pos.register.{registerId}
```

Client behavior:

1. Receive a small event containing location ID, SKU ID, balance version, and event time.
2. Update the affected React Query cache row or refetch the relevant query.
3. Ignore stale events whose version is older than the displayed balance.
4. Fall back to polling every 15-30 seconds if WebSocket connection is unavailable.
5. Display connection state without blocking POS checkout; the server still validates stock.

Do not send full product catalogues through broadcast events. Do not update stock based only on a browser event.

## 10. Service and Policy Boundaries

Suggested backend classes:

```text
app/Services/Inventory/InventoryService.php
app/Services/Inventory/StockReceiptService.php
app/Services/Inventory/StockImportService.php
app/Services/Inventory/StockAdjustmentService.php
app/Services/Inventory/StockTransferService.php
app/Services/Inventory/StockReservationService.php
app/Services/POS/PosCheckoutService.php
app/Services/POS/PosShiftService.php
app/Policies/LocationPolicy.php
app/Policies/StockTransferPolicy.php
app/Policies/StockAdjustmentPolicy.php
```

`InventoryService` should be the only normal entry point for balance mutations. It should expose intention-based methods such as `receive`, `reserve`, `releaseReservation`, `completeSale`, `adjust`, `shipTransfer`, and `receiveTransfer` rather than a public "set quantity" method.

Suggested frontend areas:

```text
resources/js/Pages/Admin/Inventory/Index.jsx
resources/js/Pages/Admin/Inventory/SkuShow.jsx
resources/js/Pages/Admin/Inventory/Receipts/*
resources/js/Pages/Admin/Inventory/Imports/*
resources/js/Pages/Admin/Inventory/Adjustments/*
resources/js/Pages/Admin/Inventory/Transfers/*
resources/js/Pages/Admin/POS/Index.jsx
resources/js/Components/Admin/Inventory/*
resources/js/Components/Admin/POS/*
```

## 11. Implementation Roadmap

Estimates assume one developer familiar with the current project. They are planning ranges, not delivery commitments.

### Phase 0 - Decisions and baseline repair (2-4 days)

**Status:** In progress
**Goal:** Make the project safe to extend and confirm business rules.

- [x] Confirm role display names and whether Support remains a separate role.
- [ ] Confirm opening quantities should be assigned to the initial store or warehouse.
- [ ] Confirm whether "original price" means reference/list price or acquisition cost; the proposed mapping is reference/list price.
- [x] Use one base SKU wholesale price in the first release; quantity tiers/customer groups remain future scope.
- [ ] Confirm import file requirements: CSV is required; XLSX is recommended.
- [ ] Confirm default online fulfillment location and reservation expiry time.
- [ ] Confirm POS tender types, tax behavior, receipt format, discount limits, and return policy.
- [x] Repair or update the existing authentication/profile tests to match current behavior.
- [x] Configure the test environment so XAMPP's subdirectory `APP_URL` does not cause route-test 404 responses.
- [x] Add feature flags/config for `inventory_v2` and `pos` during rollout (`config/inventory.php`: `inventory_v2_enabled`, `pos_enabled`, reservation timeout, default fulfillment location).
- [ ] Back up a representative database and define rollback steps.

**Exit criteria:** Current tests have an agreed baseline, operational rules are signed off, and a database backup can be restored.

### Phase 1 - Relational roles and permissions (4-6 days)

**Status:** Completed
**Goal:** Make access configurable and enforce it consistently.

- [x] Add relational roles and permissions.
- [x] Seed Admin, Manager, Inventory Staff, Sales, and Support roles.
- [x] Seed the permission catalogue and default matrix.
- [x] Migrate existing `super_admin`, `manager`, `cashier`, and `support` assignments.
- [x] Preserve JSON permissions as direct user overrides and keep legacy columns temporarily for rollback.
- [x] Replace role arrays and broad manager bypasses in middleware, controllers, APIs, and Inertia navigation.
- [x] Add role/permission management UI for Admin, including custom roles.
- [x] Add guardrails: user cannot remove their own critical access; at least one active Admin must remain; non-Admin staff managers cannot assign the protected Admin role.
- [x] Record role and permission changes in audit logs.
- [x] Add authorization feature tests for role grants, direct overrides, custom roles, protected routes, and Admin assignment.

**Exit criteria:** Backend policies and middleware enforce permissions; navigation reflects the same permissions; current staff retain equivalent access.

**Implementation update - July 14, 2026:**

- Migration: `2026_07_14_000001_create_role_permission_tables.php`
- Models: `Role`, `Permission`, and relational/effective permission methods on `User`
- Admin UI: `/admin/roles` with grouped permissions, custom role creation, staff counts, and deletion safeguards
- Compatibility: legacy `users.role` and JSON `users.permissions` remain synchronized/supported during transition
- Verification: 31 PHP tests pass; production Vite build passes; live XAMPP login and `/admin/roles` return HTTP 200

### Phase 2 - Locations, balances, and opening-stock migration (5-8 days)

**Status:** Completed
**Goal:** Establish the multi-location inventory foundation.

- [x] Create locations and staff-location assignment tables.
- [x] Create balances and movement ledger tables with constraints and indexes.
- [x] Add nullable `skus.wholesale_price` and create inventory import batch/row tables.
- [x] Implement inventory models, a location policy, and the core `InventoryService`.
- [x] Seed the initial warehouse and store.
- [x] Add a migration command that creates opening balances and `opening_balance` ledger rows from each existing `skus.stock_qty`.
- [x] Make location balances and movements authoritative without legacy quantity dual writes.
- [x] Add a reconciliation command for aggregate ledger vs balance quantities.
- [x] Add MySQL transaction, constraint, reservation, and idempotency tests.
- [x] Add location management and staff assignment UI.

**Exit criteria:** Every imported opening quantity exists at a selected location, ledger totals match balances, and all new location-balance writes go through the inventory service.

**Implementation update - July 14, 2026:**

- Migration: `2026_07_14_000002_create_inventory_foundation_tables.php`
- Models: `Location`, `InventoryBalance`, `InventoryMovement`, `InventoryImport`, and `InventoryImportRow`
- Inventory service: row-locked, transactional mutations for opening balance, receipt, adjustment, reservation, reservation release, and sale completion
- Commands: `inventory:migrate-opening-stock` with `--dry-run`/`--location`, and `inventory:reconcile`
- Admin UI: `/admin/locations` with warehouse/store CRUD, active/default-fulfillment controls, inventory totals, and staff assignment
- Development data: `MAIN-WH` and `MAIN-STORE` created; both seeded staff accounts assigned; the empty catalog required no opening movements
- Verification: 39 PHP tests pass on MySQL; production Vite build passes; authenticated XAMPP `/admin/locations` smoke test returns HTTP 200

### Phase 3 - Inventory list, import, receiving, and adjustments (9-13 days)

**Status:** Completed
**Goal:** Deliver the first usable inventory operations workspace.

- [x] Build the inventory overview with location comparison, search, filters, and low-stock status.
- [x] Build SKU stock detail and movement history.
- [x] Build downloadable CSV/XLSX import templates.
- [x] Build location and import-mode selection, secure upload, queued validation, preview, and error-report workflow.
- [x] Implement SKU/barcode matching and original, retail, wholesale, and cost price validation.
- [x] Post validated quantity imports through receipts/opening balances/adjustments and update authorized nonblank price fields atomically.
- [x] Add import history, result download, idempotency, reversal links, and audit logs.
- [x] Build stock receipt draft/post workflow.
- [x] Build stock adjustment/count draft/approve/post workflow.
- [x] Add configurable approval thresholds.
- [x] Remove direct stock editing from product CRUD for migrated inventory.
- [x] Add CSV export for balances and movement history.
- [x] Add audit logs and notifications for important losses and large adjustments.
- [x] Add feature tests for import preview/posting, duplicate rows, price conflicts, retries, receipt, adjustment, reversal, authorization, and negative-stock prevention.

**Exit criteria:** Staff can import stock and prices into an authorized warehouse/store, explain every resulting quantity from movement history, and receive or correct stock without editing a SKU directly.

**Implementation update - July 14, 2026:**

- Routes: `/admin/inventory`, imports, receipts, adjustments (see `routes/admin.php`)
- Controllers: `InventoryController`, `InventoryImportController`, `StockReceiptController`, `StockAdjustmentController`
- Services: `StockImportService`, `StockReceiptService`, `StockAdjustmentService`, queued `ValidateInventoryImport`
- Admin UI: inventory overview (auto-refresh polling, in-transit column, row actions), SKU history with document links, imports/receipts/adjustments workspaces
- Product list now shows location-balance totals instead of legacy `skus.stock_qty`
- Config flags: `inventory_v2_enabled`, `pos_enabled`, reservation timeout, default fulfillment location
- Verification: `InventoryOperationsTest` (9 cases) passes on MySQL

### Phase 4 - Warehouse/store transfers (6-9 days)

**Status:** Completed
**Goal:** Move stock safely between any two current or future locations.

- [x] Create transfer models, services, policies, numbering, and statuses.
- [x] Build transfer list, create, detail, approval, shipment, and receiving interfaces.
- [x] Show available source quantity during entry.
- [x] Track in-transit quantities separately.
- [x] Add partial receipt and discrepancy handling.
- [x] Block cancellation after shipment and provide a documented reversal process.
- [x] Broadcast transfer status and balance changes after commit.
- [x] Add concurrency, duplicate-submit, authorization, and discrepancy tests.

**Exit criteria:** A transfer can move stock from warehouse to store with a complete two-sided audit trail and no period where the same units are sellable in both locations.

**Implementation update - July 14, 2026:**

- Migration: `2026_07_14_000004_create_stock_transfer_tables.php`
- Models: `StockTransfer`, `StockTransferItem`
- Service: `StockTransferService` with draft → submit → approve → ship → receive lifecycle; `InventoryService::shipTransfer` / `receiveTransfer`
- Policy/controller/UI: `StockTransferPolicy`, `StockTransferController`, `/admin/inventory/transfers/*`, transfer timeline and partial-receipt form
- Inventory overview shows per-location in-transit quantities from open transfers
- Verification: `StockTransferTest` (6 cases) passes on MySQL

### Phase 5 - Real-time inventory updates (3-5 days)

**Status:** Completed (code); websocket UAT pending credentials
**Goal:** Keep inventory and transfer screens synchronized across users.

- [x] Configure Echo and Pusher/Soketi-ready environment variables for local, staging, and production environments.
- [x] Implement private channel authorization based on permissions and location assignments.
- [x] Broadcast inventory events only after committed transactions.
- [x] Refresh affected Inertia page data from committed server state when events arrive.
- [x] Add connection status and polling fallback.
- [x] Add local browser/page smoke coverage through authenticated route and build verification.
- [x] Add event-dispatch and private-channel authorization tests.
- [ ] Perform manual two-browser websocket UAT after Pusher/Soketi credentials are configured.

**Exit criteria:** A posted receipt, adjustment, transfer, or sale appears on another authorized screen within a few seconds without a full page reload.

**Implementation update - July 14, 2026:**

- Packages: `pusher/pusher-php-server`, `laravel-echo`, and `pusher-js`
- Events: `InventoryBalanceChanged` and `StockTransferStatusChanged`, both configured for after-commit broadcasting
- Channels: `private-inventory.location.{locationId}` and `private-inventory.all`, authorized by inventory permission plus location access
- Frontend: `useInventoryRealtime` hook initializes Echo from Vite env, uses XAMPP-safe `/broadcasting/auth`, displays connection mode, and falls back to polling
- Pages updated: inventory overview, SKU movement history, transfer list, and transfer detail
- Verification: 56 PHP tests pass; Vite production build passes; broadcast auth route is registered

### Phase 6 - POS MVP (10-15 days)

**Status:** Completed (core MVP); returns/void approvals/offline UAT pending
**Goal:** Complete normal in-store sales quickly and safely.

- [x] Add registers and register management.
- [x] Add shift opening and closing with cash variance.
- [x] Add POS fields to orders/payments and allow a nullable customer for walk-in sales.
- [x] Build barcode/search product lookup scoped to the register's store.
- [x] Build cart, variant selection, quantity editing, customer lookup, discounts, and totals.
- [x] Implement atomic POS checkout for cash, card, and mobile payment.
- [x] Add amount tendered and change calculation.
- [x] Add held carts and resume workflow.
- [x] Add receipt screen and printable receipt.
- [x] Add discount permission enforcement; manager approval workflow for void/refund limits remains follow-up.
- [ ] Integrate POS returns with positive inventory movements.
- [x] Add offline warning; do not promise offline sales in MVP.
- [x] Add feature tests for shift, sale, payment, stock deduction, cash variance, authorization, and insufficient stock.
- [ ] Add end-to-end browser tests for scanner flow, receipt printing, hold/resume, void, and return.

**Exit criteria:** A Sales user can open a shift, scan and sell an in-stock item, accept payment, print a receipt, and close the shift with correct inventory and cash totals.

**Implementation update - July 14, 2026:**

- Migration: `2026_07_14_000005_create_pos_tables.php`
- Models: `PosRegister`, `PosShift`, `HeldCart`, and POS relationships on `Order`, `Payment`, `Location`, and `User`
- Services: `PosShiftService` and `PosCheckoutService` for register shifts and atomic checkout
- Routes/UI: `/admin/registers`, `/admin/pos`, product/customer search, shift open/close, held carts, checkout, and printable receipt
- Inventory integration: POS checkout sells only from the register store and uses `InventoryService::completeSale`, so movements, balance locks, and real-time inventory events stay consistent
- Verification: 60 PHP tests pass; production Vite build passes; authenticated XAMPP smoke tests for `/admin/pos` and `/admin/registers` return HTTP 200 with the expected Inertia components

### Phase 7 - Online order reservations and legacy stock removal (6-9 days)

**Status:** Completed
**Goal:** Make storefront and POS compete safely for the same location stock.

- [x] Assign a fulfillment location to each online order.
- [x] Reserve inventory at online order creation.
- [x] Convert reservations to sale movements on payment confirmation.
- [x] Release reservations on rejection, cancellation, and expiry.
- [x] Add a scheduled reservation-expiry command and scheduler output for monitoring.
- [x] Update storefront availability, cart limits, flash sales, cancellations, and returns to use location balances.
- [x] Replace direct stock writes in `OrderPaymentService` and `OrderManagementService` with inventory service calls.
- [x] Stop using `skus.stock_qty` in application reads.
- [x] Deprecate the legacy stock columns outside explicit opening-stock migration tooling.

**Exit criteria:** Online checkout, POS, returns, and transfers all use the same location-aware stock rules with no direct legacy quantity changes.

**Implementation update - July 14, 2026:**

- Migrations/models: `2026_07_14_000006_create_inventory_reservations_table.php`, `2026_07_14_000007_add_inventory_tracking_to_order_returns.php`, `InventoryReservation`, and inventory references on `OrderReturn`
- Services: `StockReservationService` owns reserve/convert/release operations; `StorefrontInventoryService` resolves the configured fulfillment location and exposes its available quantity
- Order lifecycle: checkout reserves normal stock, payment confirmation atomically consumes reservations, rejection/cancellation/expiry releases them, and paid cancellation or received item returns create idempotent `sale_return` movements
- Scheduler: `inventory:expire-reservations` runs every five minutes with overlap protection and a configurable batch limit
- Storefront: product lists, product detail, availability filters, cart limits, preorder state, and flash-sale stock labels now use `inventory_balances.on_hand_qty - reserved_qty`
- Legacy cleanup: normal controllers and order services no longer read or mutate `skus.stock_qty`; the field remains only for the explicit opening-stock migration path and old fixture compatibility
- Verification: 65 PHP tests pass, including five online reservation and return lifecycle cases; production Vite build passes; migrations and scheduler are active in XAMPP

### Phase 8 - Reporting, alerts, and production hardening (5-8 days)

**Status:** Core implementation completed; production validation pending
**Goal:** Make the system operationally measurable and production-ready.

- [x] Inventory valuation by location using SKU cost.
- [x] Low-stock and out-of-stock report by location.
- [x] Stock movement, adjustment variance, transfer aging, shrinkage, and sell-through reports.
- [x] POS sales by location, register, cashier, payment method, and shift.
- [x] Reorder alerts and daily database notification digest for authorized staff.
- [x] Scheduled reconciliation with persisted, visible health results.
- [x] Queue, broadcasting, workflow, application-log, and backup-freshness health monitoring.
- [ ] Configure the production backup destination and external error tracking, then complete a restore drill.
- [ ] Performance testing with realistic SKU, movement, and concurrent-terminal volumes.
- [ ] UAT at the physical warehouse and store using scanners and receipt printers.

**Exit criteria:** Managers can reconcile stock and cash, investigate discrepancies, and trust alerts and reports under normal production load.

**Implementation update - July 14, 2026:**

- Migration: `2026_07_14_000008_create_operations_monitoring_tables.php`
- Reporting: permission-scoped Inventory, POS, and Operations Health views at `/admin/reports`, with location/date/status filters and CSV exports
- Inventory analytics: valuation, low/out-of-stock balances, movement totals, adjustment shrinkage, transfer aging, and SKU sell-through
- POS analytics: revenue and order totals by location, register, cashier, tender type, and shift cash variance; Sales users see only their own activity
- Alerts and monitoring: deduplicated low-stock alerts, daily database notification digest, inventory reconciliation snapshots, and queue/broadcast/workflow/log/backup checks
- Scheduled commands: `operations:health-check`, `inventory:reconcile`, and `inventory:scan-low-stock`
- Verification: 70 PHP tests pass on MySQL; production Vite build passes; report routes and scheduled tasks are registered

## 12. Suggested Route Groups

```text
/admin/locations
/admin/registers

/admin/inventory
/admin/inventory/skus/{sku}
/admin/inventory/imports
/admin/inventory/imports/create
/admin/inventory/imports/template
/admin/inventory/imports/{inventoryImport}
/admin/inventory/imports/{inventoryImport}/post
/admin/inventory/receipts
/admin/inventory/adjustments
/admin/inventory/transfers

/admin/pos
/admin/pos/shifts
/admin/pos/products/search
/admin/pos/held-carts
/admin/pos/checkout
/admin/pos/orders/{order}/receipt
/admin/pos/orders/{order}/return
```

Use web/Inertia routes for full pages and authenticated JSON endpoints for rapid POS search, stock refresh, and checkout actions. Apply policies to both route types.

## 13. Testing Strategy

### Backend

- Unit tests for movement calculations, permission rules, discount limits, and transfer transitions.
- Feature tests for every inventory document, import mode, price update rule, and POS endpoint.
- MySQL integration tests for row locks, simultaneous checkout, idempotency, and deadlock retry behavior.
- Reconciliation tests proving balances equal movement totals.
- Authorization tests by role and assigned location.

SQLite-only tests are insufficient for final concurrency verification because its locking behavior differs from MySQL.

### Frontend

- Component tests for quantity controls, totals, transfer status actions, and payment validation.
- Browser tests for inventory filters, scanner input, transfer lifecycle, POS checkout, and reconnect behavior.
- Browser tests for import upload, preview filtering, validation errors, posting progress, and result reports.
- Visual checks at desktop, tablet, and phone widths.
- Two-session test where one user changes stock while another watches the same SKU.

### UAT scenarios

- [ ] Import warehouse stock from CSV using original, retail, wholesale, and cost prices.
- [ ] Import store stock in a separate batch and verify quantities remain separated by location.
- [ ] Re-upload a posted file or retry its request and verify quantities are not added twice.
- [ ] Leave a price cell blank and verify the current price is preserved; enter zero and verify it is handled as an explicit value.
- [ ] Verify a price conflict or duplicate SKU row is visible before posting.
- [ ] Receive 20 units at the warehouse.
- [ ] Transfer 8 units to the store and receive only 7 with a discrepancy reason.
- [ ] Count store stock and post an approved loss adjustment.
- [ ] Sell one unit through POS while another browser watches inventory.
- [ ] Place an online order for the final available unit and verify POS cannot oversell it.
- [ ] Reject the online payment and verify the reservation becomes available again.
- [ ] Return a POS item and verify stock and payment reporting.
- [ ] Verify Sales cannot approve adjustments, edit roles, or view another location without permission.

## 14. Deployment and Migration Sequence

Use additive deployments so the live shop can continue operating:

1. Deploy relational RBAC while reading old role data as a temporary fallback.
2. Deploy locations, balances, ledger, and opening-stock migration with legacy synchronization enabled.
3. Reconcile all SKU totals and resolve differences before enabling inventory operations.
4. Enable stock import, receiving, and adjustments for a small group of staff.
5. Enable transfers and real-time updates.
6. Pilot POS on one register at the store.
7. Enable online reservations and route all order stock changes through the inventory service.
8. Observe at least one full stock-count and return cycle.
9. Disable legacy stock edits and later remove the compatibility path.

Each stock-changing request should accept or generate an idempotency key so double-clicks, network retries, and POS reconnects cannot post the same movement twice.

## 15. Definition of Done

The complete initiative is done when:

- Roles and permissions are editable without deploying code and are enforced server-side.
- Staff access is limited by both permission and assigned location.
- Every SKU has a trustworthy balance at every relevant location.
- Authorized staff can import warehouse/store stock and original, retail, wholesale, and cost prices through a validated preview-and-post workflow.
- Repeated import requests cannot duplicate inventory movements or quantities.
- Every stock change has a user, reason, timestamp, before/after quantity, and source document.
- Warehouse-to-store transfers show draft, in-transit, received, and discrepancy states correctly.
- POS sales and online orders cannot oversell the same location stock.
- Authorized screens receive committed inventory updates within a few seconds.
- Managers can reconcile inventory and POS shifts from reports.
- Migration and rollback procedures are documented and tested against a database backup.

## 16. Recommended Delivery Order

Do not build the POS first. The POS depends on reliable location balances, permissions, and atomic inventory services. The recommended order is:

```text
Test baseline
  -> Roles and permissions
  -> Locations and inventory ledger
  -> Stock import, receiving, and adjustments
  -> Transfers
  -> Real-time notifications
  -> POS
  -> Online reservations
  -> Reporting and hardening
```

The first practical release should include Phases 0-4. It will already solve warehouse/store visibility, receiving, adjustments, and transfers. Phases 5-8 then add live synchronization, POS, shared online inventory, and operational reporting.

## 17. Roadmap Maintenance

When implementation begins:

1. Change each phase status to `In progress`, `Blocked`, or `Completed`.
2. Check tasks only after implementation, tests, and permission review are complete.
3. Add migration filenames, route names, and final business decisions beneath the relevant phase.
4. Record any scope change in a dated "Decision log" section at the end of this document.

## 18. Decision Log

### July 14, 2026 - Clean inventory migration

The project is not running in production, so rolling-deployment and live-data backward compatibility are not required. `inventory_balances` and `inventory_movements` are the source of truth for new inventory operations; `InventoryService` does not dual-write `skus.stock_qty`. Remaining legacy stock reads and writes will be removed as the inventory CRUD and order allocation surfaces are implemented.

### July 14, 2026 - Phase 3 and 4 delivery

Phase 3 inventory operations (overview, imports, receipts, adjustments) and Phase 4 warehouse/store transfers are implemented. Storefront and order flows still read legacy `skus.stock_qty` until Phase 7.

### July 14, 2026 - Phase 5 delivery

Phase 5 real-time inventory updates are implemented with Pusher-compatible private channels, after-commit event dispatch, Echo subscriptions, and polling fallback. Live websocket delivery still requires configuring `BROADCAST_DRIVER=pusher` plus the `PUSHER_*` and `VITE_PUSHER_*` environment variables for the chosen Pusher/Soketi service.

### July 14, 2026 - Phase 6 core POS delivery

Phase 6 core POS is implemented for normal in-store sales: register management, shift open/close, store-scoped product search, cashier cart, held carts, cash/card/mobile checkout, printable receipts, and inventory-backed stock deduction. POS returns, void/refund approval workflows, and full browser scanner/receipt-printer UAT remain follow-up work.

### July 14, 2026 - Phase 7 online inventory allocation

Online orders now reserve stock from the configured fulfillment location while payment is awaiting review. Approval converts the reservation to a sale; rejection, cancellation, and scheduled expiry release it. Storefront availability and cart limits use the same location balance as POS. Paid cancellation and received item returns restore stock through append-only, idempotent `sale_return` movements rather than the legacy SKU quantity.

### July 14, 2026 - Phase 8 operations reporting and monitoring

Phase 8's application work is implemented: inventory and POS reporting, CSV export, low-stock alerts, scheduled reconciliation, and an operations-health dashboard are available with permission and location scoping. Production backup configuration, an external error-tracking provider, realistic load testing, and physical warehouse/store UAT remain deployment activities because they require the target infrastructure and hardware.
