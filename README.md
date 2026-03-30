# Focus Forms: Comprehensive Multi-Tenant Form Management & Analytics System

Focus Forms is a white-label, state-of-the-art enterprise solution for creating, managing, and analyzing dynamic forms across multiple organizations. Built with a modern tech stack, it provides a powerful platform for both administrators and end-users, featuring deep nested form logic, real-time analytics, and seamless multi-channel notifications.

## 🚀 Key Features

### 1. Advanced Form Creation
*   **Drag-&-Drop Interface**: Intuitive form builder with a variety of input types.
*   **Dynamic Logic**: Support for nested follow-up forms and branching question paths.
*   **Global Templates**: Superadmin can create and push forms globally across all tenants.
*   **Customizable Settings**: Fine-grained control over form visibility, activity status, and location tracking.

### 2. Intelligent Data Collection
*   **Multi-Channel Invites**: Send form invitations via Email and WhatsApp (Twilio/MailerSend).
*   **Real-Time Submissions**: Instant capture and processing of responses with Socket.io updates.
*   **Offline/Draft Support**: Progress tracking and session management using advanced session logs.
*   **Media Handling**: Integrated file and image uploads using GridFS and S3-compatible storage.

### 3. Deep Analytics & Reporting
*   **Visual Dashboards**: High-level charts and KPIs for quick business insights.
*   **Granular Reporting**: Detailed analysis of individual forms with trend tracking over time.
*   **Export Capabilities**: One-click export to Excel, CSV, and high-quality PDF reports (using Puppeteer).
*   **Global Benchmarking**: (If enabled) Compare form performance across different global metrics.

### 4. Enterprise-Grade Administration
*   **Multi-Tenancy**: Complete data isolation between different organizations (tenants).
*   **RBAC (Role-Based Access Control)**: Granular permissions for Superadmins, Admins, Subadmins, and regular users.
*   **Activity Auditing**: Comprehensive logs of all user actions and system changes.
*   **System Integrity**: Integrated health checks and real-time system monitoring.

## 🛠️ Tech Stack

### Frontend
- **Framework**: React.js with Vite
- **Styling**: Tailwind CSS for modern, responsive UI
- **Routing**: React Router v7+
- **State Management**: Context API
- **Charts**: Recharts / Chart.js for data visualization

### Backend
- **Environment**: Node.js & Express
- **Database**: MongoDB (Mongoose ODM)
- **Real-Time**: Socket.io
- **Storage**: GridFS and AWS S3 integration
- **Automation**: Puppeteer for PDF reports
- **Security**: JWT Authentication & BCrypt hashing

## 📂 Project Structure

- `3W-WHEELERTVS-FRONTEND-main/`: The core administrative and user portal.
- `3w-wheeler-backend-main/`: Powerful Node.js API handling all logic and integrations.
- `3w-wheeler-expo/`: Mobile application platform for field staff (currently in development).

## ⚡ Quick Start

### 1. Prerequisites
- Node.js (v18+)
- MongoDB Atlas or local instance
- Environment variables configured in `.env` files

### 2. Backend Setup
```bash
cd 3w-wheeler-backend-main
npm install
npm run dev
```

### 3. Frontend Setup
```bash
cd 3W-WHEELERTVS-FRONTEND-main
npm install
npm run dev
```

## 📄 Documentation
For detailed API documentation and feature guides, please refer to the [DOCUMENTATION.md](./DOCUMENTATION.md) file.
