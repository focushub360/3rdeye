# 3W Wheeler Tenant Form Handling Workflow

Based on an analysis of the backend (`models/Form.js` and `controllers/formController.js`), here is the complete workflow for how forms are managed and distributed across tenants in the system.

## 1. Form Ownership (`tenantId`)
- Every form in the database is tied to a primary `tenantId`.
- **Superadmins** can create forms and assign them to any specific `tenantId` (or make them global).
- **Admins** can create forms, but the forms are automatically bound to their own `tenantId`.
- Only the owning tenant (or a superadmin) has permission to edit, update, duplicate, or delete the form.

## 2. Cross-Tenant Sharing Mechanisms
There are exactly 3 ways a form can bridge across multiple tenants:

### A. Global Forms (`isGlobal: true`)
If a form is marked as global, it overrides tenant restrictions. Users from any tenant can view and interact with the form. 

### B. Explicit Full Sharing (`sharedWithTenants`)
Forms have a `sharedWithTenants` array. 
- The owning tenant/superadmin can add other `tenantId`s to this array.
- Tenants in this array get full access to view and respond to the form, but **cannot edit the form structure** (only the owner can do that).

### C. Chassis-Level Granular Sharing (`chassisTenantAssignments`)
This is a highly specialized feature for manufacturing/assembly environments.
- Structure: `[{ chassisNumber: String, assignedTenants: [String] }]`
- Instead of sharing the entire form indiscriminately, a form is shared with a tenant *only for specific chassis numbers*.
- When a user queries forms, the backend checks: `{"chassisTenantAssignments.assignedTenants": user.tenantId}`. If there's a match, the user can access the form.
- This allows a central manufacturer to share a single inspection form with multiple different supplier/vendor tenants, but each vendor only sees the form in the context of the specific chassis units assigned to them.

## 3. Querying & Access Control (`getForms`)
When a user logs in and requests their forms, the backend (`formController.js`) strictly filters the database using an `$or` condition. A form is returned if and only if it matches one of these criteria:
1. `isGlobal` is `true`.
2. `tenantId` matches the user's `tenantId`.
3. `sharedWithTenants` includes the user's `tenantId`.
4. `chassisTenantAssignments.assignedTenants` includes the user's `tenantId`.

## 4. Admin Restrictions
Security is enforced on mutation routes (Edit, Delete, Add Question, Reorder, etc.). 
Even if a form is shared with Tenant B via `sharedWithTenants` or `chassisTenantAssignments`, if an Admin from Tenant B tries to edit the form, the controller blocks it with:
```javascript
if (req.user.role === 'admin' && form.tenantId.toString() !== req.user.tenantId.toString()) {
  return res.status(403).json({ message: 'Not authorized to modify this form' });
}
```
Only the primary `tenantId` owner (or a superadmin) can modify the form template.

---

# 3W Wheeler Chassis / Response Workflow

When a user submits a form (e.g., an inspector inspecting a Chassis), the response goes through a specific lifecycle. 

## 1. Initial Submission
- The inspector submits the form from the mobile app or web portal.
- A `Response` document is created in the database with a default `status: 'pending'`.
- The response is bound to the `tenantId` of the form/submitter.
- The UI analyzes the answers to dynamically calculate a sub-status (e.g., "Direct Ok", "Rework 1", "Rework Accepted") based on whether defects were found and fixed.

## 2. BIW Review (Secondary Review)
For quality control (especially in cross-tenant scenarios where a manufacturer is reviewing a supplier's work), a secondary review process called **BIW Review** exists.
- Reviewers can evaluate the submitted chassis and mark the `biwReview.status` as:
  - **`Accepted`**
  - **`Rejected`**
  - **`Reworked`**
- **Strict Security Rule**: A user *cannot* apply a BIW review to their own submission. The system strictly enforces that `reviewedBy` must be a different user than the `submittedBy` (unless the reviewer is an Admin/Superadmin or it was an automated Excel Import).

## 3. Dispatch
Once a chassis has passed inspection and review, it is ready for dispatch.
- A dispatcher marks the response as dispatched.
- The system flags the response with `isDispatched: true` and strictly records the `dispatchedBy` (User ID), `dispatchedByName`, and `dispatchedAt` timestamp.
- This represents the physical hand-off or completion of that chassis's journey at the current facility/tenant.
