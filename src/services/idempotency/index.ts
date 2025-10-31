import { IdempotencyKeyStore } from './controller';

export const idempotencyKeyStore = new IdempotencyKeyStore();

// Export the class for testing/dependency injection
export { IdempotencyKeyStore } from './controller';
