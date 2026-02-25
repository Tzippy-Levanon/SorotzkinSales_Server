import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

const requireAuth = (req, res, next) => {
    const token = req.cookies?.auth_token;
    if (!token) return res.status(401).json({ error: 'נדרשת התחברות' });
    try {
        jwt.verify(token, JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'פג תוקף החיבור — התחבר שוב' });
    }
};

export default requireAuth;
