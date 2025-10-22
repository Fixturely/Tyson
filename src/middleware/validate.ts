import type { Request, Response, NextFunction, RequestHandler } from 'express';
import Joi from 'joi';

export function validateBody(schema: Joi.ObjectSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { value, error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });
    if (error) {
      res.status(400).json({
        error: 'ValidationError',
        details: error.details.map(d => ({ message: d.message, path: d.path })),
      });
      return;
    }
    req.body = value;
    next();
  };
}
