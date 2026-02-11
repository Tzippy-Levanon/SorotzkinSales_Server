import getSupabase from "../../config/db.js";

let _db;
const db = () => (_db ??= getSupabase());
const err = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

export const getAllSales = async (req, res, next) => {
    const { data, error } = await db()
        .from('sales_events')
        .select('*')
        .order('id', { ascending: false });
    if (error) return next(error);
    res.status(200).json(data);
};

export const addSale = async (req, res, next) => {
    const { name, date } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) return next(err('שם המכירה הוא שדה חובה'));
    if (date == null) return next(err('תאריך המכירה הוא שדה חובה'));

    const { data, error } = await db()
        .from('sale_events')
        .insert({ name: name.trim(), date: date, status: 'open' })
        .select()
        .single();
    if (error) return next(error);
    res.status(201).json(data);
};

export const addProductsToSale = async (req, res, next) => {
    const { saleId } = req.params;
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0)
        return next(err('יש לספק מערך של מוצרים'));

    const sale = await db().from('sale_events').select('id, status').eq('id', saleId).single();
    if (sale.error) return next(sale.error);
    if (!sale.data) return next(err('מכירה לא נמצאה', 404));
    if (sale.data.status !== 'open') return next(err('לא ניתן להוסיף מוצרים למכירה סגורה'));

    const items = [];
    for (const p of products) {
        const { product_id, quantity } = p;
        if (!product_id) return next(err('כל מוצר חייב לכלול product_id'));
        const qtyNum = quantity != null ? Number(quantity) : null;
        if (qtyNum != null && (isNaN(qtyNum) || qtyNum <= 0 || qtyNum !== Math.floor(qtyNum)))
            return next(err('הכמות חייבת להיות מספר שלם חיובי גדול מ- 0'));

        const product = await db().from('products').select('cost_price, selling_price, total_in_stock, is_active').eq('Id', product_id).single();
        if (product.error) return next(product.error);
        if (!product.data) return next(err(`מוצר ${product_id} לא נמצא`, 404));
        if (!product.data.is_active) return next(err(`לא ניתן להוסיף מוצר ${product_id} - המוצר אינו פעיל`));
        const available = product.data.total_in_stock ?? 0;
        const openingStock = qtyNum != null && qtyNum > 0 ? Math.min(qtyNum, available) : available;
        if (openingStock <= 0) return next(err(`אין מלאי למוצר ${product_id}`));

        items.push({
            sale_id: Number(saleId),
            product_id: Number(product_id),
            opening_stock: openingStock,
            sold_quantity: 0,
            remaining_quantity: openingStock,
            cost_price: product.data.cost_price,
            selling_price: product.data.selling_price,
        });
    }

    const { data, error } = await db().from('sale_items').insert(items).select();
    if (error) return next(error);
    res.status(201).json(data);
};

export const closeSale = async (req, res, next) => {
    const { saleId } = req.params;
    const { items } = req.body;

    const sale = await db().from('sale_events').select('id, status').eq('id', saleId).single();
    if (sale.error) return next(sale.error);
    if (!sale.data) return next(err('מכירה לא נמצאה', 404));
    if (sale.data.status === 'closed') return next(err('המכירה כבר סגורה'));

    const saleItems = await db().from('sale_items').select('id, product_id, opening_stock').eq('sale_id', saleId);
    if (saleItems.error) return next(saleItems.error);
    if (!saleItems.data?.length) return next(err('אין פריטים במכירה זו'));

    if (!items || !Array.isArray(items) || items.length === 0)
        return next(err('יש לספק כמות נותרת לכל הפריטים במכירה'));

    const remainingMap = {};
    products.forEach(it => {
        const key = it.product_id;
        const qty = Number(it.remaining_quantity);
        if (key && !isNaN(qty) && qty >= 0 && qty === Math.floor(qty)) { remainingMap[key] = qty; }
    });
   
    const missingIds = saleItems.data.filter(
        (item) => remainingMap[item.product_id] === undefined
    );
    if (missingIds.length > 0)
        return next(err(`חסרה כמות נותרת ל־ ${missingIds.length} פריטים במכירה`));

    for (const item of saleItems.data) {
        const remaining = remainingMap[item.product_id];
        if (remaining === undefined) continue;
        if (remaining > item.opening_stock)
            return next(err(`הכמות הנותרת של מוצר ${item.product_id} גדולה מהכמות שהייתה במכירה`));
        const sold = Math.max(0, item.opening_stock - remaining);

        const { data: prod } = await db().from('products').select('total_in_stock').eq('id', item.product_id).single();
        if (prod) {
            const newStock = Math.max(0, (prod.total_in_stock ?? 0) - sold);
            await db().from('products').update({ total_in_stock: newStock }).eq('id', item.product_id);
        }

        await db().from('sale_items').update({ sold_quantity: sold, remaining_quantity: remaining }).eq('id', item.id);
    }

    const { data: closed, error } = await db().from('sale_events').update({ status: 'closed' }).eq('id', saleId).select().single();
    if (error) return next(error);
    res.status(200).json(closed);
};
