const { Pool } = require('pg');
require('dotenv').config();

class Database {
  constructor() {
    if (!Database.instance) {
      this.pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'tournament_platform',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      });
      Database.instance = this;
    }
    return Database.instance;
  }

  query(text, params) {
    return this.pool.query(text, params);
  }
}

module.exports = new Database();