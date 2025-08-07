export class ElementManager {
    constructor(logger, eventManager) {
        this.logger = logger;
        this.eventManager = eventManager;
        this.createdElements = new Set();
    }

    createElement(tag, attributes = {}, parentElement = null) {
        try {
            this.logger.debug('DOMManager', 'createElement', `Creating ${tag} element`, attributes);
            
            const element = document.createElement(tag);
            const elementId = attributes.id || `element_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Aplicar atributos
            Object.entries(attributes).forEach(([key, value]) => {
                try {
                    if (key === 'className') {
                        element.className = value;
                    } else if (key === 'textContent') {
                        element.textContent = value;
                    } else if (key === 'innerHTML') {
                        element.innerHTML = value;
                    } else if (key === 'checked' && typeof value === 'boolean') {
                        element.checked = value;
                    } else if (key === 'id') {
                        element.id = value;
                    } else {
                        element.setAttribute(key, value);
                    }
                } catch (attrError) {
                    this.logger.warn('DOMManager', 'createElement', `Failed to set attribute ${key}`, {
                        key, value, error: attrError.message
                    });
                }
            });

            // Asegurar que el elemento tenga ID para tracking
            if (!element.id) {
                element.id = elementId;
            }

            // Agregar al padre si se especifica
            if (parentElement) {
                parentElement.appendChild(element);
            }

            this.createdElements.add(element.id);
            
            this.logger.debug('DOMManager', 'createElement', `Created ${tag} element successfully`, {
                elementId: element.id,
                tag
            });
            
            return element;
        } catch (error) {
            this.logger.error('DOMManager', 'createElement', 'Failed to create element', {
                tag, attributes, error: error.message
            });
            throw error;
        }
    }

    findElement(selector, context = document) {
        try {
            const element = context.querySelector(selector);
            if (!element) {
                this.logger.warn('DOMManager', 'findElement', `Element not found: ${selector}`);
            } else {
                this.logger.debug('DOMManager', 'findElement', `Found element: ${selector}`, {
                    elementId: element.id
                });
            }
            return element;
        } catch (error) {
            this.logger.error('DOMManager', 'findElement', 'Error finding element', {
                selector, error: error.message
            });
            return null;
        }
    }

    removeElement(elementOrId) {
        try {
            const element = typeof elementOrId === 'string' ? 
                document.getElementById(elementOrId) : elementOrId;
            
            if (!element) {
                this.logger.warn('DOMManager', 'removeElement', 'Element not found for removal');
                return false;
            }

            const elementId = element.id;
            element.remove();
            this.createdElements.delete(elementId);
            
            this.logger.debug('DOMManager', 'removeElement', 'Element removed successfully', { elementId });
            return true;
        } catch (error) {
            this.logger.error('DOMManager', 'removeElement', 'Failed to remove element', {
                error: error.message
            });
            return false;
        }
    }

    cleanup() {
        this.logger.info('DOMManager', 'cleanup', 'Starting DOM cleanup');
        let cleanedCount = 0;
        
        this.createdElements.forEach(elementId => {
            if (this.removeElement(elementId)) {
                cleanedCount++;
            }
        });
        
        this.logger.info('DOMManager', 'cleanup', `Cleaned up ${cleanedCount} elements`);
    }
}