import express from 'express';
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import healthRoutes from './plugins/features/health'
import config from '../config';
import logger from './utils/logger';

dotenv.config()
const app = express()


// Add middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies


function registerRoutes(app: express.Application) {
  app.use('/api/v1', healthRoutes)
}

registerRoutes(app)

app.listen(config.port, () => {
  logger.info(`Server is running on port ${config.port}`)
})

export default app