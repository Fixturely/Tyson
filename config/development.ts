'use strict';

export default {
  port: process.env.PORT || 3000,
  environment: 'development',
  stripe:{
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    apiVersion: '2023-10-16',
  },
  zeus: {
    webhookUrl: process.env.ZEUS_WEBHOOK_URL || 'http://localhost:8080',
    webhookSecret: process.env.ZEUS_WEBHOOK_SECRET || '',
  }
};