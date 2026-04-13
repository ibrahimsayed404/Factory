
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const i18n = require('./middleware/i18n');

// Swagger/OpenAPI setup (loaded lazily to avoid test-time parser overhead)
let swaggerUi;
let swaggerJSDoc;

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Factory API',
    version: '1.0.0',
    description: 'Clothes Factory Management System API documentation',
  },
  servers: [
    { url: '/api', description: 'API base path' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['./src/routes/*.js', './src/controllers/*.js'], // Scan for JSDoc
};

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

if (process.env.NODE_ENV !== 'test') {
  swaggerUi = require('swagger-ui-express');
  swaggerJSDoc = require('swagger-jsdoc');
  const swaggerSpec = swaggerJSDoc(swaggerOptions);
  // Serve Swagger UI at /api/docs
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}


const allowedOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((o) => o.trim())
  : true;

// Security middleware
app.use(helmet());
app.use(i18n);
const shouldEnableRateLimit = isProduction || process.env.ENABLE_RATE_LIMIT_IN_DEV === 'true';
if (shouldEnableRateLimit) {
  app.use(
    rateLimit({
      windowMs: Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes default
      max: Number.parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      standardHeaders: true,
      legacyHeaders: false,
      message: (req) => ({ error: req.t('errors.too_many_requests', 'Too many requests. Please try again shortly.') }),
    })
  );
}
app.use(mongoSanitize());

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json());
// API documentation route (Swagger UI)
// Visit http://localhost:5000/api/docs to view docs
// NOTE: /uploads is NOT publicly served. Evidence files are served through
// the authenticated GET /api/uploads/payment-evidence/:filename route.

app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
app.use('/api', routes);
app.use((req, res) => res.status(404).json({ error: req.t('errors.route_not_found', 'Route not found') }));
app.use(errorHandler);

module.exports = app;
