import express from 'express';

const router = express.Router();

router.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'OK', 
    message: 'Health service is healthy',
    timestamp: new Date().toISOString()
  });
});

export default router;