import getSupabase from "../../config/db.js";

let _db;
const db = () => (_db ??= getSupabase());
const err = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

export const getAllSales = async (req, res, next) => {
    const { data, error } = await db()
        .from('sales_events')
        .select('*')
        .order('date', { ascending: false });

    if (error) return next(error);
    res.status(200).json(data);
};

export const addSale = async (req, res, next) => {
    const { name, date } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) return next(err('שם המכירה הוא שדה חובה'));
    if (date == null) return next(err('תאריך המכירה הוא שדה חובה'));

    const { data, error } = await db()
        .from('sales_events')
        .insert({ name: name.trim(), date: date, status: 'open' })
        .select()
        .single();

    if (error) return next(error);
    res.status(201).json(data);
};

export const addProductsToSale = async (req, res, next) => {
    const { saleId } = req.params;
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) return next(err('יש לספק מערך של מוצרים'));

    const { data: sale, error: saleErr } = await db()
        .from('sales_events').select('status')
        .eq('id', saleId)
        .single();

    if (saleErr || !sale) return next(err('מכירה לא נמצאה', 404));
    if (sale.status !== 'open') return next(err('המכירה סגורה לשינויים'));

    const productIds = products.map(p => p.product_id);
    const { data: dbProducts, error: prodErr } = await db()
        .from('products')
        .select('id, cost_price, selling_price, total_in_stock, is_active')
        .in('id', productIds);

    if (prodErr) return next(prodErr);

    const { data: existingItems } = await db()
        .from('sale_items')
        .select('product_id, opening_stock')
        .eq('sale_id', saleId);

    const itemsToInsert = [];

    for (const p of products) {
        const dbProd = dbProducts.find(dbP => dbP.id === p.product_id);
        if (!dbProd) return next(err(`מוצר ${p.product_id} לא קיים במערכת`));
        if (!dbProd.is_active) return next(err(`מוצר ${p.product_id} אינו פעיל`));

        const existing = existingItems?.find(ei => ei.product_id === p.product_id);
        const currentInSale = existing ? existing.opening_stock : 0;
        const totalRequested = currentInSale + p.quantity;

        if (totalRequested > dbProd.total_in_stock) {
            return next(err(`חוסר במלאי למוצר ${p.product_id}. במלאי: ${dbProd.total_in_stock}, במכירה כבר יש: ${currentInSale} מהמוצר.`));
        }

        if (existing) {
            const { error: updErr } = await db()
                .from('sale_items')
                .update({ opening_stock: totalRequested, remaining_quantity: totalRequested })
                .eq('sale_id', saleId).eq('product_id', p.product_id);

            if (updErr) return next(updErr);
        }
        else {
            itemsToInsert.push({
                sale_id: saleId, product_id: p.product_id, opening_stock: p.quantity, remaining_quantity: p.quantity,
                cost_price: dbProd.cost_price, selling_price: dbProd.selling_price, sold_quantity: 0
            });
        }
    }

    if (itemsToInsert.length > 0) {
        const { data, error } = await db()
            .from('sale_items')
            .insert(itemsToInsert)
            .select();

        if (error) return next(error);
        return res.status(201).json({ message: 'המוצרים נוספו/עודכנו בהצלחה', data });
    }

    res.status(200).json({ message: 'כמויות המוצרים עודכנו בהצלחה' });
};

// DELETE /api/sales/:saleId/products/:productId
// מסיר מוצר ספציפי ממכירה פתוחה
export const removeSaleItem = async (req, res, next) => {
    const { saleId, productId } = req.params;

    // וודא שהמכירה קיימת ופתוחה
    const { data: sale, error: saleErr } = await db()
        .from('sales_events').select('status').eq('id', saleId).single();
    if (saleErr || !sale) return next(err('מכירה לא נמצאה', 404));
    if (sale.status !== 'open') return next(err('לא ניתן לשנות מכירה סגורה'));

    // מחק את הפריט
    const { error: delErr } = await db()
        .from('sale_items')
        .delete()
        .eq('sale_id', saleId)
        .eq('product_id', productId);

    if (delErr) return next(delErr);
    res.status(200).json({ message: 'המוצר הוסר מהמכירה' });
};

