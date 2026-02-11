import express from "express";
import { getAllSales, addSale, addProductsToSale, closeSale } from "../controllers/sales.controller.js";

const router = express.Router();

router.get("", getAllSales);
router.post("", addSale);
router.post("/:saleId/products", addProductsToSale);
router.patch("/:saleId/close", closeSale);

export default router;
