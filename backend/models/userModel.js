const db = require('../config/db');
const bcrypt = require('bcrypt');

const UserModel = {
  async create({ nickname, email, password, role }) {
    const hashed = await bcrypt.hash(password, 10);
    const res = await db.query(
      'INSERT INTO users (nickname, email, password, role) VALUES ($1,$2,$3,$4) RETURNING *',
      [nickname, email, hashed, role]
    );
    return res.rows[0];
  },

  async findByEmail(email) {
    const res = await db.query('SELECT * FROM users WHERE email=$1', [email]);
    return res.rows[0];
  },

  async findById(id) {
    const res = await db.query('SELECT * FROM users WHERE id=$1', [id]);
    return res.rows[0];
  },

  async updateRating(id, rating) {
    await db.query('UPDATE users SET rating=$1 WHERE id=$2', [rating, id]);
  }
};

module.exports = UserModel;