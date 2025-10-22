require('dotenv').config();
const Fastify = require('fastify');
const mysql = require('mysql2/promise');
const amqplib = require('amqplib');


const fastify = Fastify({ logger: true });

const cors = require('@fastify/cors');
fastify.register(cors, { origin: '*' });

const PORT = process.env.PORT || 3003;
const RABBIT_QUEUE = process.env.RABBIT_QUEUE || 'emails';
let pool, rabbitConn, rabbitCh;

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

async function initRabbit() {
  rabbitConn = await amqplib.connect({
    protocol: 'amqp',
    hostname: process.env.RABBIT_HOST || 'localhost',
    port: process.env.RABBIT_PORT || 5672,
    username: process.env.RABBIT_USER || 'guest',
    password: process.env.RABBIT_PASS || 'guest'
  });
  rabbitCh = await rabbitConn.createChannel();
  await rabbitCh.assertQueue(RABBIT_QUEUE, { durable: true });

  rabbitCh.consume(RABBIT_QUEUE, async (msg) => {
    if (msg !== null) {
      try {
        const payload = JSON.parse(msg.content.toString());
        // Registrar en email_logs
        await pool.query(`INSERT INTO email_logs (to_email, subject, body, client_id) VALUES (?, ?, ?, ?)`, [payload.email, payload.subject, payload.body, payload.client_id || null]);
        rabbitCh.ack(msg);
        fastify.log.info({ msg: 'Processed email job', payload });
      } catch (err) {
        fastify.log.error({ err });
        // opcional: nack y requeue false para evitar bucle
        rabbitCh.nack(msg, false, false);
      }
    }
  }, { noAck: false });
}

const start = async () => {
  await initDB();
  await initRabbit();
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
};
start().catch(err => { fastify.log.error(err); process.exit(1); });
