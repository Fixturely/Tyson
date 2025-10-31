import { InvoicesService, InvoicesServiceDependencies } from './controller';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import { zeusNotificationService } from '../notifications';

const defaultDependencies: InvoicesServiceDependencies = {
  zeusSubscriptionModel,
  zeusNotificationService,
};

export const invoicesService = new InvoicesService(defaultDependencies);

// Export the class and interface for testing/dependency injection
export { InvoicesService, InvoicesServiceDependencies } from './controller';
