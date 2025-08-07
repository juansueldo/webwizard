export class FormManager {
    constructor(logger, domManager, eventManager) {
        this.logger = logger;
        this.domManager = domManager;
        this.eventManager = eventManager;
        this.formData = new Map();
    }

    initializeFormData(nodes, defaultFormData = null) {
        try {
            this.logger.info('FormManager', 'initializeFormData', 'Initializing form data');
            
            this.formData.clear();

            if (defaultFormData) {
                if (Array.isArray(defaultFormData)) {
                    defaultFormData.forEach((value, index) => {
                        if (nodes[index]) {
                            this.formData.set(nodes[index].id, value);
                        }
                    });
                } else if (typeof defaultFormData === 'object') {
                    Object.entries(defaultFormData).forEach(([nodeId, value]) => {
                        this.formData.set(nodeId, value);
                    });
                }
            }

            this.logger.info('FormManager', 'initializeFormData', 'Form data initialized', {
                entries: this.formData.size
            });
            
        } catch (error) {
            this.logger.error('FormManager', 'initializeFormData', 'Failed to initialize form data', {
                error: error.message
            });
        }
    }

    setFormData(nodeId, value) {
        try {
            const oldValue = this.formData.get(nodeId);
            this.formData.set(nodeId, value);
            
            this.logger.debug('FormManager', 'setFormData', 'Form data updated', {
                nodeId, oldValue, newValue: value
            });
        } catch (error) {
            this.logger.error('FormManager', 'setFormData', 'Failed to set form data', {
                nodeId, value, error: error.message
            });
        }
    }

    getFormData(nodeId = null) {
        if (nodeId) {
            return this.formData.get(nodeId);
        }
        return new Map(this.formData);
    }

    getFieldName(node) {
        const fieldName = node.attributes?.name || `field_${node.id}`;
        this.logger.debug('FormManager', 'getFieldName', 'Generated field name', {
            nodeId: node.id, fieldName
        });
        return fieldName;
    }

    createFormElement(formAttributes = null, hiddenFields = null) {
        try {
            this.logger.info('FormManager', 'createFormElement', 'Creating form element');
            
            const formElement = this.domManager.createElement('form', { id: 'wizardForm' });

            if (formAttributes && typeof formAttributes === 'object') {
                Object.entries(formAttributes).forEach(([key, value]) => {
                    formElement.setAttribute(key, value);
                });
            }

            if (hiddenFields && typeof hiddenFields === 'object') {
                Object.entries(hiddenFields).forEach(([name, value]) => {
                    const hiddenInput = this.domManager.createElement('input', {
                        type: 'hidden',
                        name: name,
                        value: value
                    });
                    formElement.appendChild(hiddenInput);
                });
            }

            this.logger.info('FormManager', 'createFormElement', 'Form element created successfully', {
                formId: formElement.id
            });

            return formElement;
        } catch (error) {
            this.logger.error('FormManager', 'createFormElement', 'Failed to create form element', {
                error: error.message
            });
            throw error;
        }
    }

    updateHiddenFields(formElement, nodes) {
        try {
            this.logger.debug('FormManager', 'updateHiddenFields', 'Updating hidden fields');

            // Remover campos existentes
            const existingHidden = formElement.querySelectorAll('input[type="hidden"]');
            let removedCount = 0;
            
            existingHidden.forEach(input => {
                const isWizardField = input.name.startsWith('field_') || nodes.some(node => {
                    const fieldName = this.getFieldName(node);
                    return input.name === fieldName || input.name === `${fieldName}[]`;
                });
                
                if (isWizardField) {
                    input.remove();
                    removedCount++;
                }
            });

            // Agregar nuevos campos
            let addedCount = 0;
            this.formData.forEach((value, nodeId) => {
                const node = nodes.find(n => n.id === nodeId);
                if (!node) return;

                const fieldName = this.getFieldName(node);
                addedCount += this.addHiddenFieldForNode(formElement, node, fieldName, value);
            });

            this.logger.debug('FormManager', 'updateHiddenFields', 'Hidden fields updated', {
                removed: removedCount, added: addedCount
            });

        } catch (error) {
            this.logger.error('FormManager', 'updateHiddenFields', 'Failed to update hidden fields', {
                error: error.message
            });
        }
    }

    addHiddenFieldForNode(formElement, node, fieldName, value) {
        let addedCount = 0;

        try {
            if (node.type === 'checkbox' && Array.isArray(value)) {
                value.forEach(val => {
                    const hiddenInput = this.domManager.createElement('input', {
                        type: 'hidden',
                        name: `${fieldName}[]`,
                        value: val
                    });
                    formElement.appendChild(hiddenInput);
                    addedCount++;
                });
            } else if (node.type === 'file' && value && typeof value === 'object') {
                if (value.base64 && value.fileName && value.mimeType) {
                    // Base64 data
                    formElement.appendChild(this.domManager.createElement('input', {
                        type: 'hidden', name: fieldName, value: value.base64
                    }));
                    // Filename
                    formElement.appendChild(this.domManager.createElement('input', {
                        type: 'hidden', name: `${fieldName}_file`, value: value.fileName
                    }));
                    // MIME type
                    formElement.appendChild(this.domManager.createElement('input', {
                        type: 'hidden', name: `${fieldName}_mime`, value: value.mimeType
                    }));
                    addedCount += 3;
                }
            } else {
                const hiddenInput = this.domManager.createElement('input', {
                    type: 'hidden',
                    name: fieldName,
                    value: value
                });
                formElement.appendChild(hiddenInput);
                addedCount++;
            }
        } catch (error) {
            this.logger.error('FormManager', 'addHiddenFieldForNode', 'Failed to add hidden field', {
                nodeId: node.id, fieldName, error: error.message
            });
        }

        return addedCount;
    }

    clearFormData() {
        const size = this.formData.size;
        this.formData.clear();
        this.logger.info('FormManager', 'clearFormData', `Cleared ${size} form data entries`);
    }

    exportFormData() {
        const data = {};
        console.log(this.formData);
        this.formData.forEach((value, key) => {
            data[key] = value;
        });
        
        this.logger.info('FormManager', 'exportFormData', 'Form data exported', {
            entries: Object.keys(data).length
        });
        
        return data;
    }
}