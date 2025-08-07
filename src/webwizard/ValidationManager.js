export class ValidationManager {
    constructor(logger) {
        this.logger = logger;
        this.validators = {
            'data-fv-not-empty': this.validateNotEmpty.bind(this),
            'data-fv-email-address': this.validateEmail.bind(this),
            'data-fv-string-length': this.validateStringLength.bind(this),
            'data-fv-regexp': this.validateRegexp.bind(this),
            'data-fv-numeric': this.validateNumeric.bind(this),
            'data-fv-file': this.validateFile.bind(this)
        };
    }

    validateNode(node, value) {
        if (!node.attributes || node.attributes['data-xtz-validate'] !== 'true') {
            return { isValid: true, errors: [] };
        }

        const errors = [];
        const attributes = node.attributes;

        // Iterar sobre todos los validadores disponibles
        Object.keys(this.validators).forEach(validatorKey => {
            if (attributes[validatorKey] === 'true') {
                const result = this.validators[validatorKey](value, attributes, node);
                if (!result.isValid) {
                    const messageKey = `${validatorKey}___message`;
                    const message = attributes[messageKey] || result.defaultMessage;
                    errors.push(message);
                }
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    validateNotEmpty(value, attributes, node) {
        let isEmpty = false;
        
        if (node.type === 'checkbox') {
            isEmpty = !Array.isArray(value) || value.length === 0;
        } else if (node.type === 'file') {
            isEmpty = !value || !value.base64;
        } else {
            isEmpty = !value || (typeof value === 'string' && value.trim() === '');
        }

        return {
            isValid: !isEmpty,
            defaultMessage: 'This field is required'
        };
    }

    validateEmail(value, attributes, node) {
        if (!value || typeof value !== 'string') {
            return { isValid: true, defaultMessage: '' }; // Let not-empty handle empty values
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return {
            isValid: emailRegex.test(value.trim()),
            defaultMessage: 'Please enter a valid email address'
        };
    }

    validateStringLength(value, attributes, node) {
        if (!value || typeof value !== 'string') {
            return { isValid: true, defaultMessage: '' };
        }

        const length = value.trim().length;
        const min = parseInt(attributes['data-fv-string-length___min']) || 0;
        const max = parseInt(attributes['data-fv-string-length___max']) || Infinity;

        const isValid = length >= min && length <= max;
        let message = 'Invalid length';
        
        if (min > 0 && max < Infinity) {
            message = `Must be between ${min} and ${max} characters`;
        } else if (min > 0) {
            message = `Must be at least ${min} characters`;
        } else if (max < Infinity) {
            message = `Must not exceed ${max} characters`;
        }

        return {
            isValid: isValid,
            defaultMessage: message
        };
    }

    validateRegexp(value, attributes, node) {
        if (!value || typeof value !== 'string') {
            return { isValid: true, defaultMessage: '' };
        }

        const pattern = attributes['data-fv-regexp___regexp'];
        if (!pattern) {
            return { isValid: true, defaultMessage: '' };
        }

        try {
            const regex = new RegExp(pattern);
            return {
                isValid: regex.test(value),
                defaultMessage: 'Invalid format'
            };
        } catch (e) {
            return { isValid: true, defaultMessage: '' };
        }
    }

    validateNumeric(value, attributes, node) {
        if (!value || value === '') {
            return { isValid: true, defaultMessage: '' };
        }

        const num = parseFloat(value);
        if (isNaN(num)) {
            return {
                isValid: false,
                defaultMessage: 'Must be a valid number'
            };
        }

        const min = parseFloat(attributes['data-fv-numeric___min']);
        const max = parseFloat(attributes['data-fv-numeric___max']);

        let isValid = true;
        let message = 'Invalid number';

        if (!isNaN(min) && num < min) {
            isValid = false;
            message = `Must be at least ${min}`;
        }
        
        if (!isNaN(max) && num > max) {
            isValid = false;
            message = `Must not exceed ${max}`;
        }

        return {
            isValid: isValid,
            defaultMessage: message
        };
    }

    validateFile(value, attributes, node) {
        if (!value || !value.base64) {
            return { isValid: true, defaultMessage: '' }; // Let not-empty handle empty files
        }

        const maxSize = parseInt(attributes['data-fv-file___max-size']);
        const allowedTypes = attributes['data-fv-file___type'];

        if (maxSize && value.base64) {
            // Aproximar tamaño del archivo desde base64
            const sizeInBytes = (value.base64.length * 3) / 4;
            if (sizeInBytes > maxSize) {
                return {
                    isValid: false,
                    defaultMessage: `File size must not exceed ${Math.round(maxSize / 1024)} KB`
                };
            }
        }

        if (allowedTypes && value.mimeType) {
            const allowed = allowedTypes.split(',').map(t => t.trim());
            if (!allowed.includes(value.mimeType)) {
                return {
                    isValid: false,
                    defaultMessage: `File type must be one of: ${allowedTypes}`
                };
            }
        }

        return { isValid: true, defaultMessage: '' };
    }
}