import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const APP_PASSWORD = process.env.APP_PASSWORD || 'password';
const COOKIE_NAME = 'auth_token';

export const login = (req, res) => {
    const { password } = req.body;
    if (password !== APP_PASSWORD) {
        return res.status(401).json({ error: 'סיסמה שגויה' });
    }
    const token = jwt.sign({ ok: true }, JWT_SECRET, { expiresIn: '7d' });
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ ok: true });
};

export const logout = (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
};

export const getMe = (req, res) => {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'לא מחובר' });
    try {
        jwt.verify(token, JWT_SECRET);
        res.json({ ok: true });
    } catch {
        res.clearCookie(COOKIE_NAME);
        res.status(401).json({ error: 'פג תוקף החיבור' });
    }
};
