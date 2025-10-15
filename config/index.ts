import developmentConfig from './development';

const environment = process.env.NODE_ENV || 'development';

const configs = {
  development: developmentConfig,
  // Add other environments as needed
};

export default configs[environment as keyof typeof configs] || developmentConfig;