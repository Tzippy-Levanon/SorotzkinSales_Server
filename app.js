import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();
import session from "express-session";

import { connectDB } from "./config/db.js";
connectDB();

import suppliersRoutes from "./api/routes/suppliers.routes.js";
import productsRoutes from "./api/routes/products.routes.js";
import salesRoutes from "./api/routes/sales.routes.js";
import reportsRouts from "./api/routes/reports.routes.js"
import errorMiddleware from "./api/middlewares/error.middleware.js";
import { handleUploadError } from "./api/middlewares/upload.middleware.js";

const app = express();
// הגדרות עבור קבצים סטטיים ב-ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// השורה הזו מאפשרת לגשת לקבצים בתיקיית uploads דרך הדפדפן 
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // true רק בפרודקשן עם https
  })
);

app.use("/api/suppliers", suppliersRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/reports", reportsRouts);

app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});

app.use(handleUploadError);
app.use(errorMiddleware);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
