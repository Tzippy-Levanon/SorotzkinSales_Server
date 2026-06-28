import express from "express";
import { getInventoryReport, getSalesReport, getSuppliersReport } from "../controllers/reports.controller.js";

const router = express.Router();

router.get('/inventory', getInventoryReport);
router.get('/sales', getSalesReport);
router.get('/suppliers', getSuppliersReport);

export default router;
