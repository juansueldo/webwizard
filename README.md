# WebWizard Library

A comprehensive JavaScript library for creating interactive form wizards with visual node-based configuration and step-by-step user interfaces.

## Features

- **Visual Node Editor**: Drag-and-drop interface for creating form flows
- **Multiple Input Types**: Text, email, password, number, textarea, select, checkbox, radio, file upload, range, and hidden inputs
- **Conditional Navigation**: Connect nodes with custom logic flows
- **Form Validation**: Built-in validation with customizable rules
- **Progress Tracking**: Visual progress indicators for multi-step forms
- **Two Operation Modes**: Full visual editor or form-only mode
- **File Upload Support**: Base64 encoding with preview capabilities
- **AJAX Integration**: Dynamic option loading for select inputs
- **Responsive Design**: Bootstrap-compatible styling
- **Extensible Architecture**: Modular design with manager classes

## Installation

Include the WebWizard library and its dependencies in your HTML:

```html
<!-- Bootstrap CSS (required) -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">

<!-- WebWizard Library -->
<script src="path/to/webwizard.js" type="module"></script>

<!-- Bootstrap JS (required for modals) -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js"></script>
```

## Quick Start

### Basic Usage (Visual Editor Mode)

```html
<div id="wizard-container"></div>

<script type="module">
import { WebWizard } from './path/to/WebWizard.js';

const wizard = new WebWizard('wizard-container', {
    hiddenInputId: 'wizard-data',
    autoSave: true,
    onSave: (data) => {
        console.log('Form data:', data);
    }
});
</script>
```

### Form-Only Mode

```html
<div id="form-container"></div>
<input type="hidden" id="form-data" name="form_data">

<script type="module">
import { WebWizard } from './path/to/WebWizard.js';

const wizard = new WebWizard('form-container', {
    onlyForm: true,
    hiddenInputId: 'form-data',
    formAttributes: {
        action: '/submit',
        method: 'POST'
    },
    initialData: {
        nodes: [
            {
                id: 'name',
                type: 'text',
                content: 'Full Name',
                placeholder: 'Enter your full name',
                attributes: {
                    required: true,
                    'data-fv-not-empty': true,
                    'data-fv-not-empty___message': 'Name is required'
                }
            },
            {
                id: 'email',
                type: 'email',
                content: 'Email Address',
                placeholder: 'Enter your email',
                attributes: {
                    required: true,
                    'data-fv-email-address': true,
                    'data-fv-email-address___message': 'Invalid email address'
                }
            }
        ],
        connections: [
            {
                id: 'conn1',
                from: 'name',
                to: 'email',
                fromType: 'output',
                toType: 'input'
            }
        ]
    }
});
</script>
```

## Configuration Options

```javascript
const options = {
    // Data Management
    hiddenInputId: 'content',           // ID of hidden input for data storage
    autoSave: true,                     // Auto-save configuration changes
    initialData: null,                  // Pre-loaded form configuration
    
    // Form Options
    onlyForm: false,                    // Enable form-only mode (no visual editor)
    formAttributes: {                   // HTML attributes for the form element
        action: '/submit',
        method: 'POST',
        enctype: 'multipart/form-data'
    },
    hiddenFields: {                     // Additional hidden fields
        'csrf_token': 'abc123',
        'form_id': 'wizard_form'
    },
    defaultFormData: {                  // Default values for form fields
        'field_name': 'default_value'
    },
    
    // UI Options
    showProgressTracker: true,          // Show progress indicator
    
    // Logging
    enableLogging: true,                // Enable console logging
    debugLevel: 'info',                 // Logging level: 'error', 'warn', 'info', 'debug'
    
    // Callbacks
    onSave: (data) => {},              // Called when form is saved
    onChange: (data) => {}             // Called when configuration changes
};
```

## Node Types

### Text Inputs
```javascript
{
    id: 'username',
    type: 'text',           // 'text', 'email', 'password', 'number'
    content: 'Username',    // Field label
    placeholder: 'Enter username',
    help: 'Choose a unique username',
    attributes: {
        required: true,
        maxlength: 50,
        'data-fv-not-empty': true,
        'data-fv-not-empty___message': 'Username is required'
    }
}
```

