import getSupabase from "../../config/db.js";

let _db;
const db = () => (_db ??= getSupabase());
const err = (msg, code = 400) => Object.assign(new Error(msg), { statusCode: code });

// 1. קבלת רשימת ספקים
export const getAllSuppliers = async (req, res, next) => {
    const { data, error } = await db()
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });

    if (error) return next(error);
    res.status(200).json(data);
};

// 2. הוספת ספק
export const addSupplier = async (req, res, next) => {
    const { name, phone, email, company_name } = req.body;

    // 1. ניקוי וולידציה ראשונית 
    const cleanName = name?.trim();
    const cleanPhone = phone?.trim();
    const cleanEmail = email?.trim();

    if (!cleanName) return next(err('שם הספק הוא שדה חובה'));
    if (!cleanPhone && !cleanEmail) return next(err('חובה לספק לפחות צורת התקשרות אחת (טלפון או מייל)'));

    // 2. הבדיקה המאוחדת והחכמה (השימוש ב-OR) // אנחנו בודקים: האם יש מישהו עם השם הזה, שיש לו את הטלפון הזה או את המייל הזה? 
    const { data: existing, error: checkErr } = await db()
        .from('suppliers')
        .select('id')
        .eq('name', cleanName)
        .or(`phone.eq.${cleanPhone},email.eq.${cleanEmail}`)
        .maybeSingle();

    if (checkErr) return next(checkErr);
    if (existing) return next(err('כבר קיים ספק במערכת עם שם זהה ופרטי התקשרות אלו', 409));

    // 3. הכנת האובייקט להזרקה (Sanitization) 
    const supplierData = { name: cleanName };
    if (cleanPhone) supplierData.phone = cleanPhone;
    if (cleanEmail) supplierData.email = cleanEmail;
    if (company_name) supplierData.company_name = company_name.trim();

    // 4. ביצוע ההוספה 
    const { data, error } = await db()
        .from('suppliers')
        .insert(supplierData)
        .select()
        .single();

    if (error) return next(error);
    res.status(201).json(data);
};

// 3. רישום הגעת סחורה מהספק
export const recordStockArrival = async (req, res, next) => {
    const { supplier_id, products, arrival_date, notes } = req.body;

    // בדיקות קלט
    if (!supplier_id) return next(err('מזהה הספק הוא שדה חובה'));
    if (!products || !Array.isArray(products) || products.length === 0) return next(err('יש לספק מערך של מוצרים'));
    if (!arrival_date) return next(err('תאריך ההגעה הוא שדה חובה'));

    // בדיקה שהספק קיים
    const { data: supplier, error: supplierErr } = await db()
        .from('suppliers')
        .select('id, balance')
        .eq('id', supplier_id)
        .single();

    if (supplierErr || !supplier) return next(err('ספק לא נמצא', 404));

    // שליפת כל המוצרים הרלוונטיים
    const productIds = products.map(p => p.product_id);
    const { data: dbProducts, error: prodErr } = await db()
        .from('products')
        .select('id, cost_price, total_in_stock, is_active, supplier_id')
        .in('id', productIds);

    if (prodErr) return next(prodErr);

    // בדיקה שכל המוצרים קיימים
    for (const p of products) {
        const dbProd = dbProducts.find(dbP => dbP.id === p.product_id);
        if (!dbProd) return next(err(`מוצר ${p.product_id} לא קיים במערכת`));

        // בדיקה שהמוצר שייך לספק הנכון
        if (dbProd.supplier_id !== supplier_id) return next(err(`מוצר ${p.product_id} לא שייך לספק ${supplier_id}`));

        // בדיקת כמות
        const quantity = Number(p.quantity);
        if (isNaN(quantity) || quantity <= 0 || quantity !== Math.floor(quantity))
            return next(err(`כמות המוצר ${p.product_id} חייבת להיות מספר שלם חיובי`));
    }

    // חישוב סך החוב
    let totalBalance = 0;
    const stockItems = [];

    for (const p of products) {
        const dbProd = dbProducts.find(dbP => dbP.id === p.product_id);
        const quantity = p.quantity;
        const itemCost = p.cost_price * quantity;
        totalBalance += itemCost;

        // עדכון המלאי במוצר
        const newStock = dbProd.total_in_stock + quantity;
        const updateData = { total_in_stock: newStock };

        // אם המוצר לא פעיל - להפוך אותו לפעיל
        if (!dbProd.is_active)
            updateData.is_active = true;

        if (p.cost_price && p.cost_price != dbProd.cost_price)
            updateData.cost_price = p.cost_price;

        const { error: updateErr } = await db()
            .from('products')
            .update(updateData)
            .eq('id', p.product_id);

        if (updateErr) return next(updateErr);

        // הכנת נתוני פריט להכנסה לטבלת stock_arrival_items
        stockItems.push({
            product_id: p.product_id,
            quantity: quantity,
            cost_price: dbProd.cost_price
        });
    }

    // יצירת רשומת הגעת סחורה
    const { data: arrival, error: arrivalErr } = await db()
        .from('stock_arrivals')
        .insert({
            supplier_id: supplier_id,
            arrival_date: arrival_date,
            notes: notes || null
        })
        .select()
        .single();

    if (arrivalErr) return next(arrivalErr);

    // הוספת מזהה ההגעה לכל פריט
    const itemsToInsert = stockItems.map(item => ({
        ...item,
        stock_arrival_id: arrival.id
    }));

    // הכנסת הפריטים לטבלה
    const { error: itemsErr } = await db()
        .from('stock_arrival_items')
        .insert(itemsToInsert);

    if (itemsErr) return next(itemsErr);

    // עדכון החוב בטבלת supplier_invoices
    const { data: balance, error: balanceErr } = await db()
        .from('suppliers')
        .update({ balance: supplier.balance + totalBalance })
        .eq('id', supplier_id)
        .select()
        .single();

    if (balanceErr) return next(balanceErr);

    res.status(201).json({
        message: 'הסחורה נרשמה בהצלחה, החוב והמלאי עודכנו',
        arrival: arrival,
        total_Balance: totalBalance,
        invoice_id: balance.id
    });
};

