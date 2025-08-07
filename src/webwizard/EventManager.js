export class EventManager {
    constructor(logger) {
        this.logger = logger;
        this.listeners = new Map();
    }

    addEventListener(element, event, handler, options = {}) {
        try {
            const handlerId = `${element.id || 'unknown'}-${event}-${Date.now()}`;
            
            const wrappedHandler = (e) => {
                this.logger.debug('EventManager', 'handleEvent', `Event ${event} triggered`, {
                    elementId: element.id,
                    eventType: event,
                    target: e.target
                });
                
                try {
                    return handler(e);
                } catch (error) {
                    this.logger.error('EventManager', 'handleEvent', `Error in ${event} handler`, {
                        error: error.message,
                        stack: error.stack,
                        elementId: element.id
                    });
                    throw error;
                }
            };

            element.addEventListener(event, wrappedHandler, options);
            this.listeners.set(handlerId, { element, event, handler: wrappedHandler });
            
            this.logger.debug('EventManager', 'addEventListener', `Added ${event} listener`, {
                elementId: element.id,
                handlerId
            });
            
            return handlerId;
        } catch (error) {
            this.logger.error('EventManager', 'addEventListener', 'Failed to add event listener', {
                error: error.message,
                event,
                elementId: element.id
            });
            throw error;
        }
    }

    removeEventListener(handlerId) {
        const listener = this.listeners.get(handlerId);
        if (listener) {
            listener.element.removeEventListener(listener.event, listener.handler);
            this.listeners.delete(handlerId);
            this.logger.debug('EventManager', 'removeEventListener', 'Removed event listener', { handlerId });
        }
    }

    removeAllListeners() {
        this.listeners.forEach((listener, handlerId) => {
            this.removeEventListener(handlerId);
        });
    }
}