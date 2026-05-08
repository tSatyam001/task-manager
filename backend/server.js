const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./src/config/db');

dotenv.config();

const app = express();

const envOrigins = [
  process.env.CLIENT_URL,
  ...(process.env.CLIENT_URLS || '').split(',')
].map((origin) => origin.trim()).filter(Boolean);

const allowedOrigins = [
  ...envOrigins,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
].filter(Boolean);

const vercelPreviewPattern = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i;

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || vercelPreviewPattern.test(origin)) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Team Task Manager API' });
});

app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/projects', require('./src/routes/projectRoutes'));
app.use('/api/tasks', require('./src/routes/taskRoutes'));
app.use('/api/dashboard', require('./src/routes/dashboardRoutes'));

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
