import express from "express";
import { getAllProducts, updateProduct, addProduct } from '../controllers/products.controller.js'

const router = express.Router();

router.get('', getAllProducts);
router.post('', addProduct);
router.patch('/:id', updateProduct);

export default router;
