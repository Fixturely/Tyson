import Stripe from 'stripe';
import config from '../../../config';
import { paymentIntentModel } from '../../models/payment_intent';
import { customerPaymentMethodsModel } from '../../models/customer_payment_methods';
import { zeusSubscriptionModel } from '../../models/zeus_subscriptions';
import { zeusNotificationService } from '../notifications';
import {
  PaymentsService,
  PaymentsServiceDependencies,
} from './controller';

// Create default instance with real dependencies
const stripeInstance = new Stripe(config.stripe.secretKey, {
  apiVersion: config.stripe.apiVersion as Stripe.LatestApiVersion,
});

const defaultDependencies: PaymentsServiceDependencies = {
  stripe: stripeInstance,
  paymentIntentModel,
  customerPaymentMethodsModel,
  zeusSubscriptionModel,
  zeusNotificationService,
};

export const paymentsService = new PaymentsService(defaultDependencies);

// Export the class and interface for testing/dependency injection
export { PaymentsService, PaymentsServiceDependencies } from './controller';
