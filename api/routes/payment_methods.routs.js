import express from "express";
import { getAllPaymentMethods } from "../controllers/payment_methods.controller.js";

const router = express.Router();

router.get('', getAllPaymentMethods);

export default router;
