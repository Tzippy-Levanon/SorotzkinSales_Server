import getSupabase from "../../config/db.js";

let _db;
const db = () => (_db ??= getSupabase());
const err = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

export const getAllProducts = async (req, res, next) => {
    const { data, error } = await db()
        .from('products')
        .select('*, suppliers(name)')
        .order('id', { ascending: true });
    if (error) return next(error);
    res.status(200).json(data);
};

export const updateProduct = async (req, res, next) => {
    const body = req.body;
    const updates = {};

    if (body.name !== undefined) {
        if (!body.name || typeof body.name !== 'string' || !body.name.trim())
            return next(err('שם המוצר חייב להיות מחרוזת לא ריקה'));
        updates.name = body.name.trim();
    }
    if (body.supplier_id !== undefined) updates.supplier_id = Number(body.supplier_id);
    if (body.cost_price !== undefined) {
        const price = Number(body.cost_price);
        if (isNaN(price) || price < 0) return next(err('מחיר העלות חייב להיות מספר חיובי'));
        updates.cost_price = price;
    }
    if (body.selling_price !== undefined) {
        const price = Number(body.selling_price);
        if (isNaN(price) || price < 0) return next(err('מחיר המכירה חייב להיות מספר חיובי'));
        updates.selling_price = price;
    }
    if (body.total_in_stock !== undefined) {
        const stock = Number(body.total_in_stock);
        if (isNaN(stock) || stock < 0 || stock !== Math.floor(stock))
            return next(err('הכמות במלאי חייבת להיות מספר שלם חיובי'));
        updates.total_in_stock = stock;
    }
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

    if (Object.keys(updates).length === 0)
        return next(err('יש לספק לפחות שדה אחד לעדכון'));

    const { data, error } = await db().from('products').update(updates).eq('id', req.params.id).select().single();
    if (error) return next(error);
    if (!data) return next(err('מוצר לא נמצא', 404));
    res.status(200).json(data);
};

export const addProduct = async (req, res, next) => {
    const { name, supplier_id, cost_price, selling_price, is_active = true, total_in_stock = 0 } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) return next(err('שם המוצר הוא שדה חובה'));
    if (supplier_id == null) return next(err('מזהה הספק הוא שדה חובה'));
    if (cost_price == null) return next(err('מחיר העלות הוא שדה חובה'));
    if (selling_price == null) return next(err('מחיר המכירה הוא שדה חובה'));

    const cost = Number(cost_price);
    const selling = Number(selling_price);
    const stock = Number(total_in_stock) || 0;
    if (isNaN(cost) || cost < 0) return next(err('מחיר העלות חייב להיות מספר חיובי'));
    if (isNaN(selling) || selling < 0) return next(err('מחיר המכירה חייב להיות מספר חיובי'));
    if (isNaN(stock) || stock < 0 || stock !== Math.floor(stock))
        return next(err('הכמות במלאי חייבת להיות מספר שלם חיובי'));

    const { data, error } = await db()
        .from('products')
        .insert({ name: name.trim(), supplier_id: Number(supplier_id), cost_price: cost, selling_price: selling, is_active: Boolean(is_active), total_in_stock: stock })
        .select()
        .single();
    if (error) return next(error);
    res.status(201).json(data);
};