### Textarea
```javascript
{
    id: 'description',
    type: 'textarea',
    content: 'Description',
    placeholder: 'Enter description...',
    attributes: {
        rows: 4,
        maxlength: 500
    }
}
```

### Select Dropdown
```javascript
{
    id: 'country',
    type: 'select',
    content: 'Select Country',
    options: [
        { value: 'us', description: 'United States' },
        { value: 'ca', description: 'Canada' },
        { value: 'uk', description: 'United Kingdom' }
    ],
    attributes: {
        // For AJAX loading
        'data-xtz-url': '/api/countries'
    }
}
```

### Radio Buttons
```javascript
{
    id: 'gender',
    type: 'radio',
    content: 'Gender',
    options: [
        { value: 'male', description: 'Male', id: 'gender_male', name: 'gender' },
        { value: 'female', description: 'Female', id: 'gender_female', name: 'gender' },
        { value: 'other', description: 'Other', id: 'gender_other', name: 'gender' }
    ],
    defaultRadioValue: 'male'  // Pre-select option
}
```

### Checkboxes
```javascript
{
    id: 'interests',
    type: 'checkbox',
    content: 'Select your interests',
    options: [
        { value: 'sports', description: 'Sports', id: 'interest_sports', name: 'interests[]' },
        { value: 'music', description: 'Music', id: 'interest_music', name: 'interests[]' },
        { value: 'travel', description: 'Travel', id: 'interest_travel', name: 'interests[]' }
    ]
}
```

### File Upload
```javascript
{
    id: 'avatar',
    type: 'file',
    content: 'Profile Picture',
    attributes: {
        accept: 'image/*',
        multiple: false
    }
}
```

### Range Slider
```javascript
{
    id: 'age',
    type: 'range',
    content: 'Age',
    attributes: {
        min: 18,
        max: 100,
        value: 25,
        step: 1
    }
}
```

### Hidden Field
```javascript
{
    id: 'user_id',
    type: 'hidden',
    content: '12345',
    attributes: {
        value: '12345'
    }
}
```

## Form Validation

WebWizard supports comprehensive form validation using data attributes:

### Basic Validation
```javascript
attributes: {
    'data-xtz-validate': true,           // Enable validation
    'data-fv-not-empty': true,           // Required field
    'data-fv-not-empty___message': 'This field is required'
}
```

### Email Validation
```javascript
attributes: {
    'data-fv-email-address': true,
    'data-fv-email-address___message': 'Please enter a valid email address'
}
```

### String Length Validation
```javascript
attributes: {
    'data-fv-string-length': true,
    'data-fv-string-length___min': 5,
    'data-fv-string-length___max': 20,
    'data-fv-string-length___message': 'Must be between 5-20 characters'
}
```

### Numeric Validation
```javascript
attributes: {
    'data-fv-numeric': true,
    'data-fv-numeric___message': 'Please enter a valid number'
}
```

## Connections and Flow Control

### Basic Connection
```javascript
{
    id: 'conn1',
    from: 'node1',      // Source node ID
    to: 'node2',        // Target node ID
    fromType: 'output', // Connection type: 'output', 'option'
    toType: 'input'     // Always 'input' for target
}
```

### Option-based Connection (for select/radio)
```javascript
{
    id: 'conn2',
    from: 'question1',
    to: 'followup1',
    fromType: 'option',
    toType: 'input',
    optionIndex: 0      // Index of the option
}
```

## API Methods

### Data Management
```javascript
// Get current configuration
const data = wizard.getData();

// Load configuration
wizard.loadData({
    nodes: [...],
    connections: [...]
});

// Save configuration
wizard.saveConfiguration();
```

### Node Management
```javascript
// Add node programmatically
const node = wizard.nodeManager.addNode({
    type: 'text',
    x: 100,
    y: 100,
    content: 'New Field'
});

// Get node
const node = wizard.nodeManager.getNode('nodeId');

// Delete node
wizard.deleteNode('nodeId');
```

