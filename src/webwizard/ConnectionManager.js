export class ConnectionManager {
    constructor(logger) {
        this.logger = logger;
        this.connections = [];
    }

    addConnection(connectionData) {
        try {
            this.logger.info('ConnectionManager', 'addConnection', 'Adding new connection', connectionData);
            
            const connection = {
                id: connectionData.id || `conn_${Date.now()}`,
                from: connectionData.from,
                to: connectionData.to,
                fromType: connectionData.fromType || 'output',
                toType: connectionData.toType || 'input',
                optionIndex: connectionData.optionIndex
            };

            // Validar que no existe la misma conexión
            const exists = this.connections.some(c => 
                c.from === connection.from && 
                c.to === connection.to && 
                c.fromType === connection.fromType &&
                c.optionIndex === connection.optionIndex
            );

            if (exists) {
                this.logger.warn('ConnectionManager', 'addConnection', 'Connection already exists', connection);
                return null;
            }

            this.connections.push(connection);
            
            this.logger.info('ConnectionManager', 'addConnection', 'Connection added successfully', {
                connectionId: connection.id
            });
            
            return connection;
        } catch (error) {
            this.logger.error('ConnectionManager', 'addConnection', 'Failed to add connection', {
                connectionData, error: error.message
            });
            throw error;
        }
    }

    setConnections(connections){
        return this.connections = connections;
    }

    getConnection(connectionId) {
        const connection = this.connections.find(c => c.id === connectionId);
        if (!connection) {
            this.logger.warn('ConnectionManager', 'getConnection', `Connection not found: ${connectionId}`);
        }
        return connection;
    }

    getConnectionsFrom(nodeId, fromType = null, optionIndex = null) {
        const connections = this.connections.filter(c => {
            if (c.from !== nodeId) return false;
            if (fromType && c.fromType !== fromType) return false;
            if (optionIndex !== null && c.optionIndex != optionIndex) return false;
            return true;
        });

        this.logger.debug('ConnectionManager', 'getConnectionsFrom', 'Found connections', {
            nodeId, fromType, optionIndex, count: connections.length
        });

        return connections;
    }

    getConnectionsTo(nodeId) {
        const connections = this.connections.filter(c => c.to === nodeId);
        this.logger.debug('ConnectionManager', 'getConnectionsTo', 'Found connections', {
            nodeId, count: connections.length
        });
        return connections;
    }

    deleteConnection(connectionId) {
        try {
            const connectionIndex = this.connections.findIndex(c => c.id === connectionId);
            if (connectionIndex === -1) {
                this.logger.warn('ConnectionManager', 'deleteConnection', `Connection not found: ${connectionId}`);
                return false;
            }

            const deletedConnection = this.connections.splice(connectionIndex, 1)[0];
            
            this.logger.info('ConnectionManager', 'deleteConnection', 'Connection deleted successfully', {
                connectionId, deletedConnection
            });
            
            return true;
        } catch (error) {
            this.logger.error('ConnectionManager', 'deleteConnection', 'Failed to delete connection', {
                connectionId, error: error.message
            });
            return false;
        }
    }

    deleteConnectionsForNode(nodeId) {
        try {
            const initialCount = this.connections.length;
            this.connections = this.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
            const deletedCount = initialCount - this.connections.length;
            
            this.logger.info('ConnectionManager', 'deleteConnectionsForNode', 
                `Deleted ${deletedCount} connections for node ${nodeId}`);
            
            return deletedCount;
        } catch (error) {
            this.logger.error('ConnectionManager', 'deleteConnectionsForNode', 'Failed to delete connections', {
                nodeId, error: error.message
            });
            return 0;
        }
    }

    validateConnections(nodeManager) {
        const errors = [];
        
        try {
            this.connections.forEach(connection => {
                const fromNode = nodeManager.getNode(connection.from);
                const toNode = nodeManager.getNode(connection.to);
                
                if (!fromNode) {
                    errors.push(`Connection ${connection.id} references non-existent from node: ${connection.from}`);
                }
                if (!toNode) {
                    errors.push(`Connection ${connection.id} references non-existent to node: ${connection.to}`);
                }
            });

            this.logger.info('ConnectionManager', 'validateConnections', 'Connection validation completed', {
                totalConnections: this.connections.length,
                errors: errors.length
            });

            return { isValid: errors.length === 0, errors };
        } catch (error) {
            this.logger.error('ConnectionManager', 'validateConnections', 'Connection validation failed', {
                error: error.message
            });
            return { isValid: false, errors: ['Validation process failed'] };
        }
    }

    getAllConnections() {
        return [...this.connections];
    }

    clearConnections() {
        const connectionCount = this.connections.length;
        this.connections = [];
        
        this.logger.info('ConnectionManager', 'clearConnections', `Cleared ${connectionCount} connections`);
    }
}