// 4. רישום תשלום לספק
export const recordPayment = async (req, res, next) => {
    const { supplier_id, amount, date, payment_method_id } = req.body;

    // בדיקות קלט
    if (!supplier_id) return next(err('מזהה הספק הוא שדה חובה'));
    if (amount == null) return next(err('סכום התשלום הוא שדה חובה'));
    if (!date) return next(err('תאריך התשלום הוא שדה חובה'));
    if (!payment_method_id) return next(err('אמצעי התשלום הוא שדה חובה'));

    const paymentAmount = Number(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) return next(err('סכום התשלום חייב להיות מספר חיובי'));

    // בדיקה שהספק קיים
    const { data: supplier, error: supplierErr } = await db()
        .from('suppliers')
        .select('id, balance')
        .eq('id', supplier_id)
        .single();

    if (supplierErr || !supplier) return next(err('ספק לא נמצא', 404));

    // בדיקה שאמצעי התשלום קיים
    const { data: paymentMethod, error: pmErr } = await db()
        .from('payment_methods')
        .select('id')
        .eq('id', payment_method_id)
        .single();

    if (pmErr || !paymentMethod) return next(err('אמצעי תשלום לא נמצא', 404));

    // רישום התשלום
    const { data: payment, error: paymentErr } = await db()
        .from('supplier_payments')
        .insert({
            supplier_id: supplier_id,
            amount: paymentAmount,
            date: date,
            payment_method_id: payment_method_id
        })
        .select()
        .single();

    if (paymentErr) return next(paymentErr);

    const { error: ubErr } = await db()
        .from('suppliers')
        .update({ balance: supplier.balance - paymentAmount })
        .eq('id', supplier_id);

    if (ubErr) return next(ubErr);

    res.status(201).json({
        message: 'התשלום נרשם בהצלחה',
        payment: payment
    });
};

// 5. העלאת חשבונית/קבלה לספק
export const uploadInvoice = async (req, res, next) => {
    const { supplier_payment_id, amount, reference_number } = req.body;

    // הקובץ צריך להיות ב-req.file (multer middleware)
    if (!req.file) return next(err('לא הועלה קובץ'));

    const fileUrl = req.file.path || req.file.filename; // תלוי בהגדרת multer

    // עדכון ה-URL של החשבונית
    const { data, error } = await db()
        .from('supplier_invoices')
        .insert({
            file_url: fileUrl,
            amount: amount ? Number(amount) : null, // סכום החשבונית הספציפית
            reference_number: reference_number || null, // מספר חשבונית מהספק
            supplier_payment_id: supplier_payment_id || null // קישור לתשלום (אופציונלי)
        })
        .select()
        .single();

    if (error) return next(error);
    if (!data) return next(err('חשבונית לא נמצאה', 404));

    res.status(200).json({
        message: 'הקובץ הועלה בהצלחה',
        invoice: data
    });
};

// 6. הצגת חוב נוכחי לספק
export const getSupplierBalance = async (req, res, next) => {
    const { supplier_id } = req.params;

    // בדיקה שהספק קיים
    const { data: supplier, error: err } = await db()
        .from('suppliers')
        .select('id, name, balance')
        .eq('id', supplier_id)
        .single();

    if (err || !supplier) return next(err('ספק לא נמצא'));

    res.status(200).json({
        supplier_name: supplier.name,
        balance: supplier.balance
    });
};

export const getSupplierPayments = async (req, res, next) => {
    const { supplier_id } = req.params;

    // שליפת כל התשלומים של הספק + אמצעי תשלום + חשבונית מקושרת
    const { data, error } = await db()
        .from('supplier_payments')
        .select('id, amount, date, payment_methods ( name ), supplier_invoices ( file_url, amount, reference_number )')
        .eq('supplier_id', supplier_id)
        .order('date', { ascending: false });

    if (error) return next(error);

    // עיצוב התוצאה להיות נוחה ללקוח
    const formatted = (data || []).map(p => ({
        id: p.id,
        amount: p.amount,
        date: p.date,
        payment_method: p.payment_methods,
        invoices: p.supplier_invoices || [],  // כל החשבוניות
    }));

    res.status(200).json(formatted);
};
