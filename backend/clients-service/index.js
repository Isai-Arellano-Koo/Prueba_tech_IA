require("dotenv").config();
const Fastify = require("fastify");
const mysql = require("mysql2/promise");
const Redis = require("ioredis");
const amqplib = require("amqplib");
const axios = require("axios");

const fastify = Fastify({ logger: true });

const cors = require("@fastify/cors");
fastify.register(cors, { origin: "*" });

const PORT = process.env.PORT || 3002;

let pool, redis, rabbitConn, rabbitCh;
const RABBIT_QUEUE = "emails";

async function initDB() {
  pool = await mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASS,
    database: process.env.MYSQL_DB,
    waitForConnections: true,
    connectionLimit: 10,
  });
}

async function initRedis() {
  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || 6379,
  });
  // Cargar todos los parámetros en Redis al iniciar
  const [rows] = await pool.query(
    "SELECT param_key, param_value FROM global_params"
  );
  for (const r of rows) {
    await redis.set(r.param_key, r.param_value);
  }
}

async function initRabbit() {
  const conn = await amqplib.connect({
    protocol: "amqp",
    hostname: process.env.RABBIT_HOST || "localhost",
    port: process.env.RABBIT_PORT || 5672,
    username: process.env.RABBIT_USER || "guest",
    password: process.env.RABBIT_PASS || "guest",
  });
  rabbitConn = conn;
  rabbitCh = await conn.createChannel();
  await rabbitCh.assertQueue(RABBIT_QUEUE, { durable: true });
}

fastify.post("/clients/register", async (req, reply) => {
  try {
    const { name, email, phone, token } = req.body;
    if (!token)
      return reply.code(400).send({ ok: false, error: "token required" });

    // Validar token con security-service
    const secUrl =
      (process.env.SECURITY_URL || "http://localhost:3001") + "/token/validate";
    const res = await axios.post(secUrl, { token }, { timeout: 5000 });
    if (!res.data || !res.data.valid) {
      // Revisar si la razón es que ya fue usado
      const reason = res.data?.reason;
      if (reason === "used") {
        return reply.code(403).send({
          ok: false,
          error: "Token ya fue usado, recarga la página para obtener uno nuevo",
        });
      }
      return reply.code(403).send({ ok: false, error: "token inválido" });
    }

    // Guardar cliente
    const [result] = await pool.query(
      "INSERT INTO clients (name, email, phone) VALUES (?, ?, ?)",
      [name, email, phone]
    );
    const clientId = result.insertId;

    // Consultar Redis para saber si enviar correo
    const sendParam = await redis.get("send_welcome_email"); // 'true' o 'false'
    const sendEmail = sendParam === "true" || sendParam === "1";

    if (sendEmail) {
      // Publicar orden en RabbitMQ
      const payload = {
        client_id: clientId,
        name,
        email,
        phone,
        subject: "Bienvenido",
        body: `Hola ${name}, bienvenido!`,
      };
      rabbitCh.sendToQueue(RABBIT_QUEUE, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
      });
    }

    return { ok: true, clientId };
  } catch (err) {
    fastify.log.error(err);
    return reply.code(500).send({ ok: false, error: "internal" });
  }
});

fastify.get("/params", async (req, reply) => {
  // mostrar parámetros desde Redis
  const keys = await redis.keys("*");
  const out = {};
  for (const k of keys) out[k] = await redis.get(k);
  return out;
});

const start = async () => {
  await initDB();
  await initRedis();
  await initRabbit();
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
};
start().catch((err) => {
  fastify.log.error(err);
  process.exit(1);
});
