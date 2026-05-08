# Team Task Manager

A full-stack task management app for teams. Users can sign up, log in, create projects, assign tasks, and track task progress.

## Features

- Signup, password login, OTP login, Google sign-in, and forgot-password reset
- Admin and Member roles
- Project creation and team member selection
- Task creation, assignment, priority, due date, and status updates
- Dashboard with project count, task count, status count, overdue tasks, and upcoming tasks
- REST APIs connected to MongoDB

## Tech Stack

- React
- HTML, CSS, JavaScript
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Email OTP delivery with SMTP

## Setup

Install backend packages:

```bash
cd backend
npm install
```

Create `.env` inside the backend folder and add:

```text
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CLIENT_URL=http://127.0.0.1:5173
GOOGLE_CLIENT_ID=your_google_oauth_client_id
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM="Task Manager <no-reply@example.com>"
```

SMTP is required for OTP login and forgot-password reset. OTPs are never returned to the browser.

Optional frontend `.env`. If omitted, the frontend reads `GOOGLE_CLIENT_ID` from the backend auth config endpoint.

```text
VITE_API_URL=http://127.0.0.1:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
```

Install frontend packages:

```bash
cd ../frontend
npm install
```

Start backend:

```bash
cd ../backend
npm run dev
```

Start frontend in another terminal:

```bash
cd ../frontend
npm run dev
```

Open the app:

```text
http://127.0.0.1:5173
```

## Role Access

- Admin can create, edit, and delete projects and tasks.
- Admin can add members to projects and assign tasks.
- Member can view assigned work and update task status.
