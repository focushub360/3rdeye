# 3W Wheeler Project 🚀

A comprehensive form management and analytics system for 3W Wheeler TVS, featuring a powerful backend, a dynamic web frontend, and mobile capabilities.

## 📁 Project Structure

This repository is organized into the following main components:

- **`3w-wheeler-backend/`**: Node.js/Express backend server with MongoDB integration.
- **`3W-WHEELERTVS-FRONTEND/`**: Primary React + Vite web frontend project.
- **`mobile-expo/`**: Mobile application built with Expo.

---

## 🚀 Getting Started

### 1. Backend Setup
Navigate to the backend directory and start the server:
```powershell
cd 3w-wheeler-backend
npm install
npm run init       # Initialize database roles and users
npm run dev        # Start the backend server (uses nodemon)
```
*The backend runs on `http://localhost:5000`*

### 2. Frontend Setup
Navigate to the frontend directory and start the web application:
```powershell
cd 3W-WHEELERTVS-FRONTEND
npm install
npm run dev
```
*The frontend is available at `http://localhost:5173`*

### 💡 Portable Workspace Node.js (Windows)
If Node.js is not globally installed on your Windows machine, a fully functional portable Node.js v22.15.1 has been prepared directly in the workspace at:
`F:\Projects\3W\node-dist\PFiles64\nodejs`

To run the commands using this portable environment, prepending the local Node directory to your terminal `PATH` is recommended:
```powershell
# 1. Update PATH in your current terminal session
$env:PATH = "F:\Projects\3W\node-dist\PFiles64\nodejs;" + $env:PATH

# 2. Run backend
cd 3w-wheeler-backend
npm.cmd run dev

# 3. Run frontend (in a separate terminal after updating PATH)
cd 3W-WHEELERTVS-FRONTEND
npm.cmd run dev
```
*Note: Using `npm.cmd` instead of `npm` avoids any PowerShell script execution restrictions.*

---

## 🛠 Features

- **Form Management**: Create and manage complex inspection forms.
- **Real-time Analytics**: Visual dashboards for performance metrics.
- **Multi-tenant Support**: Managed access for different centers/teams.
- **Automated Notifications**: Integrated SMS and Email notifications.
- **Attendance & HR**: Built-in management for staff attendance and permissions.

## 🔑 Default Credentials (Development)

- **Superadmin (System)**: `superadmin@focus.com` / `superadmin123#`
- **Superadmin (Seeded)**: `superadmin@gmail.com` / `srimathi123`
- **Admin**: `admin@focus.com` / `admin123#`
- **Teacher/Staff**: `teacher@focus.com` / `teacher123`

---

## 📈 Technologies Used


- **Frontend**: React, Vite, TailwindCSS, Lucide Icons, Chart.js.
- **Backend**: Node.js, Express, MongoDB/Mongoose, Socket.io.
- **Services**: Twilio (SMS), Nodemailer (Email), AWS/S3 (Storage).
https://expo.dev/accounts/bharathan25/projects/3w-wheeler-expo/builds/45b6db1a-a2f2-48fc-9ca9-4309ee2ebc4c