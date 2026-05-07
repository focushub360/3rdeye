# 3W Wheeler Project 🚀

A comprehensive form management and analytics system for 3W Wheeler TVS, featuring a powerful backend, a dynamic web frontend, and mobile capabilities.

## 📁 Project Structure

This repository is organized into the following main components:

- **Root Directory**: The primary web frontend project (React + Vite).
- **`3w-wheeler-backend/`**: Node.js/Express backend server with MongoDB integration.
- **`3W-WHEELERTVS-FRONTEND/`**: Primary frontend source folder.
- **`3w-wheeler-expo/`**: Mobile application built with Expo.

---

## 🚀 Getting Started

### 1. Backend Setup
Navigate to the backend directory and start the server:
```powershell
cd 3w-wheeler-backend
npm install
npm run init       # Initialize database roles and users
node server.js     # Start the backend server
```
*The backend runs on `http://localhost:5001`*

### 2. Frontend Setup
Run the web application from the root directory:
```powershell
npm install
npm run dev
```
*The frontend is available at `http://localhost:5173`*

---

## 🛠 Features

- **Form Management**: Create and manage complex inspection forms.
- **Real-time Analytics**: Visual dashboards for performance metrics.
- **Multi-tenant Support**: Managed access for different centers/teams.
- **Automated Notifications**: Integrated SMS and Email notifications.
- **Attendance & HR**: Built-in management for staff attendance and permissions.

## 🔑 Default Credentials (Development)

- **Superadmin**: `superadmin@focus.com` / `superadmin123#`
- **Admin**: `admin@focus.com` / `admin123#`
- **Teacher/Staff**: `teacher@focus.com` / `teacher123`

---

## 📈 Technologies Used


- **Frontend**: React, Vite, TailwindCSS, Lucide Icons, Chart.js.
- **Backend**: Node.js, Express, MongoDB/Mongoose, Socket.io.
- **Services**: Twilio (SMS), Nodemailer (Email), AWS/S3 (Storage).
https://expo.dev/accounts/bharathan25/projects/3w-wheeler-expo/builds/45b6db1a-a2f2-48fc-9ca9-4309ee2ebc4c