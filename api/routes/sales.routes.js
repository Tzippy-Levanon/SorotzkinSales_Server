import express from "express";
import { getAllSales, addSale, addProductsToSale, closeSale, removeSaleItem, deleteSale } from "../controllers/sales.controller.js";

const router = express.Router();

router.get("", getAllSales);
router.post("", addSale);
router.post("/addProductsToSale/:saleId/products", addProductsToSale);
router.patch("/:saleId/products", closeSale);
router.delete("/:saleId/products/:productId", removeSaleItem);
// DELETE /api/sales/:saleId — מחיקת מכירה פתוחה בלבד
router.delete('/:saleId', deleteSale);

export default router;