### Form Testing
```javascript
// Start form test
wizard.testBot();

// Execute specific node
wizard.executeTestNode('nodeId');
```

## Events and Callbacks

### Form Submission
```javascript
const wizard = new WebWizard('container', {
    onSave: (formData) => {
        // Handle form submission
        console.log('Form data:', formData);
        
        // Send to server
        fetch('/api/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
    }
});
```

### Configuration Changes
```javascript
const wizard = new WebWizard('container', {
    onChange: (configuration) => {
        // Handle configuration changes
        localStorage.setItem('wizard-config', JSON.stringify(configuration));
    }
});
```

## Advanced Features

### Progress Tracking
Enable progress indicators for multi-step forms:

```javascript
const wizard = new WebWizard('container', {
    showProgressTracker: true,
    onlyForm: true
});
```

### AJAX Select Options
Load select options dynamically:

```javascript
{
    id: 'dynamic_select',
    type: 'select',
    content: 'Dynamic Options',
    attributes: {
        'data-xtz-url': '/api/options'
    }
}
```

Expected API response format:
```json
{
    "option1": { "value": "val1", "description": "Option 1" },
    "option2": { "value": "val2", "description": "Option 2" }
}
```

### File Upload Handling
Files are automatically converted to Base64 format:

```javascript
// Access file data
const fileData = wizard.formData.get('file_field');
console.log(fileData.base64);     // Base64 encoded file
console.log(fileData.fileName);   // Original filename
console.log(fileData.mimeType);   // File MIME type
```

## Styling and Customization

WebWizard uses Bootstrap classes and provides additional CSS classes:

### Custom CSS Classes
```css
/* Node styling */
.node.selected {
    border-color: #007bff;
    box-shadow: 0 0 0 3px rgba(0,123,255,0.25);
}

/* Progress tracker styling */
.progress-tracker {
    background: rgba(5, 18, 58, 0.955);
    border-radius: 8px;
}

/* Validation errors */
.validation-error-message {
    color: #dc3545;
    font-size: 0.875em;
}
```

## Browser Support

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## Dependencies

- Bootstrap 5.x (CSS and JS)
- Modern browser with ES6 module support

## License

This library is provided as-is. Please check with the author for licensing terms.

## Contributing

For bug reports, feature requests, or contributions, please contact the library author.

## Examples

### Complete Registration Form
```javascript
const registrationWizard = new WebWizard('registration-form', {
    onlyForm: true,
    formAttributes: {
        action: '/register',
        method: 'POST'
    },
    showProgressTracker: true,
    initialData: {
        nodes: [
            {
                id: 'personal_info',
                type: 'text',
                content: 'Full Name',
                attributes: {
                    required: true,
                    'data-fv-not-empty': true,
                    'data-fv-not-empty___message': 'Name is required'
                }
            },
            {
                id: 'email',
                type: 'email',
                content: 'Email Address',
                attributes: {
                    required: true,
                    'data-fv-email-address': true
                }
            },
            {
                id: 'password',
                type: 'password',
                content: 'Password',
                attributes: {
                    'data-fv-string-length': true,
                    'data-fv-string-length___min': 8,
                    'data-fv-string-length___message': 'Password must be at least 8 characters'
                }
            },
            {
                id: 'country',
                type: 'select',
                content: 'Country',
                attributes: {
                    'data-xtz-url': '/api/countries'
                }
            }
        ],
        connections: [
            { id: 'c1', from: 'personal_info', to: 'email', fromType: 'output', toType: 'input' },
            { id: 'c2', from: 'email', to: 'password', fromType: 'output', toType: 'input' },
            { id: 'c3', from: 'password', to: 'country', fromType: 'output', toType: 'input' }
        ]
    },
    onSave: (data) => {
        console.log('Registration data:', data);
    }
});
```

This README provides comprehensive documentation for your WebWizard library, covering installation, configuration, usage examples, and advanced features. Users should be able to get started quickly and understand the full capabilities of your library.
