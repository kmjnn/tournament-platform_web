const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
    const authHeader = req.header('Authorization');
    
    if (!authHeader) {
        return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const token = authHeader.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({ error: 'Токен не предоставлен' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Токен истёк, выполните вход заново' });
        }
        return res.status(401).json({ error: 'Недействительный токен' });
    }
};