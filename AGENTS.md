# 3W Wheeler Project Knowledge & Architecture Guide

This document is the single source of truth for the **3W Wheeler** (Focus Forms / VehicleIQ / Focus 3rd Eye) ecosystem, documenting system architecture, multi-tenant security, form lifecycle, response handling, bulk Excel import pipeline, analytics, and operational workflows.

---

## 1. System Architecture & Tech Stack

The platform is a multi-tenant manufacturing and assembly inspection platform with three primary tiers:

- **Backend (`3w-wheeler-backend`)**:
  - Node.js & Express REST API with Mongoose / MongoDB Atlas.
  - Real-time communication via Socket.IO (`/socket.io`).
  - Authentication: JWT with 7-day expiration, role-based access control (`superadmin`, `admin`, `user`/`inspector`, `guest`).
  - Production URL: `https://www.focus3rdeye.com/api` (Local: `http://localhost:5000/api`).
- **Web Frontend (`3W-WHEELERTVS-FRONTEND`)**:
  - React 18, Vite, TypeScript, Tailwind CSS, Lucide React icons, Chart.js.
  - Production URL: `https://www.focus3rdeye.com` (Local: `http://localhost:5173`).
- **Mobile App (`mobile-expo`)**:
  - React Native & Expo mobile client for factory floor inspectors.
  - Offline image capturing, queueing, and synchronization (`offlineImageHelper.ts`).
  - Shift management, direct inspection forms, and admin messaging.

---

## 2. Multi-Tenant Form Handling Workflow

### A. Form Ownership (`tenantId`)
- Every form in MongoDB (`models/Form.js`) is bound to a primary `tenantId`.
- **Superadmins** can create forms for any specific `tenantId` or make them global.
- **Admins** can create forms automatically bound to their own `tenantId`.
- **Template Mutation Security**: Only the owning tenant (or a superadmin) has permission to edit, update, reorder questions, or delete the form:
  ```javascript
  if (req.user.role === 'admin' && form.tenantId.toString() !== req.user.tenantId.toString()) {
    return res.status(403).json({ message: 'Not authorized to modify this form' });
  }
  ```

### B. Cross-Tenant Sharing Mechanisms
A form can bridge across multiple tenants in 3 ways:
1. **Global Forms (`isGlobal: true`)**: Accessible to users from all organizations.
2. **Explicit Full Sharing (`sharedWithTenants`)**:
   - Owning tenant adds partner `tenantId`s to `sharedWithTenants`.
   - Partner tenants have full access to view, fill out, and inspect responses, but cannot alter the template structure.
3. **Chassis-Level Granular Sharing (`chassisTenantAssignments`)**:
   - Structure: `[{ chassisNumber: String, assignedTenants: [String] }]`.
   - The form is shared with a supplier/vendor *only for specific chassis units*.
   - Filtered via `{"chassisTenantAssignments.assignedTenants": user.tenantId}`.

### C. Form Querying & Access Control (`getForms` & `getFormById`)
- Users retrieve forms via `$or` matching `isGlobal: true`, `tenantId`, `sharedWithTenants`, or `chassisTenantAssignments`.
- **Admin Read Access**: In `getFormById`, Admins and Superadmins have read permissions to inspect form templates and question schemas across tenants for quality analytics and response audits without tripping organizational 403 blocks.

---

## 3. Bulk Excel Response Import & Batch Architecture

A core capability of the platform is bulk uploading historical and batch inspection data via Excel sheets (`.xlsx`).

### A. Data Ingestion & Schema Alignment
- Endpoint: `POST /api/responses/batch/import` & file upload routes.
- The backend matches Excel column headers against form question titles, identifying `chassisNumber`, inspector name, status, and defect categories.

### B. Upload History (`BulkImportHistory` Model)
- Every upload creates a record in `bulkimporthistories` capturing:
  - `fileName`: Name of the uploaded Excel workbook (e.g., `Excel_Responses_Import.xlsx`).
  - `formId` & `formTitle`: Target form template.
  - `batchId`: Unique timestamped batch identifier (`batch-<timestamp>` or `batch-legacy-<timestamp>`).
  - `dataCount`: `{ total, success, failed }`.
  - `details`: Stored submitters, sample chassis numbers, and notes.
- **Admin Visibility**: All Excel upload batches across the system are accessible to `admin` and `superadmin` roles in the Upload History modal (`/api/import-history`).
- **Real-Time Bypassing Cache**: `ApiClient.getImportHistory()` uses `forceNetwork: true` to prevent memory caching from hiding newly uploaded batches.

### C. Direct Batch Response Stamping
- All imported responses in MongoDB store their `batchId`.
- Legacy historical responses (1,450+ records) are backfilled and stamped with matching `batchId`s, enabling instant lookup by batch.

---

## 4. Service Analytics & Responses Table ("Screen 2")

The primary management dashboard for inspection records is the **Service Analytics Responses Table** (`/forms/:formId/analytics?tab=responses`).

### A. Row & Column Grid Features
- **Grid Layout**: Actions, Checkbox / Bulk Selection, Dispatch status, Submitter, Dynamic Status badge, Selected Chassis / VIN, BIW Review badge, Timestamp, Time Taken, and Identification Details.
- **Bulk Operations**: Bulk assign, bulk status changes, bulk export, and bulk BIW reviews.
- **Inspection Detail Drawer / Edit**: Direct link to edit or view any response.

