import 'dotenv/config';
import express from 'express';
import cors from 'cors'
import helmet from 'helmet'
import healthRoutes from './plugins/features/health'
import config from '../config';
import logger from './utils/logger';
import paymentRoutes from './plugins/features/payment';
import stripeWebhookRoutes from './plugins/features/webhooks/stripe';

const app = express()


// Add middleware

// 1. Security + Cors
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS

// 2. Webhook route with raw body (before JSON)
app.use('/api/v1/webhooks/stripe', express.raw({type: 'application/json'}),stripeWebhookRoutes )

//3. JSON parser for normal routes
app.use(express.json()); // Parse JSON bodies

//4. Register normal routes
function registerRoutes(app: express.Application) {
  app.use('/api/v1', healthRoutes)
  app.use('/api/v1', paymentRoutes)
}

registerRoutes(app)

if (process.env.NODE_ENV !== 'test') {
  app.listen(config.port, () => {
    logger.info(`Server is running on port ${config.port}`)
  })
}

export default app