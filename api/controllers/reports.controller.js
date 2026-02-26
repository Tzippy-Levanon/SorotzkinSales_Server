import getSupabase from "../../config/db.js";
import ExcelJS from 'exceljs';

let _db;
const db = () => (_db ??= getSupabase());

const ILS_FORMAT = '"₪" #,##0.00';

// עמודות שמכילות ערכי כסף — לפי שם ה-key בכל דוח
const CURRENCY_KEYS = new Set([
    'מחיר עלות', 'מחיר מכירה',
    'סה"כ מחיר עלות', 'סה"כ מחיר מכירה',
    'רווח', 'יתרת חוב', 'סה"כ ערך מלאי'
]);

const sendExcel = async (res, columns, rows, summaryRow, fileName) => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Data', {
        views: [{ state: 'frozen', ySplit: 1, rightToLeft: true }]
    });

    // הגדרת עמודות
    worksheet.columns = columns.map(col => ({
        header: col.header,
        key: col.key,
        width: 20
    }));

    // הוספת נתונים
    worksheet.addRows(rows);

    // הוספת שורת סיכום
    if (summaryRow) {
        worksheet.addRow({}); // שורה ריקה להפרדה

        // יצירת אובייקט סיכום מלא כדי שכל התאים יקבלו גבולות
        const fullSummary = {};
        columns.forEach(col => {
            fullSummary[col.key] = summaryRow[col.key] || "";
        });

        const lastRow = worksheet.addRow(fullSummary);
        lastRow.eachCell((cell) => {
            cell.font = { bold: true };
        });
    }

    // עיצוב גבולות שחורים לכל התאים הקיימים בטבלה
    worksheet.eachRow({ includeEmpty: true }, (row) => {
        // אנחנו מגדירים גבולות לכל תא לפי מספר העמודות שהגדרנו
        for (let i = 1; i <= columns.length; i++) {
            const cell = row.getCell(i);
            const colKey = columns[i - 1]?.key ?? '';

            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };

            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

            // ★ פורמט ₪ לכל תא כספי — גם בשורות רגילות וגם בשורת הסיכום
            if (CURRENCY_KEYS.has(colKey) && typeof cell.value === 'number') {
                cell.numFmt = ILS_FORMAT;
            }
        }

        // עיצוב כותרות (שורה 1)
        if (row.number === 1) {
            row.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'F2F2F2' }
                };
                cell.font = { bold: true };
            });
        }
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
};

// 1. דוח מצב מלאי - מראה מה יש במחסן, כמויות וערך כספי
export const getInventoryReport = async (req, res, next) => {
    const { format } = req.query;

    const { data, error } = await db()
        .from('products')
        .select('id, name, total_in_stock, cost_price, is_active')
        .order('name', { ascending: true });

    if (error) return next(error);

    // חישוב ערך מלאי כולל (כמות כפול מחיר עלות)
    const totalInventoryValue = data.reduce((sum, p) => sum + (p.total_in_stock * (p.cost_price || 0)), 0);

    const formattedData = data.map(p => ({
        "שם מוצר": p.name,
        "כמות במלאי": p.total_in_stock,
        "סטטוס": p.is_active ? 'פעיל' : 'לא פעיל',
        "מחיר עלות": p.cost_price

    }));

    if (format === 'excel') {
        const columns = [
            { header: 'שם מוצר', key: 'שם מוצר' },
            { header: 'כמות במלאי', key: 'כמות במלאי' },
            { header: 'סטטוס', key: 'סטטוס' },
            { header: 'מחיר עלות', key: 'מחיר עלות' }
        ];

        const summary = {
            "שם מוצר": 'סה"כ ערך מלאי:',
            "מחיר עלות": totalInventoryValue
        };

        return sendExcel(res, columns, formattedData, summary, "דוח מלאי");
    }

    res.status(200).json({
        'תאריך': new Date().toLocaleDateString('he-IL'),
        'סה"כ מוצרים': data.length,
        'סה"כ ערך מלאי': totalInventoryValue,
        'מוצרים במלאי': formattedData
    });
};

