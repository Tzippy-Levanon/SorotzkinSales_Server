import express from "express";
import { getAllProducts, updateProduct, addProduct, getProductArrivals } from '../controllers/products.controller.js'

const router = express.Router();

router.get('', getAllProducts);
router.get('/:id/arrivals', getProductArrivals);
router.post('', addProduct);
router.patch('/:id', updateProduct);

export default router;
