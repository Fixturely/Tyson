'use strict';

export default {
  port: process.env.PORT || 3000,
  environment: 'development',
  stripe:{
    secretKey: process.env.STRIPE_SECRET_KEY || '',
  }
};