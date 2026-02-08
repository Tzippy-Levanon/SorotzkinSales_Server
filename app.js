import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
import session from "express-session";

import connectDB from "./config/db.js";
connectDB();

import suppliersRoutes from "./api/routes/suppliers.routes.js";
import productsRoutes from "./api/routes/products.routes.js";
import salesRoutes from "./api/routes/sales.routes.js";



const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.get("/", (req, res) => {
  res.send("🚀 Server is running");
});


// ================= ERROR HANDLER (בעתיד) =================

// import errorHandler from "./middlewares/errorHandler.js";
// app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
});
