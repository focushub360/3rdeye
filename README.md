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

## 🔑 Default & Active Credentials (Development)

### 🌐 Default/Offline Credentials (Hardcoded)

These credentials are pre-seeded or hardcoded for offline testing in the mobile application:

| User Role | Email / Login ID | Password | Registered Mobile |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin@focus.com` | `superadmin123#` | `+1234567890` |
| **Admin** | `admin@focus.com` | `admin123#` | `+1234567891` |
| **Teacher/Staff** | `teacher@focus.com` | `teacher123` | `+1234567892` |
| **Inspector (Default)** | `krishna@focusengineering.in` | `123456` | `+919486240282` |
| **Inspector (Alternative)** | `krishnaa@focusengineering.in` | `krish@123` | `+919486240282` |

### 📱 Active Database Credentials (Online)

These are the users currently registered in the active MongoDB database:

| Name | Username / Login ID | Email | Role | Password | Registered Mobile |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Super Admin** | `superadmin` | `superadmin@focus.com` | superadmin | `superadmin123#` / `Super@123` | *None* |
| **Krishna Inspector** | `krishna` | `krishna@focusengineering.in` | inspector | `123456` | *None* |
| **Krishna Inspector** | `krishnaa` | `krishnaa@focusengineering.in` | inspector | `krish@123` | *None* |
| **SRIMATHI SRIMATHI** | `smtsrimathii-srimathi-testing` | `smtsrimathii@gmail.com` | admin | `srimathi123` | *None* |
| **INSPECTOR INSPECTOR** | `PRIYADHARSHINI-INSP` | `inspector@gmail.com` | inspector | `123456` | `9688356144` |
| **System Admin** | `admin` | `admin@focus.com` | admin | `admin123#` | `+1234567891` |
| **John Doe** | `teacher1` | `teacher@focus.com` | teacher | `teacher123` | `+1234567892` |
| **Bharathan Rajkumar** | `bharathanvicky-srimathi-testing` | `bharathanvicky@gmail.com` | admin | `srimathi123` | `9894286683` |
| **vicky v** | `vicky` | `vicky@gmail.com` | inspector | `srimathi123` / `123456` | `9894286683` |
| **srimathi srimathi** | `srimathi-3w-wheeler-tvs` | `srimathi@gmail.com` | admin | `srimathi123` | *None* |

---

## 🙈 Git Ignore Setup (.gitignore)

The root repository and sub-projects are configured to ignore specific system, configuration, and build folders to keep version control clean:
- **`node_modules/`**: Third-party packages and dependencies.
- **`.env*`**: Secret environment files containing API keys, database connection strings, and credentials.
- **`dist/` & `build/`**: Compiled output directories.
- **`.mongodb_data/`**: Local database folder for MongoDB storage.
- **`node-dist/`**: Portable Node.js binaries.

---

## 📈 Technologies Used


- **Frontend**: React, Vite, TailwindCSS, Lucide Icons, Chart.js.
- **Backend**: Node.js, Express, MongoDB/Mongoose, Socket.io.
- **Services**: Twilio (SMS), Nodemailer (Email), AWS/S3 (Storage).
https://expo.dev/accounts/bharathan25/projects/3w-wheeler-expo/builds/45b6db1a-a2f2-48fc-9ca9-4309ee2ebc4c