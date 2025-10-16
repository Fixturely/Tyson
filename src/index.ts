import 'dotenv/config';
import express from 'express';
import cors from 'cors'
import helmet from 'helmet'
import healthRoutes from './plugins/features/health'
import config from '../config';
import logger from './utils/logger';
import paymentRoutes from './plugins/features/payment';

const app = express()


// Add middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies


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