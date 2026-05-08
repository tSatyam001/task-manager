# Team Task Manager

A full-stack task management app for teams. Users can sign up, log in, create projects, assign tasks, and track task progress.

## Features

- Signup and login
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
