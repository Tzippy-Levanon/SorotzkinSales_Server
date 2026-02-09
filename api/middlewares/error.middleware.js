export default function errorMiddleware(err, req, res, next) {
    const statusCode = err.statusCode ?? 500;
    const message = statusCode === 500 ? 'שגיאת שרת פנימית' : err.message;

    if (statusCode === 500) {
        console.error(err?.message ?? err);
    }

    res.status(statusCode).json({ error: message });
}
