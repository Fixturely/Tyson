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
