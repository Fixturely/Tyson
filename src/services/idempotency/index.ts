// Simple in-memory idempotency key store
// Todo - Change to Redis or DB in staging/production
class IdempotencyKeyStore {
    private processedEvents = new Set<string>();
    private eventTimestamps = new Map<string, Date>();

    // Function to check if event is already processed
    hasProcessed(eventId: string): boolean {
        return this.processedEvents.has(eventId);
    }

    // Function to mark event as processed
    markProcessed(eventId: string): void {
        this.processedEvents.add(eventId);
        this.eventTimestamps.set(eventId, new Date());
    }

    // Clean up old events (optional - prevents memory leaks)
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): void { // 24 hours
    const now = Date.now();
    for (const eventId of this.processedEvents.keys()) {
        const timestamp = this.eventTimestamps.get(eventId);
        if (!timestamp) continue;
      if (now - timestamp.getTime() > maxAgeMs) {
        this.processedEvents.delete(eventId);
        this.eventTimestamps.delete(eventId);
      }
    }
  }

  // Get stats (for monitoring)
  getStats() {
    return {
      totalProcessed: this.processedEvents.size,
      oldestEvent: this.eventTimestamps.size > 0 ? Math.min(...Array.from(this.eventTimestamps.values()).map(date => date.getTime())) : null,
    };
  }

  // For testing purposes only
  public reset(): void {
    this.processedEvents.clear();
    this.eventTimestamps.clear();
  }
}

export const idempotencyKeyStore = new IdempotencyKeyStore();