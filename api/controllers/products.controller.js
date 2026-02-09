import getSupabase from "../../config/db.js";

let _db;
const db = () => (_db ??= getSupabase());
const err = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

export const getAllProducts = async (req, res, next) => {
    const { data, error } = await db()
        .from('Products')
        .select('*, Suppliers(Name)')
        .order('Id', { ascending: true });
    if (error) return next(error);
    res.status(200).json(data);
};

export const updateProduct = async (req, res, next) => {
    const body = req.body;
    const updates = {};

    if (body.Name !== undefined) {
        if (!body.Name || typeof body.Name !== 'string' || !body.Name.trim())
            return next(err('שם המוצר חייב להיות מחרוזת לא ריקה'));
        updates.Name = body.Name.trim();
    }
    if (body.SupplierId !== undefined) updates.SupplierId = Number(body.SupplierId);
    if (body.CostPrice !== undefined) {
        const n = Number(body.CostPrice);
        if (isNaN(n) || n < 0) return next(err('מחיר העלות חייב להיות מספר חיובי'));
        updates.CostPrice = n;
    }
    if (body.SellingPrice !== undefined) {
        const n = Number(body.SellingPrice);
        if (isNaN(n) || n < 0) return next(err('מחיר המכירה חייב להיות מספר חיובי'));
        updates.SellingPrice = n;
    }
    if (body.TotalInStock !== undefined) {
        const n = Number(body.TotalInStock);
        if (isNaN(n) || n < 0 || n !== Math.floor(n))
            return next(err('הכמות במלאי חייבת להיות מספר שלם חיובי'));
        updates.TotalInStock = n;
    }
    if (body.IsActive !== undefined) updates.IsActive = Boolean(body.IsActive);

    if (Object.keys(updates).length === 0)
        return next(err('יש לספק לפחות שדה אחד לעדכון'));

    const { data, error } = await db().from('Products').update(updates).eq('Id', req.params.id).select().single();
    if (error) return next(error);
    if (!data) return next(err('מוצר לא נמצא', 404));
    res.status(200).json(data);
};

export const addProduct = async (req, res, next) => {
    const { Name, SupplierId, CostPrice, SellingPrice, IsActive = true, TotalInStock = 0 } = req.body;

    if (!Name || typeof Name !== 'string' || !Name.trim()) return next(err('שם המוצר הוא שדה חובה'));
    if (SupplierId == null) return next(err('מזהה הספק הוא שדה חובה'));
    if (CostPrice == null) return next(err('מחיר העלות הוא שדה חובה'));
    if (SellingPrice == null) return next(err('מחיר המכירה הוא שדה חובה'));

    const cost = Number(CostPrice);
    const selling = Number(SellingPrice);
    const stock = Number(TotalInStock) || 0;
    if (isNaN(cost) || cost < 0) return next(err('מחיר העלות חייב להיות מספר חיובי'));
    if (isNaN(selling) || selling < 0) return next(err('מחיר המכירה חייב להיות מספר חיובי'));
    if (isNaN(stock) || stock < 0 || stock !== Math.floor(stock))
        return next(err('הכמות במלאי חייבת להיות מספר שלם חיובי'));

    const { data, error } = await db()
        .from('Products')
        .insert({ Name: Name.trim(), SupplierId: Number(SupplierId), CostPrice: cost, SellingPrice: selling, IsActive: Boolean(IsActive), TotalInStock: stock })
        .select()
        .single();
    if (error) return next(error);
    res.status(201).json(data);
};
