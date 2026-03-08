import express from "express";
import {
    addSupplier, getAllSuppliers, getSupplierBalance, getSupplierPayments, recordPayment,
    recordStockArrival, updateSupplier, uploadInvoice
} from "../controllers/suppliers.controller.js";
import upload from "../middlewares/upload.middleware.js";

const router = express.Router();

router.get('', getAllSuppliers);
router.get('/supplierBalance/:supplier_id', getSupplierBalance);
router.get('/:supplier_id/payments', getSupplierPayments);
router.post('', addSupplier);
router.post('/recordStockArrival', recordStockArrival);
router.post('/recordPayment', recordPayment);
router.post('/uploadInvoice', upload.single('file'), uploadInvoice);
router.patch('/:id', updateSupplier);

export default router;
