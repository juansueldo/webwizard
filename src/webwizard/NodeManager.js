export class NodeManager {
    constructor(logger, domManager) {
        this.logger = logger;
        this.domManager = domManager;
        this.nodes = [];
        this.nodeIdCounter = 1;
    }

    addNode(nodeData) {
        try {
            this.logger.info('NodeManager', 'addNode', 'Adding new node', { nodeData });
            
            const node = {
                id: nodeData.id || `node_${this.nodeIdCounter++}`,
                type: nodeData.type || 'text',
                x: nodeData.x || 100,
                y: nodeData.y || 100,
                title: nodeData.title || this.getNodeTitle(nodeData.type),
                content: nodeData.content || this.getNodeDefaultContent(nodeData.type),
                context: nodeData.context || '',
                placeholder: nodeData.placeholder || '',
                help: nodeData.help || '',
                attributes: nodeData.attributes || {},
                ...nodeData
            };

            // Agregar opciones para tipos que las requieren
            if (['question', 'select', 'checkbox', 'radio'].includes(node.type)) {
                node.options = nodeData.options || [
                    { value: 'option1', description: 'Option 1' },
                    { value: 'option2', description: 'Option 2' }
                ];
            }

            this.nodes.push(node);
            
            this.logger.info('NodeManager', 'addNode', 'Node added successfully', {
                nodeId: node.id,
                nodeType: node.type
            });
            
            return node;
        } catch (error) {
            this.logger.error('NodeManager', 'addNode', 'Failed to add node', {
                nodeData, error: error.message
            });
            throw error;
        }
    }

    setNodes(nodes){
       return this.nodes = nodes;
    }

    getNode(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (!node) {
            this.logger.warn('NodeManager', 'getNode', `Node not found: ${nodeId}`);
        }
        return node;
    }

    getNodeByType(type){
        const node = this.nodes.find(n => n.type === type);
        if (!node) {
            this.logger.warn('NodeManager', 'getNode', `Node not found: ${type}`);
        }
        return node;
    }

    matchesNodeInput(input) {
        return this.nodes.some(node => {
            const fieldName = node?.attributes?.name || `field_${node.id}`;
            return input.name === fieldName || input.name === `${fieldName}[]`;
        });
    }


    updateNode(nodeId, updates) {
        try {
            const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
            if (nodeIndex === -1) {
                throw new Error(`Node ${nodeId} not found`);
            }

            const oldNode = { ...this.nodes[nodeIndex] };
            this.nodes[nodeIndex] = { ...this.nodes[nodeIndex], ...updates };
            
            this.logger.info('NodeManager', 'updateNode', 'Node updated successfully', {
                nodeId, oldNode, newNode: this.nodes[nodeIndex]
            });
            
            return this.nodes[nodeIndex];
        } catch (error) {
            this.logger.error('NodeManager', 'updateNode', 'Failed to update node', {
                nodeId, updates, error: error.message
            });
            throw error;
        }
    }

    deleteNode(nodeId) {
        try {
            if (nodeId === 'start') {
                this.logger.warn('NodeManager', 'deleteNode', 'Cannot delete start node');
                return false;
            }

            const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
            if (nodeIndex === -1) {
                this.logger.warn('NodeManager', 'deleteNode', `Node not found: ${nodeId}`);
                return false;
            }

            const deletedNode = this.nodes.splice(nodeIndex, 1)[0];
            
            this.logger.info('NodeManager', 'deleteNode', 'Node deleted successfully', {
                nodeId, deletedNode
            });
            
            return true;
        } catch (error) {
            this.logger.error('NodeManager', 'deleteNode', 'Failed to delete node', {
                nodeId, error: error.message
            });
            return false;
        }
    }

    getNodeTitle(type) {
        const titles = {
            text: 'Input text', email: 'Input Email', password: 'Input Password',
            number: 'Input number', textarea: 'Text Area', select: 'Dropdown',
            checkbox: 'Checkboxes', radio: 'Radio Buttons', file: 'File',
            range: 'Range', hidden: 'Hidden'
        };
        return titles[type] || 'Node';
    }

    getNodeDefaultContent(type) {
        const contents = {
            message: 'Write your message here',
            question: 'What is your question?',
            condition: 'Condition to evaluate',
            action: 'Action to execute'
        };
        return contents[type] || 'Content';
    }

    validateNodes() {
        const errors = [];
        
        try {
            const startNode = this.nodes.find(n => n.type === 'start');
            if (!startNode) {
                errors.push('Missing start node');
            }

            this.nodes.forEach(node => {
                if (!node.id) errors.push(`Node without ID found`);
                if (!node.type) errors.push(`Node ${node.id} without type`);
                if (!node.title) errors.push(`Node ${node.id} without title`);
            });

            this.logger.info('NodeManager', 'validateNodes', 'Node validation completed', {
                totalNodes: this.nodes.length,
                errors: errors.length
            });

            return { isValid: errors.length === 0, errors };
        } catch (error) {
            this.logger.error('NodeManager', 'validateNodes', 'Node validation failed', {
                error: error.message
            });
            return { isValid: false, errors: ['Validation process failed'] };
        }
    }

    getAllNodes() {
        return [...this.nodes];
    }

    clearNodes() {
        const nodeCount = this.nodes.length;
        this.nodes = [];
        this.nodeIdCounter = 1;
        
        this.logger.info('NodeManager', 'clearNodes', `Cleared ${nodeCount} nodes`);
    }
}