export const closeSale = async (req, res, next) => {
    const { saleId } = req.params;
    const { products } = req.body;

    // 1. בדיקת סטטוס המכירה 
    const { data: sale, error: saleErr } = await db()
        .from('sales_events')
        .select('status')
        .eq('id', saleId)
        .single();

    if (saleErr || !sale) return next(err('מכירה לא נמצאה', 404));
    if (sale.status === 'closed') return next(err('המכירה כבר סגורה'));

    // 2. שליפת כל הפריטים ששויכו למכירה הזו 
    const { data: saleItems, error: itemsErr } = await db()
        .from('sale_items')
        .select('id, product_id, opening_stock')
        .eq('sale_id', saleId);

    if (itemsErr || !saleItems?.length) return next(err('אין פריטים במכירה זו'));

    // 3. שליפת המלאי הנוכחי של כל המוצרים הרלוונטיים (Batch Fetch) 
    const productIds = saleItems.map(si => si.product_id);
    const { data: dbProducts } = await db()
        .from('products')
        .select('id, total_in_stock')
        .in('id', productIds);

    // 4. הכנת רשימת העדכונים בזיכרון 
    const remainingMap = {};
    products.forEach(it => { remainingMap[it.product_id] = Number(it.remaining_quantity); });

    // 5. לולאת חישובים ועדכונים 
    for (const item of saleItems) {
        const remaining = remainingMap[item.product_id];
        if (remaining === undefined) return next(err(`חסר דיווח כמות למוצר ${item.product_id}`));
        if (remaining > item.opening_stock) return next(err(`הכמות שנותרה למוצר ${item.product_id} גדולה מהכמות ההתחלתית`));

        const sold = item.opening_stock - remaining;
        const dbProd = dbProducts?.find(p => p.id === item.product_id);
        const currentTotalInStock = dbProd?.total_in_stock ?? 0;

        // עדכון המלאי הכללי בטבלת המוצרים 
        const { error: pErr } = await db()
            .from('products')
            .update({ total_in_stock: Math.max(0, currentTotalInStock - sold) })
            .eq('id', item.product_id);

        if (pErr) return next(pErr);

        // עדכון נתוני המכירה בטבלת פריטי המכירה 
        const { error: siErr } = await db()
            .from('sale_items')
            .update({ sold_quantity: sold, remaining_quantity: remaining })
            .eq('id', item.id);

        if (siErr) return next(siErr);
    }

    // 6. סגירת המכירה עצמה 
    const { data: closed, error: closeErr } = await db()
        .from('sales_events').update({ status: 'closed' })
        .eq('id', saleId)
        .select()
        .single();

    if (closeErr) return next(closeErr);

    res.status(200).json({ message: 'המכירה נסגרה והמלאי עודכן', data: closed });
};

export const deleteSale = async (req, res, next) => {
    const { saleId } = req.params;

    const { data: sale, error: saleErr } = await db()
        .from('sales_events')
        .select('status')
        .eq('id', saleId)
        .single();

    if (saleErr || !sale) return next(err('מכירה לא נמצאה', 404));
    if (sale.status === 'closed') return next(err('לא ניתן למחוק מכירה סגורה', 400));

    // מחיקת פריטי המכירה קודם (foreign key)
    const { error: itemsErr } = await db()
        .from('sale_items')
        .delete()
        .eq('sale_id', saleId);

    if (itemsErr) return next(itemsErr);

    const { error: delErr } = await db()
        .from('sales_events')
        .delete()
        .eq('id', saleId);

    if (delErr) return next(delErr);

    res.status(200).json({ message: 'המכירה נמחקה בהצלחה' });
};
