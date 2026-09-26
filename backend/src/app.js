const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Necessário para que o express-rate-limit e os cookies "secure" funcionem
// corretamente atrás de um proxy reverso (Nginx, Render, Railway etc.).
app.set('trust proxy', process.env.TRUST_PROXY_HOPS ? Number(process.env.TRUST_PROXY_HOPS) : false);

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const site = path.resolve(__dirname, '../../Site-Agrotech');
const hashes = new Set();
for (const file of fs.readdirSync(site).filter(name => name.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(site, file), 'utf8');
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>|\bon\w+="([^"]*)"/gi)) {
    const script = match[1] || match[2];
    if (script) hashes.add("'sha256-" + crypto.createHash('sha256').update(script.replace(/\r\n/g, '\n')).digest('base64') + "'");
  }
}
app.use(helmet({ contentSecurityPolicy: { directives: {
  scriptSrc: ["'self'", "'unsafe-hashes'", ...hashes],
  connectSrc: ["'self'", ...env.frontendOrigins, ...(env.isProduction ? [] : ['ws://192.168.4.1:81'])],
  upgradeInsecureRequests: null,
} } }));

app.use(
  cors({
    origin(origin, callback) {
      // Requisições sem "origin" (ex: curl, apps mobile, mesmo host) são permitidas.
      if (!origin || env.frontendOrigins.includes(origin) || (!env.isProduction && /^http:\/\/(localhost|127\.0\.0\.1):(3000|5500|5501)$/.test(origin))) {
        return callback(null, true);
      }
      return callback(require('./utils/ApiError').forbidden('Origem não permitida pelo CORS.'));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok' });
});

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('X-AgroTech-Request') !== '1') {
    return res.status(403).json({success:false,message:'Requisição sem proteção CSRF.'});
  }
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/admin', require('./routes/adminRoutes'));
app.use(express.static(site, { dotfiles: 'deny', etag: false, maxAge: 0 }));

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
