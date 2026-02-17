import multer from 'multer';
import path from 'path';

// הגדרת סוגי הקבצים המותרים
const ALLOWED_FILE_TYPES = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc'
};

// הגבלת גודל קובץ - 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB in bytes

// הגדרת איפה לשמור את הקבצים
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/'); // תיקייה לשמירת חשבוניות
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = ALLOWED_FILE_TYPES[file.mimetype] || path.extname(file.originalname);
        cb(null, 'invoice-' + uniqueSuffix + ext);
    }
});

// בדיקת סוג קובץ
const fileFilter = (req, file, cb) => {
    if (ALLOWED_FILE_TYPES[file.mimetype])
        cb(null, true);
    else
        cb(new Error('סוג הקובץ אינו נתמך. יש להעלות קובץ PDF, JPG, PNG, DOC או DOCX בלבד'));
};

// יצירת middleware
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE
    }
});

// middleware לטיפול בשגיאות multer
export const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                error: `הקובץ גדול מדי. הגודל המקסימלי המותר הוא ${MAX_FILE_SIZE / 1024 / 1024}MB`
            });
        }
        return res.status(400).json({ error: err.message });
    }

    if (err) return res.status(400).json({ error: err.message });
    next();
};

export default upload;
