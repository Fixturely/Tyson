import Joi from 'joi';

export const createIntentSchema = Joi.object({
  amount: Joi.number().integer().min(1).required(), // cents
  currency: Joi.string().lowercase().default('usd'),
  description: Joi.string().max(255).optional(),
  metadata: Joi.object().pattern(Joi.string(), Joi.string()).optional(),
});

export const confirmSchema = Joi.object({
  paymentMethod: Joi.string().default('pm_card_visa'),
});

// Zeus subscription payment schema
export const zeusSubscriptionSchema = Joi.object({
  subscription_id: Joi.string().required(),
  user_id: Joi.number().integer().required(),
  amount: Joi.number().integer().min(1).required(), // cents
  currency: Joi.string().lowercase().default('usd'),
  description: Joi.string().max(255).optional(),
  metadata: Joi.object({
    sport_id: Joi.number().integer().optional(),
    team_id: Joi.number().integer().optional(),
    subscription_type: Joi.string().optional(),
  }).optional(),
  customer_info: Joi.object({
    email: Joi.string().email().required(),
    name: Joi.string().optional(),
  }).required(),
});
