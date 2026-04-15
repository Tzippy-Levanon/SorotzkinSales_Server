import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import cookieParser from 'cookie-parser';

import { connectDB } from "./config/db.js";
connectDB();

import './env.js';
import suppliersRoutes from "./api/routes/suppliers.routes.js";
import productsRoutes from "./api/routes/products.routes.js";
import salesRoutes from "./api/routes/sales.routes.js";
import reportsRouts from "./api/routes/reports.routes.js";
import paymentMethodsRoutes from "./api/routes/payment_methods.routs.js";
import authRoutes from './api/routes/auth.routes.js';
import errorMiddleware from "./api/middlewares/error.middleware.js";
import { handleUploadError } from "./api/middlewares/upload.middleware.js";
import requireAuth from './api/middlewares/auth.middleware.js';
import getSupabase from "./config/db.js";

const app = express();
// הגדרות עבור קבצים סטטיים ב-ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors({
  origin: process.env.CLIENT_URL ?? 'http://localhost:3000',
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// קבצי חשבוניות מוגשים מ-Supabase Storage (לא מהדיסק המקומי)
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: true, sameSite: 'none' }, // true רק בפרודקשן עם https
  })
);

app.get('/api/health', async (req, res) => {
  await getSupabase().from('suppliers').select('id').limit(1);
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/suppliers', requireAuth, suppliersRoutes);
app.use('/api/products', requireAuth, productsRoutes);
app.use('/api/sales', requireAuth, salesRoutes);
app.use('/api/reports', requireAuth, reportsRouts);
app.use('/api/paymentMethods', requireAuth, paymentMethodsRoutes);
app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

app.use(handleUploadError);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
