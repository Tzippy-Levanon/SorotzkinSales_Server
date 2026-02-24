import express from "express";
import { getAllSales, addSale, addProductsToSale, closeSale, removeSaleItem } from "../controllers/sales.controller.js";

const router = express.Router();

router.get("", getAllSales);
router.post("", addSale);
router.post("/addProductsToSale/:saleId/products", addProductsToSale);
router.delete("/:saleId/products/:productId", removeSaleItem);
router.patch("/:saleId/products", closeSale);

export default router;
