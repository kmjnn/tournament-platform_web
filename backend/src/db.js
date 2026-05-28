import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

function getDbConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }

  const host = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 5432);
  const database = process.env.DB_NAME || "tournament_platform";
  const user = process.env.DB_USER || "postgres";
  const password = process.env.DB_PASSWORD;

  if (typeof password !== "string" || password.length === 0) {
    throw new Error(
      "DB configuration error: set DATABASE_URL or DB_PASSWORD in backend/.env"
    );
  }

  return { host, port, database, user, password };
}

const pool = new Pool(getDbConfig());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initDb() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const migrationsPath = path.join(__dirname, "migrations.sql");
  const schemaSql = fs.readFileSync(schemaPath, "utf8");
  const migrationsSql = fs.readFileSync(migrationsPath, "utf8");
  await pool.query(schemaSql);
  await pool.query(migrationsSql);
}

export async function query(text, params = []) {
  return pool.query(text, params);
}
