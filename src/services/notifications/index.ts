import { ZeusNotificationService } from './controller';

export const zeusNotificationService = new ZeusNotificationService();

// Export the class and interface for testing/dependency injection
export { ZeusNotificationService, ZeusNotificationData } from './controller';

