import express from "express";
import { getInventoryReport, getSalesReport, getSuppliersReport } from "../controllers/reports.controller.js";

const router = express.Router();

// 1. דוח מלאי נוכחי
// URL: /api/reports/inventory
router.get('/inventory', getInventoryReport);

// 2. דוח מכירות (כללי או לפי ID)
// URL: /api/reports/sales  או  /api/reports/sales?sale_id=1
router.get('/sales', getSalesReport);

// 3. דוח יתרות ספקים
// URL: /api/reports/suppliers
router.get('/suppliers', getSuppliersReport);

export default router;
