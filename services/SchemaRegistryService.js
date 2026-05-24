import logger from "../utils/logger.js";

/**
 * 📊 BEHAVIORAL SCHEMA REGISTRY
 * 
 * Centralized definition of all behavioral events and their expected metadata schemas.
 * This prevents "Data Chaos" and ensures analytics integrity.
 */
class SchemaRegistryService {
    constructor() {
        this.eventRegistry = new Map([
            ["pageview", {
                required: ["url"],
                optional: ["referrer", "title"]
            }],
            ["click", {
                required: ["element", "elementText"],
                optional: ["x", "y"]
            }],
            ["form_submit", {
                required: ["formId"],
                optional: ["duration", "errorCount"]
            }],
            ["search", {
                required: ["query"],
                optional: ["resultCount", "intent"]
            }],
            ["purchase", {
                required: ["itemId", "amount", "currency"],
                optional: ["coupon"]
            }],
            ["biometric_keystroke", {
                required: ["dwellTime", "flightTime"],
                optional: ["keyCategory"]
            }]
        ]);
    }

    /**
     * Validate an event against the registry
     */
    validateEvent(eventType, payload) {
        const schema = this.eventRegistry.get(eventType);
        if (!schema) {
            logger.warn(`Unregistered event type: ${eventType}. Consider adding it to SchemaRegistry.`);
            return true; // Soft fail - allow for now but log
        }

        const missing = schema.required.filter(key => !(key in payload));
        if (missing.length > 0) {
            throw new Error(`Schema Validation Failed for '${eventType}': Missing keys [${missing.join(", ")}]`);
        }

        return true;
    }

    /**
     * Get all registered events
     */
    getRegisteredEvents() {
        return Array.from(this.eventRegistry.keys());
    }
}

const registry = new SchemaRegistryService();
export default registry;
