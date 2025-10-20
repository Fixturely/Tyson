export default {
    development: {
      client: 'pg',
      connection: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5434,
        user: process.env.DB_USER || 'admin',
        password: process.env.DB_PASSWORD || 'admin',
        database: process.env.DB_NAME || 'tyson-local-db'
      },
      migrations: {
        directory: './src/database/migrations'
      },
      seeds: {
        directory: './src/database/seeds'
      },
      pool: {
        min: 2,
        max: 10
      }
    },
  };