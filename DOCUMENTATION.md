# Focus Forms: Technical Documentation

This document provides a deep dive into the features and technical architecture of the Focus Forms platform.

## 🔑 Authentication & Authorization

### Roles & Permissions
Focus Forms implements a robust RBAC system with the following default roles:

-   **Superadmin**: Full system control across all tenants. Can manage tenant subscriptions, global forms, and system-wide configuration.
-   **Admin**: Organization-level control. Can manage their organization's users, forms, and responses.
-   **Subadmin**: Limited administrative control. Typically assigned to team leads for managing response assignment and attendance.
-   **User**: Field staff or respondents. Can fill out forms and view their own activity logs.

### Multi-Tenancy Architecture
Data isolation is maintained through `tenantId` and `tenantSlug` fields assigned to each record.
-   **Public Access**: Users can fill out forms via a tenant-unique URL (`/forms/:id/public/:tenantSlug`).
-   **Private Access**: Admin dashboard is accessible through organization-specific authenticated sessions.

---

## 📝 Form Management

### Dynamic Form Engine
The core of Focus Forms is its flexible JSON-based form engine, which supports:
-   **Question Types**: Text, Number, Dropdown, Multiple Choice (Radio/Checkbox), File Upload, Date, and Location.
-   **Branching Logic**: Ability to trigger "Follow-up" sections and questions based on user answers.
-   **Validation**: Real-time validation for required fields, character limits, and data types.

### Global vs Local Forms
-   **Global Forms**: Created by Superadmins and visible to all organizations.
-   **Local Forms**: Created by organization Admins for internal workflows.

---

## 📊 Analytics & Insights

### Real-Time Analytics
Dashboards are powered by Aggregation Pipelines in MongoDB, providing:
-   **Response Rates**: View submission counts over specific timeframes.
-   **Question Analysis**: Breakdowns of choices for radio/dropdown questions.
-   **Leaderboards**: (If enabled) View top respondents or teams based on submission count.

### Reporting Engine
Using **Puppeteer**, the system generates high-fidelity PDF reports of form responses, including:
-   Captured images/media.
-   Geospatial data (if location tracking is enabled).
-   Branded headers and footers for the specific tenant.

---

## 📡 API Endpoints

The backend exposes a RESTful API under the `/api` prefix.

### 🔐 Auth
- `POST /api/auth/login`: Authenticate and receive JWT.
- `GET /api/auth/profile`: Get current user details.
- `PUT /api/auth/change-password`: Update current user's password.

### 📝 Forms
- `POST /api/forms`: Create a new form.
- `GET /api/forms`: List all forms (filterable by tenant/visibility).
- `GET /api/forms/public/:tenantSlug`: List all public forms for a tenant.
- `PATCH /api/forms/:id/visibility`: Update form visibility settings.
- `POST /api/forms/:id/duplicate`: Clone an existing form.

### 📥 Responses
- `POST /api/responses`: Submit a new response.
- `GET /api/responses/form/:formId`: List all responses for a form.
- `PATCH /api/responses/:id/assign`: Assign a response to a specific subadmin or user.
- `GET /api/responses/form/:formId/export`: Export data as Excel/CSV.

### 🏢 Tenants
- `POST /api/tenants`: (Superadmin Only) Create a new tenant.
- `GET /api/tenants`: (Superadmin Only) List all registered organizations.

---

## 💬 Communication
Focus Forms integrates with third-party APIs for notifications:
-   **WhatsApp**: Message templates for form invitations and status updates.
-   **Email**: Professional, branded email notifications for submissions.

## 🛠️ Data Infrastructure
-   **MongoDB GridFS**: Used for high-volume file storage and serving.
-   **Socket.io**: Used for real-time dashboard updates when new responses are submitted.
-   **Audit Trail**: Every CRUD action is recorded in the `ActivityLog` collection for compliance.