### B. "Only Uploaded Data" Table Filtering
- When navigating from the **Upload History** modal via the **↗️ (View Uploaded Data in Table)** button:
  - The URL includes `?tab=responses&batchId=<batchId>` (or `&uploadOnly=true`).
  - The backend (`getResponsesByForm`) applies `query.batchId = req.query.batchId` or filters strictly to `{ submittedBy: 'Excel Import' }`.
  - An active banner is displayed above the table:
    `[📁 Filtered to Uploaded Data (X records) | ✕ Show All Form Responses]`, allowing users to toggle between the specific upload batch and the complete form history.
- The obsolete card-based responses screen (Screen 1) has been decommissioned in favor of this row-and-column table.

---

## 5. Chassis Inspection & Review Lifecycle

When a chassis inspection response is submitted (via web form, mobile app, or Excel import), it traverses a structured workflow:

```
[Inspector Submission / Excel Import]
                │
                ▼
      Status: 'pending'
   (Dynamic sub-status: Direct Ok / Rework 1 / Rework Accepted)
                │
                ▼
         [BIW Review]
   ┌────────────┼────────────┐
   ▼            ▼            ▼
Accepted    Rejected     Reworked
                │
         (When Approved)
                │
                ▼
          [Dispatch]
   isDispatched: true
   dispatchedBy, dispatchedByName, dispatchedAt
```

### A. Sub-Status Calculation
- The UI inspects answer defect values dynamically to compute status tags:
  - **Direct OK**: Zero defects reported on initial inspection.
  - **Rework 1 / Rework 2**: Defects identified requiring correction.
  - **Rework Accepted**: Defects cleared and verified.

### B. BIW Secondary Review Rules
- Secondary quality review values: `Accepted`, `Rejected`, `Reworked`.
- **Anti-Tamper Rule**: An inspector *cannot* approve or apply a BIW review to their own submission (`reviewedBy !== submittedBy`), except for Admins/Superadmins or automated Excel Imports.

### C. Dispatch Hand-Off
- Once inspection and BIW review are complete, chassis units are marked as dispatched.
- Sets `isDispatched: true`, saving `dispatchedBy`, `dispatchedByName`, and `dispatchedAt`.

---

## 6. Authentication & API Client Resilience

- **Dynamic Token Resolution (`client.ts`)**:
  - `this.token` is backed by a reactive getter/setter that checks memory first, falling back to `localStorage.getItem("auth_token")`.
  - Eliminates unauthenticated requests on page refreshes or sub-component mounts.
- **Graceful Session Expiration**:
  - If a JWT token expires (401 Unauthorized), the dashboard displays a clear **"Session Expired: Please log in again"** prompt with a `[Log In Again]` button that preserves the return URL.
  - Non-auth API errors (e.g., organizational access, timeouts) are safely parsed without throwing `TypeError: X.toLowerCase is not a function`.

---

## 7. Key Database Collections

| Collection | Model / Purpose |
|---|---|
| `forms` | Inspection form templates, sections, question schemas, weightages, tenant bindings, and chassis tenant assignments. |
| `responses` | Individual chassis inspection submissions, question answers, defect images, BIW review state, and `batchId`. |
| `bulkimporthistories` | Audit log of all Excel response imports, file metadata, counts, and batch identifiers. |
| `tenants` | Organizations (manufacturers, suppliers, vendors), slugs, and activation state. |
| `users` | User accounts, credentials (hashed), roles (`superadmin`, `admin`, `user`), and assigned `tenantId`. |
| `notifications` | In-app alerts, quality flag triggers, and dispatch notifications. |
| `activities` | Heartbeat records and user activity monitoring logs. |

---

## 8. Common Developer Commands

- **Backend Dev Server**: `npm run dev` in `3w-wheeler-backend` (port `5000`).
- **Frontend Dev Server**: `npm run dev` in `3W-WHEELERTVS-FRONTEND` (port `5173`).
- **Frontend Type Check**: `npx tsc --noEmit` in `3W-WHEELERTVS-FRONTEND`.
- **Deploy Backend**: Push to `main` (triggers GitHub Actions `deploy-backend.yml`).
- **Deploy Frontend**: Push to `main` (triggers GitHub Actions automated deployment for `www.focus3rdeye.com`).

---

## 9. Analytics Excel Export & Date Range Pipeline

### A. Full Dataset vs. Paged Data Guarantee
- Historically, `handleExportToExcel` in `FormAnalyticsDashboard.tsx` generated exports from the in-memory `responses` array. If a user downloaded while pagination was streaming (200 records per page), older historical records (e.g., Sep 1–12) were missing because only the first page had loaded.
- **Dedicated Export Ingestion (`getAllResponsesForExport`)**:
  - `ApiClient.getAllResponsesForExport(formId, params)` iterates and retrieves all matching records across pages before passing them to the Excel builder.
  - If rows are explicitly selected via checkboxes, only the selected rows are exported.
  - If background streaming has already finished 100%, the export uses the in-memory array instantly without redundant network calls.
  - An interactive loading state (`isExporting` with `Loader2` spinner and disabled buttons) prevents duplicate clicks during export generation.

### B. Date Range Boundary Handling
- When filtering analytics by date range (e.g., `2026-09-01` to `2026-09-12`):
  - Backend controller (`responseController.js`) normalizes `startDate` to start of day (`00:00:00.000Z`) and `endDate` to end of day (`23:59:59.999Z`).
  - This eliminates off-by-one errors where responses submitted during early morning hours in local time zones (such as IST) were previously excluded by UTC comparison boundaries.

