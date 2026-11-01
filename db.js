require('dotenv').config(); // we load environment variables from .env file
const fs = require('node:fs');
const mysql = require('mysql2/promise'); // so we can be able to use await and async to conncet to the database

const requiredEnvironment = ['DB_HOST', 'DB_USER', 'DB_NAME'];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]);
if (missingEnvironment.length) {
  throw new Error(`Missing database environment variables: ${missingEnvironment.join(', ')}. Copy .env.example to .env and configure it.`);
}
// second we created a fast fail check to make sure that the required environment variables are set. If any of them are missing, we throw an error and stop the application from starting. This is important because if we try to connect to the database without the necessary information, it will fail and cause issues later on
const sslEnabled = process.env.DB_SSL === 'true';
const sslCa = process.env.DB_SSL_CA?.replace(/\\n/g, '\n') ||
  (process.env.DB_SSL_CA_PATH ? fs.readFileSync(process.env.DB_SSL_CA_PATH, 'utf8') : undefined);
if (sslEnabled && !sslCa) {
  throw new Error('DB_SSL=true requires DB_SSL_CA or DB_SSL_CA_PATH.');
}
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME,
  ...(sslEnabled ? { ssl: { ca: sslCa, rejectUnauthorized: true } } : {}),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
// last thing here is a conncetion pool to keep 10 conncetions so incoming requests get processed faster 
module.exports = pool;
