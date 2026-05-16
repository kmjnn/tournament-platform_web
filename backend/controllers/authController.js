const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const UserModel = require('../models/userModel');
require('dotenv').config();

// Простая валидация email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.register = async (req, res) => {
    try {
        const { nickname, email, password, role } = req.body;

        // Валидация
        if (!nickname || nickname.length < 3) {
            return res.status(400).json({ error: 'Никнейм должен быть не менее 3 символов' });
        }
        if (!email || !isValidEmail(email)) {
            return res.status(400).json({ error: 'Некорректный email' });
        }
        if (!password || password.length < 8) {
            return res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' });
        }
        if (!['organizer', 'participant', 'venue_admin'].includes(role)) {
            return res.status(400).json({ error: 'Некорректная роль' });
        }

        // Проверка на существующего пользователя
        const existingUser = await UserModel.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'Пользователь с таким email уже существует' });
        }

        const user = await UserModel.create({ nickname, email, password, role });
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Не возвращаем пароль в ответе
        const { password: _, ...userWithoutPassword } = user;
        res.status(201).json({ user: userWithoutPassword, token });
    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
};

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email и пароль обязательны' });
        }

        const user = await UserModel.findByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Неверные учётные данные' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Неверные учётные данные' });
        }

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });
    } catch (err) {
        console.error('Ошибка входа:', err);
        res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
};