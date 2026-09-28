# 3rd Eye (Focus 3rd Eye) 🚀

A comprehensive manufacturing inspection, form management, and quality analytics system (Focus 3rd Eye / 3rdeye), featuring a powerful backend, dynamic web frontend, and factory-floor mobile client.

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


### 3. Mobile App (Expo)

Start the backend first, then run the Expo development server:

```powershell
cd mobile-expo
npm install
npm run start -- --lan
```

Install **Expo Go** on your Android or iOS device, connect it to the same Wi-Fi network as this computer, and scan the QR code shown in the terminal. If a QR code is unavailable, open the displayed `exp://...` URL in Expo Go.

Useful commands:

```powershell
npm run android  # Run on a connected Android emulator/device
npm run ios      # Run on iOS (macOS only)
npm run web      # Run in a browser
```
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

## ☁️ AWS Setup (S3 + CloudFront)

The backend uses **AWS S3** for file storage and **AWS CloudFront** as a CDN to serve uploaded files. Follow these steps to set it up.

### 1. Create an S3 Bucket

1. Log in to the [AWS Console](https://console.aws.amazon.com/).
2. Go to **S3** → **Create bucket**.
3. Choose a bucket name (e.g., `ib-project`) and select the region **`ap-south-1`** (Mumbai).
4. **Uncheck** "Block all public access" (CloudFront will handle access control via OAC).
5. Enable **Versioning** (optional but recommended).
6. Click **Create bucket**.

#### Bucket CORS Policy

Add the following CORS configuration under **Permissions → Cross-origin resource sharing (CORS)**:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://servicerequests.netlify.app",
      "https://formsuperadmin.focusengineeringapp.com"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

---

### 2. Create an IAM User & Access Keys

1. Go to **IAM** → **Users** → **Create user**.
2. Choose a name (e.g., `3w-wheeler-s3-user`), do **not** enable console access.
3. Attach the following inline policy (or create a managed policy):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::ib-project",
        "arn:aws:s3:::ib-project/*"
      ]
    }
  ]
}
```

4. After creating the user, go to **Security credentials** → **Create access key**.
5. Choose **Application running outside AWS**, then copy the **Access Key ID** and **Secret Access Key**.

---

### 3. Create a CloudFront Distribution

1. Go to **CloudFront** → **Create distribution**.
2. Under **Origin domain**, select your S3 bucket (`ib-project.s3.ap-south-1.amazonaws.com`).
3. Under **Origin access**, select **Origin access control (OAC)** and create a new OAC.
4. Set **Viewer protocol policy** to **Redirect HTTP to HTTPS**.
5. Under **Cache policy**, use **CachingDisabled** for development or **CachingOptimized** for production.
6. Click **Create distribution** and note the **Distribution domain name** (e.g., `d196xvstj956a9.cloudfront.net`).
7. After creation, go to your S3 bucket → **Permissions → Bucket policy** and paste the policy that AWS auto-generates for the OAC.

---

### 4. Configure Environment Variables

Add the following variables to your `3w-wheeler-backend/.env` file:

```env
# --- AWS S3 Configuration ---
AWS_ACCESS_KEY_ID=your_iam_access_key_id
AWS_SECRET_ACCESS_KEY=your_iam_secret_access_key
AWS_S3_REGION=ap-south-1
AWS_S3_BUCKET=ib-project

# --- AWS CloudFront ---
AWS_CLOUDFRONT_DOMAIN=d196xvstj956a9.cloudfront.net
CLOUDFRONT_URL=https://d196xvstj956a9.cloudfront.net
```

| Variable | Description |
| :--- | :--- |
| `AWS_ACCESS_KEY_ID` | IAM user access key ID |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret access key |
| `AWS_S3_REGION` | AWS region of your S3 bucket (default: `ap-south-1`) |
| `AWS_S3_BUCKET` | S3 bucket name (default: `ib-project`) |
| `AWS_CLOUDFRONT_DOMAIN` | CloudFront distribution domain (without `https://`) |
| `CLOUDFRONT_URL` | Full CloudFront URL (used for CORS allow-list) |

---

### 5. How File Uploads Work

The backend uses a **presigned URL** flow so files are uploaded directly from the client to S3:

```
Client → POST /api/upload/presigned-url → Backend
Backend → generates S3 presigned URL (valid 15 min) → Client
Client → PUT <presigned-url> (uploads file directly to S3)
File is served publicly via CloudFront CDN
```

- **Upload endpoint**: `POST /api/upload/presigned-url`
- **Supported file types**: images (jpg, png, gif, webp, svg), pdf, documents (doc, docx, xls, xlsx), video (mp4), audio (mp3), zip, csv, txt
- **Max file size**: 10 MB
- **Folder structure in S3**: `focus_forms/<category>/<userId>/<filename>_<timestamp>_<uuid>.<ext>`

---

## 📈 Technologies Used


- **Frontend**: React, Vite, TailwindCSS, Lucide Icons, Chart.js.
- **Backend**: Node.js, Express, MongoDB/Mongoose, Socket.io.
- **Services**: Twilio (SMS), Nodemailer (Email), AWS/S3 (Storage).
https://expo.dev/accounts/bharathan25/projects/3w-wheeler-expo/builds/45b6db1a-a2f2-48fc-9ca9-4309ee2ebc4c