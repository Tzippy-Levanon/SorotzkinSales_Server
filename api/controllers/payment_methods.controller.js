import getSupabase from "../../config/db.js";

let _db;
const db = () => (_db ??= getSupabase());

export const getAllPaymentMethods = async (req, res, next) => {
    const { data, error } = await db()
        .from('payment_methods')
        .select('*')
        .order('id', { ascending: true });

    if (error) return next(error);
    res.status(200).json(data);
};
