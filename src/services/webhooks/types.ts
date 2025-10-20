export interface WebhookEventData {
    id: string;
    type: string;
    payment_intent_id?: string;
    data: any;
    processed?: boolean;
    processingError?: string;
}