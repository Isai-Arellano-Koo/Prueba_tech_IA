require('dotenv').config();
const Fastify = require('fastify');
const mysql = require('mysql2/promise');


const fastify = Fastify({ logger: true });

const cors = require('@fastify/cors');
fastify.register(cors, { origin: '*' });

const PORT = process.env.PORT || 3001;

let pool;
async function initDB() {
  pool = await mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10
  });
}

// Genera token numeric de 8 dígitos (string)
function genToken() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

fastify.post('/token/generate', async (req, reply) => {
  const { user_name } = req.body || {};
  const token = genToken();
  const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24); // vence en: 24h
  await pool.query('INSERT INTO tokens (token, user_name, expires_at) VALUES (?, ?, ?)', [token, user_name || null, expires_at]);
  return { token, expires_at };
});

fastify.post('/token/validate', async (req, reply) => {
  const { token } = req.body || {};
  if (!token) return reply.code(400).send({ valid: false, error: 'token required' });

  const [rows] = await pool.query('SELECT * FROM tokens WHERE token = ? LIMIT 1', [token]);
  if (rows.length === 0) return { valid: false };

  const t = rows[0];
  if (t.used) return { valid: false, reason: 'used' };
  if (t.expires_at && new Date(t.expires_at) < new Date()) return { valid: false, reason: 'expired' };

  // marcar como usado
   await pool.query('UPDATE tokens SET used=1 WHERE id=?', [t.id]);

  return { valid: true, token: t.token, user_name: t.user_name };
});

const start = async () => {
  await initDB();
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
};
start().catch(err => { fastify.log.error(err); process.exit(1); });
