import { buildZeusNotificationPayload } from './helper';
import type { ZeusNotificationData } from './controller';

describe('Notification Helper Functions', () => {
  describe('buildZeusNotificationPayload', () => {
    it('should build payload with all required fields', () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
      };

      const payload = buildZeusNotificationPayload(notificationData);

      expect(payload).toEqual({
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        status: undefined,
        amount: 2000,
        currency: 'usd',
        paid_at: undefined,
        error_message: undefined,
        metadata: undefined,
        timestamp: expect.any(String),
      });
    });

    it('should include optional status field when provided', () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        status: 'succeeded',
        amount: 2000,
        currency: 'usd',
      };

      const payload = buildZeusNotificationPayload(notificationData);

      expect(payload.status).toBe('succeeded');
    });

    it('should convert paid_at Date to ISO string when provided', () => {
      const paidAt = new Date('2024-01-15T10:30:00Z');
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        paid_at: paidAt,
      };

      const payload = buildZeusNotificationPayload(notificationData);

      expect(payload.paid_at).toBe(paidAt.toISOString());
    });

    it('should include error_message when provided', () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        status: 'failed',
        amount: 2000,
        currency: 'usd',
        error_message: 'Card declined',
      };

      const payload = buildZeusNotificationPayload(notificationData);

      expect(payload.error_message).toBe('Card declined');
    });

    it('should include metadata when provided', () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
        metadata: {
          sport_id: 1,
          team_id: 42,
          subscription_type: 'premium',
        },
      };

      const payload = buildZeusNotificationPayload(notificationData);

      expect(payload.metadata).toEqual({
        sport_id: 1,
        team_id: 42,
        subscription_type: 'premium',
      });
    });

    it('should always include timestamp in ISO format', () => {
      const notificationData: ZeusNotificationData = {
        subscription_id: 123,
        user_id: 456,
        payment_intent_id: 'pi_test_123',
        amount: 2000,
        currency: 'usd',
      };

      const beforeTime = Date.now();
      const payload = buildZeusNotificationPayload(notificationData);
      const afterTime = Date.now();

      expect(payload.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      const timestampMs = new Date(payload.timestamp).getTime();
      expect(timestampMs).toBeGreaterThanOrEqual(beforeTime);
      expect(timestampMs).toBeLessThanOrEqual(afterTime);
    });

    it('should handle complete notification data with all fields', () => {
      const paidAt = new Date('2024-01-15T10:30:00Z');
      const notificationData: ZeusNotificationData = {
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_complete_456',
        status: 'succeeded',
        amount: 5000,
        currency: 'eur',
        paid_at: paidAt,
        metadata: {
          sport_id: 2,
          team_id: 99,
        },
      };

      const payload = buildZeusNotificationPayload(notificationData);

      expect(payload).toEqual({
        subscription_id: 789,
        user_id: 101,
        payment_intent_id: 'pi_complete_456',
        status: 'succeeded',
        amount: 5000,
        currency: 'eur',
        paid_at: paidAt.toISOString(),
        error_message: undefined,
        metadata: {
          sport_id: 2,
          team_id: 99,
        },
        timestamp: expect.any(String),
      });
    });
  });
});