// 2. דוח מכירות - סיכום מכירות לפי טווח תאריכים
export const getSalesReport = async (req, res, next) => {
    const { startDate, endDate, sale_id, format } = req.query; // נקבל תאריכים מה-Query String

    //תרחיש א': הצגת רשימת מכירות (עם או בלי סינון תאריכים)
    if (!sale_id) {
        let query = db()
            .from('sales_events')
            .select('id, name, date, status')
            .order('date', { ascending: false });

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);

        const { data, error } = await query;
        if (error) return next(error);

        const formattedSales = data.map(e => ({
            'מזהה': e.id,
            'שם מכירה': e.name,
            'תאריך': e.date ? new Date(e.date).toLocaleDateString('he-IL') : '',
            'סטטוס': e.status === "closed" ? "סגורה לשינויים" : "פתוחה לשינויים"
        }));

        if (format === 'excel') {
            const cols = [
                { header: 'שם מכירה', key: 'שם מכירה' },
                { header: 'תאריך', key: 'תאריך' },
                { header: 'סטטוס', key: 'סטטוס' }
            ];

            return sendExcel(res, cols, formattedSales, null, "דוח כללי מכירות");
        }

        return res.status(200).json({
            'תקופה': { 'התחלה': new Date(startDate).toLocaleDateString('he-IL'), 'סיום': new Date(endDate).toLocaleDateString('he-IL') },
            'כמות': formattedSales.length,
            'מכירות': formattedSales
        });
    }

    //תרחיש ב': הצגת מכירה ספציפית (כותרת + מוצרים)
    const { data: event, error: eErr } = await db()
        .from('sales_events')
        .select('*')
        .eq('id', sale_id)
        .single();

    if (eErr) return next(eErr);

    const { data: saleItems, error: iErr } = await db()
        .from('sale_items')
        .select('*, products(name)')
        .eq('sale_id', sale_id)
        .order('products(name)', { ascending: true });

    if (iErr) return next(iErr);

    const rows = saleItems.map(item => {
        const totalCost = (item.cost_price || 0) * (item.sold_quantity || 0);
        const totalSales = (item.selling_price || 0) * (item.sold_quantity || 0);

        return {
            'מוצר': item.products?.name || 'לא ידוע',
            'יצא למכירה': item.opening_stock || 0,
            'נמכר': item.sold_quantity || 0,
            'חזר': item.remaining_quantity || 0,
            'מחיר עלות': item.cost_price,
            'מחיר מכירה': item.selling_price,
            'סה"כ מחיר עלות': totalCost,
            'סה"כ מחיר מכירה': totalSales,
            'רווח': totalSales - totalCost
        };
    });

    const totalCostPrice = rows.reduce((sum, i) => sum + (i['סה"כ מחיר עלות'] || 0), 0);
    const totalSellingPrice = rows.reduce((sum, i) => sum + (i['סה"כ מחיר מכירה'] || 0), 0);
    const totalProfit = totalSellingPrice - totalCostPrice;

    if (format === 'excel') {
        const cols = [
            { header: 'מוצר', key: 'מוצר' },
            { header: 'יצא למכירה', key: 'יצא למכירה' },
            { header: 'נמכר', key: 'נמכר' },
            { header: 'חזר', key: 'חזר' },
            { header: 'מחיר עלות', key: 'מחיר עלות' },
            { header: 'מחיר מכירה', key: 'מחיר מכירה' },
            { header: 'סה"כ מחיר עלות', key: 'סה"כ מחיר עלות' },
            { header: 'סה"כ מחיר מכירה', key: 'סה"כ מחיר מכירה' },
            { header: 'רווח', key: 'רווח' }
        ];

        const summary = {
            'מוצר': 'סה"כ כללי:',
            'סה"כ מחיר עלות': totalCostPrice,
            'סה"כ מחיר מכירה': totalSellingPrice,
            'רווח': totalProfit
        };

        const title = event.name ? `דוח מכירה - ${event.name}` : `דוח מכירה - ${new Date(event.date).toLocaleDateString('he-IL')}`;
        return sendExcel(res, cols, rows, summary, title);
    }

    res.status(200).json({
        "פרטי_מכירה": {
            "שם": event.name,
            "תאריך": new Date(event.date).toLocaleDateString('he-IL'),
            "סטטוס": event.status === "closed" ? "סגורה לשינויים" : "פתוחה לשינויים"
        },
        "סיכום_כספי": {
            'סה"כ מחיר עלות': totalCostPrice,
            'סה"כ מחיר מכירה': totalSellingPrice,
            "רווח": totalProfit
        },
        "מוצרים": rows // הרשימה המלאה
    });
};

// 3. דוח ספקים - ריכוז חובות ויתרות (מבוסס על current_debt)
export const getSuppliersReport = async (req, res, next) => {
    const { format } = req.query;

    const { data, error } = await db()
        .from('suppliers')
        .select('id, name, company_name, phone, email, balance')
        .order('name', { ascending: true });

    if (error) return next(error);

    const formattedSuppliers = data.map(s => ({
        'מזהה': s.id,
        'שם ספק': s.name,
        'שם חברה': s.company_name,
        'טלפון': s.phone || null,
        'מייל': s.email || null,
        'יתרת חוב': s.balance || 0
    }));

    // חישוב סך כל החובות של העסק לכל הספקים יחד
    const totalBusinessBalance = data.reduce((sum, s) => sum + (s.balance || 0), 0);

    if (format === 'excel') {
        const cols = [
            { header: 'שם ספק', key: 'שם ספק' },
            { header: 'שם חברה', key: 'שם חברה' },
            { header: 'יתרת חוב', key: 'יתרת חוב' }
        ];

        const summary = {
            'שם ספק': 'סה"כ חובות לעסק:',
            'יתרת חוב': totalBusinessBalance
        };

        return sendExcel(res, cols, formattedSuppliers, summary, "דוח ספקים");
    }

    res.status(200).json({
        'תאריך דוח': new Date(),
        'סה"כ חוב כללי': totalBusinessBalance,
        'ספקים': formattedSuppliers
    });
};
