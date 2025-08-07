export class ProgressTracker {
    constructor(logger, nodeManager, connectionManager) {
        this.logger = logger;
        this.nodeManager = nodeManager;
        this.connectionManager = connectionManager;
    }

    getProgressPath(startNodeId = 'start') {
        const path = [];
        const visited = new Set();
        
        this.buildPath(startNodeId, path, visited);
        return path;
    }

    buildPath(nodeId, path, visited) {
        if (visited.has(nodeId)) return;
        
        const node = this.nodeManager.getNode(nodeId);
        if (!node) return;

        visited.add(nodeId);
        
        // Solo incluir nodos que no sean 'start' y que sean campos de formulario
        if (node.type !== 'start' && this.isFormField(node)) {
            path.push({
                id: node.id,
                title: node.content || node.title || `Step ${path.length + 1}`,
                type: node.type
            });
        }

        // Buscar conexiones salientes
        const connections = this.connectionManager.getConnectionsFrom(nodeId, 'output');
        if (connections.length > 0) {
            // Para simplicidad, seguir la primera conexión
            this.buildPath(connections[0].to, path, visited);
        }
    }

    isFormField(node) {
        const formFieldTypes = [
            'text', 'email', 'password', 'number', 'textarea', 
            'select', 'checkbox', 'radio', 'file', 'range',
        ];
        return formFieldTypes.includes(node.type);
    }

    getCurrentStepIndex(currentNodeId, progressPath) {
        return progressPath.findIndex(step => step.id === currentNodeId);
    }
}