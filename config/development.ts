'use strict';

export default {
  port: process.env.PORT || 3000,
  environment: 'development',
  stripe:{
    secretKey: process.env.STRIPE_SECRET_KEY || '',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    apiVersion: '2023-10-16',
  }
};