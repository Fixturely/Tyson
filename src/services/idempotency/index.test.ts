import { idempotencyKeyStore } from './index';

describe('Idempotency Key Store', () => {
    beforeEach(()=>{
        idempotencyKeyStore['processedEvents'].clear();
        idempotencyKeyStore['eventTimestamps'].clear();
    })

    it('should track processed events',()=>{
        const eventId='evt_test_123';
        expect(idempotencyKeyStore.hasProcessed(eventId)).toBe(false);
        idempotencyKeyStore.markProcessed(eventId);
        expect(idempotencyKeyStore.hasProcessed(eventId)).toBe(true);
    });

    it('should not process the same event twice', () => {
        const eventId = 'evt_test_456';
        
        // First time
        expect(idempotencyKeyStore.hasProcessed(eventId)).toBe(false);
        idempotencyKeyStore.markProcessed(eventId);
        
        // Second time
        expect(idempotencyKeyStore.hasProcessed(eventId)).toBe(true);
      });
      it('should return correct stats', () => {
        expect(idempotencyKeyStore.getStats().totalProcessed).toBe(0);
        
        idempotencyKeyStore.markProcessed('evt_1');
        idempotencyKeyStore.markProcessed('evt_2');
        
        const stats = idempotencyKeyStore.getStats();
        expect(stats.totalProcessed).toBe(2);
        expect(stats.oldestEvent).toBeDefined();
      });
    
      it('should cleanup old events', () => {
        const eventId = 'evt_old';
        idempotencyKeyStore.markProcessed(eventId);
        
        // Mock old timestamp
        const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
        idempotencyKeyStore['eventTimestamps'].set(eventId, oldDate);
        
        expect(idempotencyKeyStore.hasProcessed(eventId)).toBe(true);
        
        idempotencyKeyStore.cleanup(24 * 60 * 60 * 1000); // 24 hours
        
        expect(idempotencyKeyStore.hasProcessed(eventId)).toBe(false);
      });
});