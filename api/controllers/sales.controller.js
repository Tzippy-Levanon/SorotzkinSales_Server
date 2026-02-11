import getSupabase from "../../config/db.js";

let _db;
const db = () => (_db ??= getSupabase());
const err = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

export const getAllSales = async (req, res, next) => {
    const { data, error } = await db()
        .from('SaleEvents')
        .select('*')
        .order('Id', { ascending: false });
    if (error) return next(error);
    res.status(200).json(data);
};

export const addSale = async (req, res, next) => {
    const { Name, Date } = req.body;

    if (!Name || typeof Name !== 'string' || !Name.trim()) return next(err('שם המכירה הוא שדה חובה'));
    if (Date == null) return next(err('תאריך המכירה הוא שדה חובה'));

    const { data, error } = await db()
        .from('SaleEvents')
        .insert({ Name: Name.trim(), Date: Date, Status: 'open' })
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

    const sale = await db().from('SaleEvents').select('Id, Status').eq('Id', saleId).single();
    if (sale.error) return next(sale.error);
    if (!sale.data) return next(err('מכירה לא נמצאה', 404));
    if (sale.data.Status !== 'open') return next(err('לא ניתן להוסיף מוצרים למכירה סגורה'));

    const items = [];
    for (const p of products) {
        const { ProductId, Quantity } = p;
        if (!ProductId) return next(err('כל מוצר חייב לכלול ProductId'));
        const qtyNum = Quantity != null ? Number(Quantity) : null;
        if (qtyNum != null && (isNaN(qtyNum) || qtyNum <= 0 || qtyNum !== Math.floor(qtyNum)))
            return next(err('הכמות חייבת להיות מספר שלם חיובי גדול מ- 0'));

        const product = await db().from('Products').select('CostPrice, SellingPrice, TotalInStock, IsActive').eq('Id', ProductId).single();
        if (product.error) return next(product.error);
        if (!product.data) return next(err(`מוצר ${ProductId} לא נמצא`, 404));
        if (!product.data.IsActive) return next(err(`לא ניתן להוסיף מוצר ${ProductId} - המוצר אינו פעיל`));
        const available = product.data.TotalInStock ?? 0;
        const openingStock = qtyNum != null && qtyNum > 0 ? Math.min(qtyNum, available) : available;
        if (openingStock <= 0) return next(err(`אין מלאי למוצר ${ProductId}`));

        items.push({
            SaleId: Number(saleId),
            ProductId: Number(ProductId),
            OpeningStock: openingStock,
            SoldQuantity: 0,
            RemainingQuantity: openingStock,
            CostPrice: product.data.CostPrice,
            SellingPrice: product.data.SellingPrice,
        });
    }

    const { data, error } = await db().from('SaleItems').insert(items).select();
    if (error) return next(error);
    res.status(201).json(data);
};

export const closeSale = async (req, res, next) => {
    const { saleId } = req.params;
    const { items } = req.body;

    const sale = await db().from('SaleEvents').select('Id, Status').eq('Id', saleId).single();
    if (sale.error) return next(sale.error);
    if (!sale.data) return next(err('מכירה לא נמצאה', 404));
    if (sale.data.Status === 'closed') return next(err('המכירה כבר סגורה'));

    const saleItems = await db().from('SaleItems').select('Id, ProductId, OpeningStock').eq('SaleId', saleId);
    if (saleItems.error) return next(saleItems.error);
    if (!saleItems.data?.length) return next(err('אין פריטים במכירה זו'));

    if (!items || !Array.isArray(items) || items.length === 0)
        return next(err('יש לספק כמות נותרת לכל הפריטים במכירה'));

    const remainingMap = {};
    for (const it of items) {
        if (it.SaleItemId != null || it.ProductId != null) {
            const key = it.SaleItemId ?? it.ProductId;
            const qty = Number(it.RemainingQuantity);
            if (!isNaN(qty) && qty >= 0 && qty === Math.floor(qty)) remainingMap[key] = qty;
        }
    }

    const missingIds = saleItems.data.filter(
        (item) => remainingMap[item.Id] === undefined && remainingMap[item.ProductId] === undefined
    );
    if (missingIds.length > 0)
        return next(err(`חסרה כמות נותרת ל־ ${missingIds.length} פריטים במכירה`));

    for (const item of saleItems.data) {
        const remaining = remainingMap[item.Id] ?? remainingMap[item.ProductId];
        if (remaining > item.OpeningStock)
            return next(err(`הכמות הנותרת של מוצר ${item.ProductId} גדולה מהכמות שהייתה במכירה`));
        const sold = Math.max(0, item.OpeningStock - remaining);

        const { data: prod } = await db().from('Products').select('TotalInStock').eq('Id', item.ProductId).single();
        if (prod) {
            const newStock = Math.max(0, (prod.TotalInStock ?? 0) - sold);
            await db().from('Products').update({ TotalInStock: newStock }).eq('Id', item.ProductId);
        }

        await db().from('SaleItems').update({ SoldQuantity: sold, RemainingQuantity: remaining }).eq('Id', item.Id);
    }

    const { data: closed, error } = await db().from('SaleEvents').update({ Status: 'closed' }).eq('Id', saleId).select().single();
    if (error) return next(error);
    res.status(200).json(closed);
};
