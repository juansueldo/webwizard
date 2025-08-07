import { Logger } from "./Logger.js";
import { ConnectionManager } from "./ConnectionManager.js";
import { FormManager } from "./FormManager.js";
import { ElementManager } from "./ElementManager.js";
import { EventManager } from "./EventManager.js";
import { NodeManager } from "./NodeManager.js";
import { ValidationManager } from "./ValidationManager.js";
import { ProgressTracker } from "./ProgressTracker.js";

export class WebWizard {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with ID '${containerId}' not found`);
        }

        this.options = {
            hiddenInputId: options.hiddenInputId || 'content',
            autoSave: options.autoSave !== false,
            initialData: options.initialData || null,
            onSave: options.onSave || null,
            onChange: options.onChange || null,
            onlyForm: options.onlyForm || false,
            formAttributes: options.formAttributes || null,
            hiddenFields: options.hiddenFields || {},
            defaultFormData: options.defaultFormData || null,
            debugLevel: options.debugLevel || 'info',
            enableLogging: options.enableLogging !== false,
            showProgressTracker: options.showProgressTracker !== false,
            ...options
        };

        this.logger = new Logger(this.options.enableLogging, this.options.debugLevel);
        this.eventManager = new EventManager(this.logger);
        this.elementManager = new ElementManager(this.logger, this.eventManager);
        this.nodeManager = new NodeManager(this.logger, this.elementManager);
        this.connectionManager = new ConnectionManager(this.logger);
        this.formManager = new FormManager(this.logger, this.elementManager, this.eventManager);
        this.validationManager = new ValidationManager(this.logger); // NUEVO
        this.progressTracker = new ProgressTracker(this.logger, this.nodeManager, this.connectionManager);

        this.selectedNode = null;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.canvasOffset = { x: 0, y: 0 };
        this.scale = 1;
        this.isCanvasDragging = false;
        this.canvasDragStart = { x: 0, y: 0 };
        this.isConnecting = false;
        this.connectionStart = null;
        this.currentEditingNode = null;
        this.testHistory = [];
        this.progressPath = []; // NUEVO
        this.currentStepIndex = -1; // NUEVO

        this.logger.info('WebWizard', 'constructor', 'WebWizard initialized', {
            containerId, options: this.options
        });

        // Inicializar
        this.loadLegacyDefaultFormData();
        this.init();
    }

    init() {
        try {
            this.logger.info('WebWizard', 'init', 'Starting initialization');

            if (this.options.onlyForm) {
                this.initFormMode();
            } else {
                this.initNormalMode();
            }

            this.logger.info('WebWizard', 'init', 'Initialization completed successfully');
        } catch (error) {
            this.logger.error('WebWizard', 'init', 'Initialization failed', {
                error: error.message, stack: error.stack
            });
            throw error;
        }
    }

    loadLegacyDefaultFormData() {
        this.logger.info('WebWizard', 'loadLegacyDefaultFormData', 'Loading legacy default form data');
        if(this.options.defaultFormData !== null){
            Object.entries(this.options.defaultFormData).forEach(([key, value]) => {
                if (!this.options.initialData || !Array.isArray(this.options.initialData.nodes)) return;
                console.log(this.options.initialData.nodes)
                this.options.initialData.nodes.forEach(node => {
                    const attrs = node.attributes || {};
                    console.log(key)
                    if (attrs.id === key || attrs.name === key) {
                        console.log(key)
                        attrs.value = value;
                        node.attributes = attrs;
    
                    }
                });
            });
        }
    }


    initFormMode() {
        this.logger.info('WebWizard', 'initFormMode', 'Initializing form-only mode');
        
        if (this.options.initialData) {
            this.loadData(this.options.initialData);
        } else {
            this.loadFromHiddenInput();
            if (this.nodeManager.getAllNodes().length === 0) {
                this.addStartNode();
            }
        }

        // NUEVO: Inicializar valores por defecto para todos los nodos
        const allNodes = this.nodeManager.getAllNodes();
        allNodes.forEach(node => {
            this.initializeDefaultValues(node);
        });

        // CORRECCIÓN: Iniciar desde el primer nodo no-start
        const startNode = this.nodeManager.getNodeByType('start');
        if (startNode) {
            this.executeTestNode(startNode.id);
        } else {
            // Si no hay nodo start, buscar el primer nodo disponible
            const firstNode = allNodes.find(node => node.type !== 'start');
            if (firstNode) {
                this.executeTestNode(firstNode.id);
            }
        }
        
        this.updateMinimap();
        this.saveConfiguration();
    }

    loadFromHiddenInput() {
        try {
            const hiddenInput = document.getElementById(this.options.hiddenInputId);
            if (hiddenInput && hiddenInput.value) {
                const data = JSON.parse(hiddenInput.value);
                this.loadData(data);
                this.logger.info('WebWizard', 'loadFromHiddenInput', 'Data loaded from hidden input');
            }
        } catch (e) {
            this.logger.warn('WebWizard', 'loadFromHiddenInput', 'Error parsing initial data', {
                error: e.message
            });
        }
    }

    addStartNode() {
        const startNode = {
            id: 'start',
            type: 'start',
            x: 400,
            y: 300,
            title: 'Start',
            content: 'Start configuration'
        };
        
        const node = this.nodeManager.addNode(startNode);
        if (!this.options.onlyForm) {
            this.renderNode(node);
        }
    }

    // =============================================================================
    // MÉTODOS DE INTERFAZ VISUAL
    // =============================================================================
    
    createHTML() {
        try {
            this.logger.info('WebWizard', 'createHTML', 'Creating HTML interface');
            
            this.container.innerHTML = this.getHTMLTemplate();
            
            // Registrar instancia global
            if (!window.webWizardInstances) {
                window.webWizardInstances = {};
            }
            window.webWizardInstances[this.containerId] = this;
            
            this.logger.info('WebWizard', 'createHTML', 'HTML interface created successfully');
        } catch (error) {
            this.logger.error('WebWizard', 'createHTML', 'Failed to create HTML interface', {
                error: error.message
            });
            throw error;
        }
    }

    getHTMLTemplate() {
        return `
            <div class="webwizard-container" style="position: relative; width: 100%; height: 690px; overflow: hidden;">
                <div class="webwizard-toolbar" style="position: absolute; top: 10px; left: 10px; z-index: 1000; display: flex; gap: 5px; flex-wrap: wrap;">
                    <select class="form-select form-select-sm" id="${this.containerId}_nodeType" style="width: auto;">
                        <option value="text">Text Input</option>
                        <option value="email">Email Input</option>
                        <option value="password">Password Input</option>
                        <option value="number">Number Input</option>
                        <option value="textarea">Text Area</option>
                        <option value="select">Dropdown</option>
                        <option value="checkbox">Checkboxes</option>
                        <option value="radio">Radio Buttons</option>
                        <option value="file">File Upload</option>
                        <option value="range">Range</option>
                        <option value="hidden">Hidden Input</option>
                    </select>
                    <a class="btn btn-sm btn-primary" onclick="window.webWizardInstances['${this.containerId}'].addNode()">Add Node</a>
                    <a class="btn btn-sm btn-success" onclick="window.webWizardInstances['${this.containerId}'].testBot()">Test</a>
                    <a class="btn btn-sm btn-info" onclick="window.webWizardInstances['${this.containerId}'].saveBot()">Export</a>
                    <a class="btn btn-sm btn-warning" onclick="window.webWizardInstances['${this.containerId}'].loadBot()">Import</a>
                </div>

                <div class="webwizard-zoom-controls" style="position: absolute; top: 10px; right: 10px; z-index: 1000; display: flex; gap: 5px;">
                    <a class="btn btn-sm btn-outline-secondary" onclick="window.webWizardInstances['${this.containerId}'].zoomIn()">+</a>
                    <a class="btn btn-sm btn-outline-secondary" onclick="window.webWizardInstances['${this.containerId}'].resetZoom()">Reset</a>
                    <a class="btn btn-sm btn-outline-secondary" onclick="window.webWizardInstances['${this.containerId}'].zoomOut()">-</a>
                </div>

                <div class="webwizard-canvas-container" style="width: 100%; height: 100%;  position: relative; overflow: hidden; cursor: grab;">
                    <svg id="${this.containerId}_connectionsSvg" style="position: absolute; top: 0; left: 0; width: 5000px; height: 5000px; pointer-events: none; z-index: 1;">
                    </svg>
                    <div id="${this.containerId}_canvas" class="webwizard-canvas" style="background: rgba(5, 18, 58, 0.955) !important; position: relative; width: 5000px; height: 5000px; transform-origin: 0 0;">
                    </div>
                </div>

                <div class="minimap">
                    <div id="${this.containerId}_minimapViewport" style="position: absolute; border: 2px solid #007bff; background: rgba(0,123,255,0.1);"></div>
                </div>

                <input type="file" id="${this.containerId}_fileInput" accept=".json" style="display: none;" onchange="window.webWizardInstances['${this.containerId}'].handleFileLoad(event)">
            </div>

            <div class="modal fade" id="${this.containerId}_modal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content" id="${this.containerId}_modalContent">
                    </div>
                </div>
            </div>

            ${this.getCSS()}
        `;
    }

    getCSS() {
        return `
            <style>
                .webwizard-container .node.selected {
                    border-color: #007bff;
                    box-shadow: 0 0 0 3px rgba(0,123,255,0.25);
                }
                .webwizard-container .node-start { border-color: #28a745; }
                .webwizard-container .node-message { border-color: #17a2b8; }
                .webwizard-container .node-question { border-color: #ffc107; }
                .webwizard-container .node-condition { border-color: #fd7e14; }
                .webwizard-container .node-action { border-color: #dc3545; }
                
                .webwizard-container .connection-point {
                    position: absolute;
                    width: 12px;
                    height: 12px;
                    border: 2px solid #007bff;
                    border-radius: 50%;
                    background: white;
                    cursor: crosshair;
                    z-index: 20;
                }
                .webwizard-container .connection-point.input {
                    left: -6px;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .webwizard-container .connection-point.output {
                    right: -6px;
                    top: 50%;
                    transform: translateY(-50%);
                }
                .webwizard-container .option-wizard {
                    position: relative;
                    border-radius: 4px;
                    padding: 6px;
                    margin: 4px 0;
                }
                .webwizard-container .option-connection {
                    position: absolute;
                    right: -6px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 10px;
                    height: 10px;
                    border: 2px solid #ffc107;
                    border-radius: 50%;
                    background: white;
                    cursor: crosshair;
                    z-index: 20;
                }
                .webwizard-container .connection-line {
                    stroke: #007bff;
                    stroke-width: 2;
                    fill: none;
                    pointer-events: stroke;
                    cursor: pointer;
                }
                .webwizard-container .connection-placeholder {
                    stroke: #6c757d;
                    stroke-width: 2;
                    stroke-dasharray: 5,5;
                    fill: none;
                }
                .webwizard-container .webwizard-canvas-container.dragging {
                    cursor: grabbing;
                }
                .webwizard-container .btn-close {
                    background: none;
                    border: none;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .webwizard-container .btn-close:before {
                    content: "×";
                }
                .node{
                    width: 150px;
                }
                .node-header {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.5rem;
                }
                .minimap {
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    width: 200px;
                    height: 150px;
                    background: var(--tblr-body-bg);
                    border: 1px solid black;
                    border-radius: 4px;
                    overflow: hidden;
                }
                .minimap-viewport {
                    position: absolute;
                    border: 2px solid #3498db;
                    background: rgba(52, 152, 219, 0.1);
                    cursor: move;
                }
            </style>
        `;
    }

    // =============================================================================
    // MANEJO DE EVENTOS
    // =============================================================================
    
    setupEvents() {
        try {
            this.logger.info('WebWizard', 'setupEvents', 'Setting up event handlers');
            
            const canvas = this.elementManager.findElement(`#${this.containerId}_canvas`);
            const canvasContainer = canvas.parentElement;

            // Eventos de canvas
            this.eventManager.addEventListener(canvasContainer, 'mousedown', (e) => {
                this.handleCanvasMouseDown(e, canvasContainer);
            });

            this.eventManager.addEventListener(document, 'mousemove', (e) => {
                this.handleDocumentMouseMove(e, canvas);
            });

            this.eventManager.addEventListener(document, 'mouseup', () => {
                this.handleDocumentMouseUp(canvasContainer);
            });

            this.logger.info('WebWizard', 'setupEvents', 'Event handlers set up successfully');
        } catch (error) {
            this.logger.error('WebWizard', 'setupEvents', 'Failed to setup events', {
                error: error.message
            });
            throw error;
        }
    }

    handleCanvasMouseDown(e, canvasContainer) {
        if (e.target === canvasContainer || e.target.classList.contains('webwizard-canvas')) {
            this.isCanvasDragging = true;
            this.canvasDragStart.x = e.clientX - this.canvasOffset.x;
            this.canvasDragStart.y = e.clientY - this.canvasOffset.y;
            canvasContainer.classList.add('dragging');
            
            this.logger.debug('WebWizard', 'handleCanvasMouseDown', 'Canvas drag started');
        }
    }

    handleDocumentMouseMove(e, canvas) {
        if (this.isDragging && this.selectedNode) {
            this.handleNodeDrag(e, canvas);
        } else if (this.isCanvasDragging) {
            this.handleCanvasDrag(e);
        }
    }

    handleNodeDrag(e, canvas) {
        try {
            const canvasRect = canvas.getBoundingClientRect();
            
            this.selectedNode.x = (e.clientX - canvasRect.left - this.canvasOffset.x) / this.scale - this.dragOffset.x;
            this.selectedNode.y = (e.clientY - canvasRect.top - this.canvasOffset.y) / this.scale - this.dragOffset.y;
            
            const nodeElement = document.getElementById(this.selectedNode.id);
            nodeElement.style.left = this.selectedNode.x + 'px';
            nodeElement.style.top = this.selectedNode.y + 'px';
            
            this.renderConnections();
            this.updateMinimap();
            this.saveConfiguration();
            
            this.logger.debug('WebWizard', 'handleNodeDrag', 'Node dragged', {
                nodeId: this.selectedNode.id,
                x: this.selectedNode.x,
                y: this.selectedNode.y
            });
        } catch (error) {
            this.logger.error('WebWizard', 'handleNodeDrag', 'Error during node drag', {
                error: error.message
            });
        }
    }

    handleCanvasDrag(e) {
        this.canvasOffset.x = e.clientX - this.canvasDragStart.x;
        this.canvasOffset.y = e.clientY - this.canvasDragStart.y;
        this.updateCanvasTransform();
        this.updateMinimap();
    }

    handleDocumentMouseUp(canvasContainer) {
        if (this.isDragging || this.isCanvasDragging) {
            this.logger.debug('WebWizard', 'handleDocumentMouseUp', 'Drag ended', {
                wasDraggingNode: this.isDragging,
                wasDraggingCanvas: this.isCanvasDragging
            });
        }

        this.isDragging = false;
        this.selectedNode = null;
        this.isCanvasDragging = false;
        canvasContainer.classList.remove('dragging');
    }

    // =============================================================================
    // MANEJO DE NODOS
    // =============================================================================
    
    addNode() {
        try {
            const type = this.elementManager.findElement(`#${this.containerId}_nodeType`).value;
            const container = this.container.querySelector('.webwizard-canvas-container');
            const containerRect = container.getBoundingClientRect();

            const centerX = (-this.canvasOffset.x + containerRect.width / 2) / this.scale;
            const centerY = (-this.canvasOffset.y + containerRect.height / 4) / this.scale;

            const nodeData = {
                type: type,
                x: centerX,
                y: centerY
            };

            const node = this.nodeManager.addNode(nodeData);
            this.renderNode(node);
            this.saveConfiguration();
            this.updateMinimap();
            
            this.logger.info('WebWizard', 'addNode', 'Node added successfully', {
                nodeId: node.id, nodeType: node.type
            });
        } catch (error) {
            this.logger.error('WebWizard', 'addNode', 'Failed to add node', {
                error: error.message
            });
        }
    }

    renderNode(node) {
        try {
            this.logger.debug('WebWizard', 'renderNode', 'Rendering node', { nodeId: node.id });
            
            const canvas = this.elementManager.findElement(`#${this.containerId}_canvas`);
            const nodeElement = this.elementManager.createElement('div', {
                className: 'card node',
                id: node.id
            });
            
            nodeElement.style.left = node.x + 'px';
            nodeElement.style.top = node.y + 'px';

            const connectionPoints = this.getConnectionPointsHTML(node);
            const optionsHtml = this.getNodeOptionsHTML(node);

            nodeElement.innerHTML = `
                ${connectionPoints}
                <div class="card-header node-header">
                    <span>${node.title}</span>
                    ${node.type !== 'start' ? `<button class="btn-close" onclick="window.webWizardInstances['${this.containerId}'].deleteNode('${node.id}')"></button>` : ''}
                </div>
                <div class="node-content p-2" ondblclick="window.webWizardInstances['${this.containerId}'].editNode('${node.id}')">
                    ${node.content}
                    ${optionsHtml}
                </div>
            `;

            canvas.appendChild(nodeElement);
            this.setupNodeEvents(nodeElement, node);
            
            this.logger.debug('WebWizard', 'renderNode', 'Node rendered successfully', { nodeId: node.id });
        } catch (error) {
            this.logger.error('WebWizard', 'renderNode', 'Failed to render node', {
                nodeId: node.id, error: error.message
            });
        }
    }

    getConnectionPointsHTML(node) {
        let connectionPoints = '';
        
        if (node.type !== 'start') {
            connectionPoints += '<div class="connection-point input" data-type="input"></div>';
        }
        
        if (node.type !== 'question') {
            connectionPoints += '<div class="connection-point output" data-type="output"></div>';
        }
        
        return connectionPoints;
    }

    getNodeOptionsHTML(node) {
        if (!['question', 'select', 'radio'].includes(node.type) || !node.options) {
            return '';
        }

        return node.options.map((option, index) => 
            `<div class="card option-wizard mb-1 p-2" data-option-index="${index}">
                ${option.description}
                <div class="option-connection" data-type="option" data-option-index="${index}"></div>
            </div>`
        ).join('');
    }

    setupNodeEvents(nodeElement, node) {
        try {
            this.eventManager.addEventListener(nodeElement, 'mousedown', (e) => {
                this.handleNodeMouseDown(e, nodeElement, node);
            });

            const connectionPoints = nodeElement.querySelectorAll('.connection-point, .option-connection');
            connectionPoints.forEach(point => {
                this.eventManager.addEventListener(point, 'mousedown', (e) => {
                    e.stopPropagation();
                    this.startConnection(point, node, e);
                });
            });

            this.logger.debug('WebWizard', 'setupNodeEvents', 'Node events set up', { nodeId: node.id });
        } catch (error) {
            this.logger.error('WebWizard', 'setupNodeEvents', 'Failed to setup node events', {
                nodeId: node.id, error: error.message
            });
        }
    }

    handleNodeMouseDown(e, nodeElement, node) {
        if (e.target.classList.contains('connection-point') || 
            e.target.classList.contains('option-connection') ||
            e.target.classList.contains('btn-close')) {
            return;
        }
        
        this.selectedNode = node;
        this.isDragging = true;
        
        const rect = nodeElement.getBoundingClientRect();
        const canvasRect = document.getElementById(`${this.containerId}_canvas`).getBoundingClientRect();
        
        const cursorX = (e.clientX - canvasRect.left - this.canvasOffset.x) / this.scale;
        const cursorY = (e.clientY - canvasRect.top - this.canvasOffset.y) / this.scale;

        this.dragOffset.x = cursorX - node.x;
        this.dragOffset.y = cursorY - node.y;
        
        nodeElement.classList.add('selected');
        document.querySelectorAll(`#${this.containerId} .node`).forEach(n => {
            if (n !== nodeElement) n.classList.remove('selected');
        });
        
        e.preventDefault();
        
        this.logger.debug('WebWizard', 'handleNodeMouseDown', 'Node selection started', {
            nodeId: node.id
        });
    }

    deleteNode(nodeId) {
        try {
            this.logger.info('WebWizard', 'deleteNode', 'Deleting node', { nodeId });
            
            if (!this.nodeManager.deleteNode(nodeId)) {
                return;
            }

            this.connectionManager.deleteConnectionsForNode(nodeId);
            this.elementManager.removeElement(nodeId);
            
            this.renderConnections();
            this.updateMinimap();
            this.saveConfiguration();
            
            this.logger.info('WebWizard', 'deleteNode', 'Node deleted successfully', { nodeId });
        } catch (error) {
            this.logger.error('WebWizard', 'deleteNode', 'Failed to delete node', {
                nodeId, error: error.message
            });
        }
    }

    // =============================================================================
    // MANEJO DE CONEXIONES (Mantiene la funcionalidad original)
    // =============================================================================
    
    startConnection(point, node, e) {
        try {
            this.isConnecting = true;
            const pointType = point.dataset.type;
            const optionIndex = point.dataset.optionIndex;
            
            this.connectionStart = {
                nodeId: node.id,
                type: pointType,
                optionIndex: optionIndex,
                element: point
            };

            const mouseMoveHandler = (e) => this.handleConnectionDrag(e);
            const mouseUpHandler = (e) => this.handleConnectionEnd(e, mouseMoveHandler, mouseUpHandler);
            
            this.eventManager.addEventListener(document, 'mousemove', mouseMoveHandler);
            this.eventManager.addEventListener(document, 'mouseup', mouseUpHandler);
            
            e.preventDefault();
            
            this.logger.debug('WebWizard', 'startConnection', 'Connection started', {
                fromNodeId: node.id, pointType, optionIndex
            });
        } catch (error) {
            this.logger.error('WebWizard', 'startConnection', 'Failed to start connection', {
                error: error.message
            });
        }
    }

    handleConnectionDrag(e) {
        if (!this.isConnecting || !this.connectionStart) return;

        try {
            const svg = this.elementManager.findElement(`#${this.containerId}_connectionsSvg`);
            const svgRect = svg.getBoundingClientRect();

            const fromNodeElement = document.getElementById(this.connectionStart.nodeId);
            if (!fromNodeElement) return;

            let fromPointElement = null;
            if (this.connectionStart.type === 'option') {
                fromPointElement = fromNodeElement.querySelector(`.option-connection[data-option-index="${this.connectionStart.optionIndex}"]`);
            } else if (this.connectionStart.type === 'output') {
                fromPointElement = fromNodeElement.querySelector('.connection-point.output');
            } else {
                fromPointElement = fromNodeElement.querySelector('.connection-point.input');
            }
            if (!fromPointElement) return;

            const fromRect = fromPointElement.getBoundingClientRect();
            const startX = fromRect.left + fromRect.width / 2 - svgRect.left;
            const startY = fromRect.top + fromRect.height / 2 - svgRect.top;
            const mouseX = e.clientX - svgRect.left;
            const mouseY = e.clientY - svgRect.top;

            const existingPlaceholder = svg.querySelector('.connection-placeholder');
            if (existingPlaceholder) {
                existingPlaceholder.remove();
            }

            const placeholder = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            placeholder.classList.add('connection-placeholder');
            const path = this.createCurvedPath(startX, startY, mouseX, mouseY);
            placeholder.setAttribute('d', path);
            svg.appendChild(placeholder);
        } catch (error) {
            this.logger.error('WebWizard', 'handleConnectionDrag', 'Error during connection drag', {
                error: error.message
            });
        }
    }

    handleConnectionEnd(e, mouseMoveHandler, mouseUpHandler) {
        try {
            if (!this.isConnecting) return;

            const target = e.target;
            let targetNode = null;
            let targetType = null;

            if (target.classList.contains('connection-point') && target.dataset.type === 'input') {
                const nodeElement = target.closest('.node');
                targetNode = this.nodeManager.getNode(nodeElement.id);
                targetType = 'input';
            }

            if (targetNode && this.connectionStart.nodeId !== targetNode.id) {
                const connectionData = {
                    from: this.connectionStart.nodeId,
                    to: targetNode.id,
                    fromType: this.connectionStart.type,
                    toType: targetType,
                    optionIndex: this.connectionStart.optionIndex
                };
                
                const connection = this.connectionManager.addConnection(connectionData);
                if (connection) {
                    this.renderConnections();
                    this.saveConfiguration();
                    this.logger.info('WebWizard', 'handleConnectionEnd', 'Connection created', {
                        connectionId: connection.id
                    });
                }
            }

            this.cleanupConnection(mouseMoveHandler, mouseUpHandler);
        } catch (error) {
            this.logger.error('WebWizard', 'handleConnectionEnd', 'Error ending connection', {
                error: error.message
            });
            this.cleanupConnection(mouseMoveHandler, mouseUpHandler);
        }
    }

    cleanupConnection(mouseMoveHandler, mouseUpHandler) {
        const svg = this.elementManager.findElement(`#${this.containerId}_connectionsSvg`);
        const placeholder = svg.querySelector('.connection-placeholder');
        if (placeholder) {
            placeholder.remove();
        }

        this.isConnecting = false;
        this.connectionStart = null;
        
        // Remover listeners temporales
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
    }

    renderConnections() {
        try {
            const svg = this.elementManager.findElement(`#${this.containerId}_connectionsSvg`);
            svg.innerHTML = '';

            this.ensureArrowMarker(svg);
            this.drawConnections(svg);
            
            this.logger.debug('WebWizard', 'renderConnections', 'Connections rendered', {
                count: this.connectionManager.getAllConnections().length
            });
        } catch (error) {
            this.logger.error('WebWizard', 'renderConnections', 'Failed to render connections', {
                error: error.message
            });
        }
    }

    ensureArrowMarker(svg) {
        if (!svg.querySelector('marker#arrowhead')) {
            const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
            const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
            marker.setAttribute('id', 'arrowhead');
            marker.setAttribute('markerWidth', '10');
            marker.setAttribute('markerHeight', '7');
            marker.setAttribute('refX', '10');
            marker.setAttribute('refY', '3.5');
            marker.setAttribute('orient', 'auto');
            marker.setAttribute('markerUnits', 'userSpaceOnUse');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', 'M 0 0 L 10 3.5 L 0 7 Z');
            path.setAttribute('fill', '#007bff');

            marker.appendChild(path);
            defs.appendChild(marker);
            svg.appendChild(defs);
        }
    }

    drawConnections(svg) {
        const svgRect = svg.getBoundingClientRect();
        const connections = this.connectionManager.getAllConnections();

        connections.forEach(connection => {
            try {
                const path = this.createConnectionPath(connection, svgRect);
                if (path) {
                    svg.appendChild(path);
                }
            } catch (error) {
                this.logger.warn('WebWizard', 'drawConnections', 'Failed to draw connection', {
                    connectionId: connection.id, error: error.message
                });
            }
        });
    }

    createConnectionPath(connection, svgRect) {
        const fromNodeElement = document.getElementById(connection.from);
        const toNodeElement = document.getElementById(connection.to);
        if (!fromNodeElement || !toNodeElement) return null;

        let fromPointElement = null;
        if (connection.fromType === 'option') {
            fromPointElement = fromNodeElement.querySelector(`.option-connection[data-option-index="${connection.optionIndex}"]`);
        } else if (connection.fromType === 'output') {
            fromPointElement = fromNodeElement.querySelector('.connection-point.output');
        } else {
            fromPointElement = fromNodeElement.querySelector('.connection-point.input');
        }
        if (!fromPointElement) return null;

        const toPointElement = toNodeElement.querySelector('.connection-point.input');
        if (!toPointElement) return null;

        const fromRect = fromPointElement.getBoundingClientRect();
        const toRect = toPointElement.getBoundingClientRect();

        const fromX = fromRect.left + fromRect.width / 2 - svgRect.left;
        const fromY = fromRect.top + fromRect.height / 2 - svgRect.top;
        const toX = toRect.left + toRect.width / 2 - svgRect.left;
        const toY = toRect.top + toRect.height / 2 - svgRect.top;

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.classList.add('connection-line');
        path.setAttribute('d', this.createCurvedPath(fromX, fromY, toX, toY));
        path.setAttribute('data-connection-id', connection.id);
        path.setAttribute('marker-end', 'url(#arrowhead)');
        
        this.eventManager.addEventListener(path, 'click', (e) => {
            this.handleConnectionClick(e, connection.id);
        });

        return path;
    }

    handleConnectionClick(e, connectionId) {
        e.stopPropagation();
        if (confirm('Do you want to delete this connection?')) {
            if (this.connectionManager.deleteConnection(connectionId)) {
                this.renderConnections();
                this.saveConfiguration();
                this.logger.info('WebWizard', 'handleConnectionClick', 'Connection deleted', {
                    connectionId
                });
            }
        }
    }

    createCurvedPath(x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const controlOffset = Math.min(distance * 0.5, 100);
        
        const cp1x = x1 + controlOffset;
        const cp1y = y1;
        const cp2x = x2 - controlOffset;
        const cp2y = y2;
        
        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    initNormalMode() {
        this.logger.info('WebWizard', 'initNormalMode', 'Initializing normal mode');
        
        this.createHTML();
        this.setupEvents();

        if (this.options.initialData) {
            this.loadData(this.options.initialData);
        } else {
            this.loadFromHiddenInput();
            if (this.nodeManager.getAllNodes().length === 0) {
                this.addStartNode();
            }
        }

        this.updateMinimap();
        this.saveConfiguration();
    }

    updateCanvasTransform() {
        const canvas = document.getElementById(`${this.containerId}_canvas`);
        const svg = document.getElementById(`${this.containerId}_connectionsSvg`);
        const transformValue = `translate(${this.canvasOffset.x}px, ${this.canvasOffset.y}px) scale(${this.scale})`;

        canvas.style.transform = transformValue;
        svg.style.transform = 'none';

        this.renderConnections();
    }

    zoomIn() {
        this.scale = Math.min(this.scale * 1.2, 3);
        this.updateCanvasTransform();
        this.updateMinimap();
    }

    zoomOut() {
        this.scale = Math.max(this.scale / 1.2, 0.3);
        this.updateCanvasTransform();
        this.updateMinimap();
    }

    resetZoom() {
        this.scale = 1;
        this.canvasOffset.x = 0;
        this.canvasOffset.y = 0;
        this.updateCanvasTransform();
        this.updateMinimap();
    }

    updateMinimap() {
        const viewport = document.getElementById(`${this.containerId}_minimapViewport`);
        if (!viewport) return;
        
        const containerRect = this.container.querySelector('.webwizard-canvas-container').getBoundingClientRect();
        
        viewport.style.left = (-this.canvasOffset.x / this.scale / 5000 * 200) + 'px';
        viewport.style.top = (-this.canvasOffset.y / this.scale / 5000 * 150) + 'px';
        viewport.style.width = (containerRect.width / this.scale / 5000 * 200) + 'px';
        viewport.style.height = (containerRect.height / this.scale / 5000 * 150) + 'px';
    }

    getData() {
        return {
            nodes: this.nodeManager.getAllNodes(),
            connections: this.connectionManager.getAllConnections()
        };
    }

    loadData(data) {
        const nodes = this.nodeManager.setNodes(data.nodes);
        const connections = this.connectionManager.setConnections(data.connections);
      
        if (!this.options.onlyForm) {
            // Solo renderizar nodos y conexiones si no es modo onlyForm
            const canvas = document.getElementById(`${this.containerId}_canvas`);
            if (canvas) {
                canvas.innerHTML = '';
                nodes.forEach(node => {
                    this.renderNode(node);
                });
                this.renderConnections();
                this.updateMinimap();
            }
        }
    }
    
    saveConfiguration() {
        if (!this.options.autoSave) return;

        const data = this.getData();
        const hiddenInput = document.getElementById(this.options.hiddenInputId);
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify(data);
        }

        if (this.options.onSave) {
            this.options.onSave(data);
        }

        if (this.options.onChange) {
            this.options.onChange(data);
        }
    }

    editNode(nodeId) {
        const node = this.nodeManager.getNode(nodeId);
        if (!node) return;

        this.currentEditingNode = node;
        const modalContent = document.getElementById(`${this.containerId}_modalContent`);
        
        let contentHtml = `
            <div class="modal-header">
                <h5 class="modal-title">Edit ${node.title}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                ${this.getContentEdit(node)}
            </div>
            <div class="modal-footer">
                <a class="btn btn-secondary" onclick="window.webWizardInstances['${this.containerId}'].closeModal()">Cancel</a>
                <a class="btn btn-primary" onclick="window.webWizardInstances['${this.containerId}'].saveNodeChanges()">Save</a>
            </div>
        `;

        modalContent.innerHTML = contentHtml;
        
        const modal = new bootstrap.Modal(document.getElementById(`${this.containerId}_modal`));
        modal.show();
    }

    getContentEdit(node) {
    let html = '';

    const formGroup = (label, id, value = '', type = 'textarea', placeholder = '') => `
        <div class="form-group mb-3">
            <div class="form-label">${label}</div>
            ${type === 'textarea' 
                ? `<textarea class="form-control" id="${id}" placeholder="${placeholder}">${value || ''}</textarea>` 
                : `<input type="${type}" class="form-control" id="${id}" value="${value || ''}" placeholder="${placeholder}">`}
        </div>`;

    const buildOptions = (options, fields) => options.map((opt, i) => `
        <div class="option-item mb-2 row">
            ${fields.map(({ key, label, col }) => `
                <div class="col-${col}">
                    <div class="form-label">${label}</div>
                    <input type="text" class="form-control" id="${key}-${i}" value="${opt[key] || ''}" data-option-index="${i}">
                </div>`).join('')}
            <div class="col-1">
                <div class="form-label">&nbsp;</div>
                <a type="button" class="btn btn-sm btn-danger" onclick="this.closest('.option-item').remove()">Remove</a>
            </div>
        </div>`).join('');

    // General fields (for all except "start")
    if (node.type !== 'start') {
        html += formGroup("Context", "editContext", node.context);
        const attributesString = node.attributes 
            ? Object.entries(node.attributes).map(([k,v]) => `${k}:${v}`).join(', ') 
            : '';
        html += formGroup("Custom Attributes (key:value, comma separated)", "editAttributes", attributesString, 'input', 'e.g. readonly:false, maxlength:10');
        
        // NUEVO: Campo para validaciones
        html += `
            <div class="form-group mb-3">
                <div class="form-label">Validation Rules</div>
                <small class="text-muted d-block mb-2">
                    Configure validation rules for this field. Common patterns:<br>
                    • <code>data-xtz-validate:true, data-fv-not-empty:true, data-fv-not-empty___message:Field is required</code><br>
                    • <code>data-fv-email-address:true, data-fv-email-address___message:Invalid email</code><br>
                    • <code>data-fv-string-length:true, data-fv-string-length___min:5, data-fv-string-length___max:20</code>
                </small>
                <textarea class="form-control" id="editValidation" placeholder="Enter validation attributes...">${this.getValidationString(node)}</textarea>
            </div>
        `;
    }

    // Type-specific content
    switch (node.type) {
        case 'start':
            html += formGroup("Start title", "editContent", node.content);
            break;
        case 'text':
        case 'email':
        case 'password':
        case 'number':
        case 'textarea':
        case 'file':
        case 'range':
            html += formGroup("Label title", "editContent", node.content);
            html += formGroup("Placeholder", "editPlaceholder", node.placeholder);
            break;
        case 'radio':
        case 'checkbox':
            html += formGroup("Question/Label", "editContent", node.content);
            html += `
                <div class="form-group mb-3">
                    <div class="form-label">Options</div>
                    <div id="optionsContainer">
                        ${buildOptions(node.options, [
                            { key: 'description', label: 'Description', col: 3 },
                            { key: 'id', label: 'ID', col: 3 },
                            { key: 'name', label: 'Name', col: 2 },
                            { key: 'value', label: 'Value', col: 2 },
                        ])}
                    </div>
                    <a class="btn btn-sm btn-secondary" onclick="window.webWizardInstances['${this.containerId}'].addOptionRadioCheck()">Add Option</a>
                </div>
                ${formGroup("Default Selected Value (optional)", "editDefaultRadioValue", node.defaultRadioValue || '', 'input', 'Value of the option to be selected by default')}
            `;
            break;
        case 'select':
            html += formGroup("Question/Label", "editContent", node.content);
            html += `
                <div class="form-group mb-3">
                    <div class="form-label">Options</div>
                    <div id="optionsContainer">
                        ${buildOptions(node.options, [
                            { key: 'description', label: 'Description', col: 5 },
                            { key: 'value', label: 'Value', col: 5 },
                        ])}
                    </div>
                    <a class="btn btn-sm btn-secondary" onclick="window.webWizardInstances['${this.containerId}'].addOption()">Add Option</a>
                </div>
            `;
            break;
        case 'message':
        case 'condition':
        case 'action':
            html += formGroup("Content", "editContent", node.content);
            break;
    }

    // Help text (for all except "start")
    if (node.type !== 'start') {
        html += formGroup("Help Text", "editHelp", node.help);
    }

    return html;
}
getValidationString(node) {
    if (!node.attributes) return '';
    
    const validationAttrs = Object.entries(node.attributes)
        .filter(([key]) => key.startsWith('data-xtz-validate') || key.startsWith('data-fv-'))
        .map(([key, value]) => `${key}:${value}`)
        .join(', ');
        
    return validationAttrs;
}
    addOption() {
        const container = document.getElementById('optionsContainer');
        const optionIndex = container.children.length;
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item mb-2 row';
        optionDiv.innerHTML = `
            <div class="col-5">
                <div class="form-label">Description</div>
                <input type="text" class="form-control" id="description-${optionIndex}" value="New Option" data-option-index="${optionIndex}">
            </div>
            <div class="col-5">
                <div class="form-label">Value</div>
                <input type="text" class="form-control" id="value-${optionIndex}" value="New value" data-option-index="${optionIndex}">
            </div>
            <div class="col-1">
                <div class="form-label">&nbsp</div>
                <a class="btn btn-sm btn-danger" onclick="this.closest('.option-item').remove()">Remove</a>
            </div>
        `;
        container.appendChild(optionDiv);
    }

    addOptionRadioCheck(){
        const container = document.getElementById('optionsContainer');
        const optionIndex = container.children.length;
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item mb-2 row';
        optionDiv.innerHTML = `
            <div class="option-item mb-2 row">
                <div class="col-3">
                    <div class="form-label">Description</div>
                    <input type="text" class="form-control" id="description-${optionIndex}" value="New Option" data-option-index="${optionIndex}">
                </div>
                <div class="col-3">
                    <div class="form-label">ID</div>
                    <input type="text" class="form-control" id="id-${optionIndex}"  value="New ID" data-option-index="${optionIndex}">
                </div>
                <div class="col-2">
                    <div class="form-label">Name</div>
                    <input type="text" class="form-control" id="name-${optionIndex}"  value="New name" data-option-index="${optionIndex}">
                </div>
                <div class="col-2">
                    <div class="form-label">Value</div>
                    <input type="text" class="form-control" id="value-${optionIndex}"  value="New Value" data-option-index="${optionIndex}">
                </div>
                <div class="col-1">
                    <div class="form-label">&nbsp</div>
                    <a type="button" class="btn btn-sm btn-danger" onclick="this.closest('.option-item').remove()">Remove</a>
                </div>
            </div>
        `;
        container.appendChild(optionDiv);
    }

    closeModal() {
        const modal = bootstrap.Modal.getInstance(document.getElementById(`${this.containerId}_modal`));
        if (modal) {
            modal.hide();
        }
    }

    saveNodeChanges() {
    if (!this.currentEditingNode) return;

    const node = this.currentEditingNode;
    const editContent = document.getElementById('editContent');
    const editContext = document.getElementById('editContext');
    const editPlaceholder = document.getElementById('editPlaceholder');
    const editHelp = document.getElementById('editHelp');
    const editAttributes = document.getElementById('editAttributes');
    const editValidation = document.getElementById('editValidation'); // NUEVO

    if (editContent) node.content = editContent.value;
    if (editContext) node.context = editContext.value;
    if (editPlaceholder) node.placeholder = editPlaceholder.value;
    if (editHelp) node.help = editHelp.value;

    // Actualizar opciones si existen
    if (['select', 'checkbox', 'radio'].includes(node.type)) {
        const optionItems = document.querySelectorAll('#optionsContainer .option-item');
        const options = [];

        optionItems.forEach(item => {
            const descriptionInput = item.querySelector('input[id^="description-"]');
            const valueInput = item.querySelector('input[id^="value-"]');
            const nameInput = item.querySelector('input[id^="name-"]');
            const idInput = item.querySelector('input[id^="id-"]');

            if (descriptionInput && valueInput) {
                const description = descriptionInput.value.trim();
                const value = valueInput.value.trim();
                const name = nameInput ? nameInput.value.trim() : '';
                const id = idInput ? idInput.value.trim() : '';

                if (description || value) {
                    options.push({ description, value, name, id });
                }
            }
        });

        node.options = options;

        if (node.type === 'radio') {
            const editDefaultRadioValue = document.getElementById('editDefaultRadioValue');
            if (editDefaultRadioValue) {
                node.defaultRadioValue = editDefaultRadioValue.value.trim();
            }
        }
    }

    // Procesar atributos normales y de validación
    if (editAttributes || editValidation) {
        const attrs = {};
        
        // Procesar atributos normales
        if (editAttributes) {
            const attrString = editAttributes.value.trim();
            if (attrString) {
                attrString.split(',').forEach(pair => {
                    const [key, value] = pair.split(':').map(s => s.trim());
                    if (key) {
                        if (value === 'true') attrs[key] = true;
                        else if (value === 'false') attrs[key] = false;
                        else if (!isNaN(value)) attrs[key] = Number(value);
                        else attrs[key] = value;
                    }
                });
            }
        }
        
        // NUEVO: Procesar validaciones
        if (editValidation) {
            const validationString = editValidation.value.trim();
            if (validationString) {
                validationString.split(',').forEach(pair => {
                    const [key, value] = pair.split(':').map(s => s.trim());
                    if (key && key.startsWith('data-')) {
                        if (value === 'true') attrs[key] = true;
                        else if (value === 'false') attrs[key] = false;
                        else if (!isNaN(value)) attrs[key] = Number(value);
                        else attrs[key] = value;
                    }
                });
            }
        }
        
        node.attributes = attrs;
    }

    // Re-renderizar el nodo
    const nodeElement = document.getElementById(node.id);
    if (nodeElement) {
        nodeElement.remove();
    }
    this.renderNode(node);

    this.renderConnections();
    this.saveConfiguration();
    this.closeModal();
}

    testBot() {
        const startNode = this.nodeManager.getNodeByType('start');
        const modalContent = document.getElementById(`${this.containerId}_modalContent`);

        if (!startNode) {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h5 class="modal-title">Test del Bot</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                    <div class="test-message">No se encontró nodo de inicio</div>
                </div>
            `;
        } else {
            modalContent.innerHTML = `
                <div class="modal-header">
                    <h5 class="modal-title">Test del Bot</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
                </div>
                <div class="modal-body">
                    <div id="testContent" class="d-flex flex-column gap-2" style="max-height: 400px; overflow-y: auto;"></div>
                </div>
                <div class="modal-footer">
                    <a class="btn btn-secondary" onclick="closeModal()">Cancel</a>
                    <a class="btn btn-primary" onclick="saveNodeChanges()">Save</a>
                </div>
            `;
            setTimeout(() => this.executeTestNode(startNode.id), 200);
        }

        const modal = new bootstrap.Modal(document.getElementById(`${this.containerId}_modal`));
        modal.show();
    }

    initializeDefaultValues(node) {
        if (!this.formData) {
            this.formData = new Map();
        }

        // CORRECCIÓN: No procesar el nodo 'start'
        if (node.type === 'start' || node.id === 'start') {
            return;
        }

        // Si ya hay un valor guardado, no sobrescribir
        if (this.formData.has(node.id)) {
            return;
        }

        let defaultValue = null;

        switch (node.type) {
            case 'checkbox':
                // Para checkboxes, verificar si hay valores por defecto marcados
                if (node.options && Array.isArray(node.options)) {
                    const defaultValues = node.options
                        .filter(opt => opt.checked || opt.selected || (node.attributes && node.attributes.value && node.attributes.value.includes(opt.value)))
                        .map(opt => opt.value);
                    if (defaultValues.length > 0) {
                        defaultValue = defaultValues;
                    }
                }
                break;

            case 'radio':
                // Para radio, usar defaultRadioValue o attributes.value
                if (node.defaultRadioValue) {
                    defaultValue = node.defaultRadioValue;
                } else if (node.attributes && node.attributes.value) {
                    defaultValue = node.attributes.value;
                }
                break;

            case 'range':
            case 'number':
            case 'text':
            case 'email':
            case 'password':
            case 'textarea':
                // Para inputs de texto y numéricos, usar attributes.value o placeholder
                if (node.attributes && node.attributes.value !== undefined) {
                    defaultValue = node.attributes.value;
                } else if (node.attributes && node.attributes.placeholder) {
                    // Opcionalmente usar placeholder como valor por defecto solo si se especifica
                    // defaultValue = node.attributes.placeholder;
                }
                break;

            case 'select':
                // Para select, buscar opción marcada como selected
                if (node.options && Array.isArray(node.options)) {
                    const selectedOption = node.options.find(opt => opt.selected || opt.checked);
                    if (selectedOption) {
                        defaultValue = selectedOption.value;
                    } else if (node.attributes && node.attributes.value) {
                        defaultValue = node.attributes.value;
                    }
                }
                break;

            case 'hidden':
                // Para campos hidden, siempre usar el valor por defecto
                defaultValue = (node.attributes && node.attributes.value) || node.content || '';
                break;
        }

        // Si hay un valor por defecto, guardarlo
        if (defaultValue !== null && defaultValue !== undefined && defaultValue !== '') {
            this.formData.set(node.id, defaultValue);
        }
    }

    executeTestNode(nodeId, fromBack = false) {
        if (nodeId === '__final_confirmation__') {
            return this.showFinalConfirmation(fromBack);
        }

        const node = this.nodeManager.getNode(nodeId);
        if (!node) return;

        // NUEVO: Si es nodo 'start', ir directamente al siguiente nodo
        if (node.type === 'start' || node.id === 'start') {
            return this.handleStartNode(node, fromBack);
        }

        if (node.type === 'hidden') {
            return this.handleHiddenNode(node, fromBack);
        }

        const testContent = this.getTestContainer();
        if (!testContent) return;

        this.initializeFormData();
        
        if (!fromBack) {
            this.initializeDefaultValues(node);
            this.ensureNodeHasValue(node);
        }
        
        if (!fromBack) {
            this.saveCurrentNodeData();
            this.testHistory.push(nodeId);
        }

        // NUEVO: Actualizar el progress tracker
        if (this.options.showProgressTracker && node.type !== 'start') {
            this.updateProgressTracker(nodeId);
        }

        const { formElement, stepDiv, stepMain } = this.createFormStructure(testContent, node);
        
        // NUEVO: Renderizar progress tracker si está habilitado
        if (this.options.showProgressTracker && node.type !== 'start') {
            this.renderProgressTracker(stepMain);
        }
        
        this.renderNodeContent(stepDiv, node, formElement);
        this.renderNavigationButtons(stepDiv, node);
        
        this.appendToContainer(testContent, formElement, stepMain);
        this.scrollToBottom(testContent);
    }

    updateProgressTracker(currentNodeId) {
        if (!this.progressPath.length) {
            this.progressPath = this.progressTracker.getProgressPath();
        }
        this.currentStepIndex = this.progressTracker.getCurrentStepIndex(currentNodeId, this.progressPath);
    }


    handleStartNode(node, fromBack = false) {
        // No agregar 'start' al historial si viene de atrás
        if (!fromBack) {
            this.testHistory.push(node.id);
        }
        
        // Buscar el siguiente nodo conectado al start
        const nextConnections = this.connectionManager.getConnectionsFrom(node.id, 'output');
        
        if (nextConnections.length > 0) {
            this.executeTestNode(nextConnections[0].to, fromBack);
        } else {
            // Si no hay conexiones, ir a confirmación final
            this.executeTestNode('__final_confirmation__', fromBack);
        }
    }
    
    renderProgressTracker(stepDiv) {

        if (!this.progressPath.length || this.currentStepIndex === -1) return;

        const progressContainer = this.createElement('div', {
            className: 'progress-tracker mb-4 border-bottom'
        });

        const progressTitle = this.createElement('h6', {
            className: 'mb-3 text-muted',
            textContent: 'Progress'
        });

        const progressList = this.createElement('div', {
            className: 'progress-steps'
        });

        this.progressPath.forEach((step, index) => {
            const stepElement = this.createElement('div', {
                className: this.getProgressStepClasses(index)
            });

            const stepNumber = this.createElement('span', {
                className: 'step-number',
                textContent: (index + 1).toString()
            });

            const stepTitle = this.createElement('span', {
                className: 'step-title',
                textContent: step.title
            });

            stepElement.appendChild(stepNumber);
            stepElement.appendChild(stepTitle);
            progressList.appendChild(stepElement);
        });

        progressContainer.appendChild(progressTitle);
        progressContainer.appendChild(progressList);
        
        // Agregar estilos CSS
        this.addProgressTrackerStyles();
        
        // Insertar al inicio del stepDiv
        stepDiv.insertBefore(progressContainer, stepDiv.firstChild);
    }

    getProgressStepClasses(index) {
        let classes = 'progress-step d-flex align-items-center mb-2 p-2 rounded';
        
        if (index < this.currentStepIndex) {
            classes += ' step-completed';
        } else if (index === this.currentStepIndex) {
            classes += ' step-active';
        } else {
            classes += ' step-pending';
        }
        
        return classes;
    }

    addProgressTrackerStyles() {
        // Solo agregar una vez
        if (document.getElementById('progress-tracker-styles')) return;

        const style = document.createElement('style');
        style.id = 'progress-tracker-styles';
        style.textContent = `
            .progress-tracker {
                background: rgba(5, 18, 58, 0.955);
                border: 1px solid rgba(6, 24, 76, 0.7);
                border-radius: 8px;
                padding: 1rem;
                display: inline-grid;
                width: 100%
            }
            .progress-steps{
                display: grid;
                grid-template-columns: repeat(7, 1fr);
                grid-template-rows: repeat(1, 1fr);
                gap: 8px;
            }
            .progress-step {
                transition: all 0.3s ease;
            }
            
            .progress-step .step-number {
                width: 28px;
                height: 28px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                margin-right: 10px;
                flex-shrink: 0;
            }
            
            .progress-step .step-title {
                font-size: 14px;
            }
            
            .step-completed {
                background-color: #d1edff;
                border-left: 4px solid #28a745;
            }
            
            .step-completed .step-number {
                background-color: #28a745;
                color: white;
            }
            
            .step-completed .step-title {
                color: #155724;
            }
            
            .step-active {
                background-color: #fff3cd;
                border-left: 4px solid #007bff;
            }
            
            .step-active .step-number {
                background-color: #007bff;
                color: white;
            }
            
            .step-active .step-title {
                color: #004085;
                font-weight: 600;
            }
            
            .step-pending {
                background-color: #ffffff;
                border-left: 4px solid #dee2e6;
            }
            
            .step-pending .step-number {
                background-color: #6c757d;
                color: white;
            }
            
            .step-pending .step-title {
                color: #6c757d;
            }
        `;
        
        document.head.appendChild(style);
    }

    ensureNodeHasValue(node) {
        if (!this.formData.has(node.id)) {
            const defaultValue = this.getDefaultValueForNode(node);
            this.formData.set(node.id, defaultValue);
            
            if (this.logger) {
                this.logger.debug('WebWizard', 'ensureNodeHasValue', 'Default value set for node', {
                    nodeId: node.id,
                    nodeType: node.type,
                    defaultValue: defaultValue
                });
            }
        }
    }

    handleHiddenNode(node, fromBack) {
        if (!this.formData) {
            this.formData = new Map();
        }
        
        const value = node.attributes?.value || node.content || '';
        this.formData.set(node.id, value);

        const nextConnections = this.connectionManager.getConnectionsFrom(node.id,'output');
        if (nextConnections.length > 0) {
            this.executeTestNode(nextConnections[0].to, fromBack);
        }
    }

    getTestContainer() {
        return this.options.onlyForm ? this.container : document.getElementById('testContent');
    }

    initializeFormData() {
        if (!this.formData) {
            this.formData = new Map();
        }
    }

    createFormStructure(testContent, node) {
        testContent.innerHTML = '';
        let formElement = null;
        
        if (this.options.onlyForm) {
            formElement = this.createFormElement();
            this.addHiddenFields(formElement);
            testContent.appendChild(formElement);
        }

        const {stepDiv, stepMain} = this.createStepDiv(node);
        return { formElement, stepDiv,stepMain };
    }

    createFormElement() {
        const formElement = document.createElement('form');
        formElement.id = 'wizardForm';

        if (this.options.formAttributes && typeof this.options.formAttributes === 'object') {
            Object.entries(this.options.formAttributes).forEach(([key, value]) => {
                formElement.setAttribute(key, value);
            });
        }

        if (this.options.hiddenFields && typeof this.options.hiddenFields === 'object') {
            Object.entries(this.options.hiddenFields).forEach(([name, value]) => {
                const hiddenInput = this.createElement('input', {
                    type: 'hidden',
                    name: name,
                    value: value
                });
                formElement.appendChild(hiddenInput);
            });
        }

        return formElement;
    }


    createStepDiv(node) {
        const stepMain= this.createElement('div',{
            id: 'stepMain',
            className: ''
        });

        const stepDiv = this.createElement('div', {
            className: 'test-step p-3 mb-3 w-100'
        });

        const label = this.createElement('label', {
            className: 'form-label',
            textContent: node.content || node.title
        });
        
        stepDiv.appendChild(label);
        stepMain.appendChild(stepDiv);
        return {stepDiv, stepMain};
    }

    renderNodeContent(stepDiv, node, formElement) {
        if (node.type === 'start') {
            return;
        }

        const inputConfig = this.getInputConfiguration(node);
        const inputElement = this.createInputElement(inputConfig, node, formElement);
        
        if (inputElement) {
            stepDiv.appendChild(inputElement);
        }

        if (node.help) {
            const helpElement = this.createElement('small', {
                className: 'form-hint',
                innerHTML: node.help
            });
            stepDiv.appendChild(helpElement);
        }
    }

    getInputConfiguration(node) {
        const configs = {
            'select': () => this.createSelectConfig(node),
            'checkbox': () => this.createCheckboxConfig(node),
            'radio': () => this.createRadioConfig(node),
            'file': () => this.createFileConfig(node),
            'textarea': () => this.createTextareaConfig(node),
            'range': () => this.createRangeConfig(node),
            'text': () => this.createTextInputConfig(node),
            'number': () => this.createTextInputConfig(node),
            'email': () => this.createTextInputConfig(node),
            'password': () => this.createTextInputConfig(node)
        };

        return configs[node.type] ? configs[node.type]() : this.createUnsupportedConfig(node);
    }

    createSelectConfig(node) {
        return {
            type: 'select',
            className: 'form-select mt-2',
            options: node.options,
            ajaxUrl: node.attributes?.['data-xtz-url'],
            savedValue: this.formData.get(node.id)
        };
    }

    createCheckboxConfig(node) {
        return {
            type: 'checkbox',
            className: 'form-check mt-2',
            options: node.options,
            savedValues: this.formData.get(node.id) || []
        };
    }

    createRadioConfig(node) {
        return {
            type: 'radio',
            className: 'form-check mt-2',
            options: node.options,
            savedValue: this.formData.get(node.id),
            defaultValue: node.attributes.value
        };
    }

    createFileConfig(node) {
        return {
            type: 'file',
            className: 'form-control mt-2',
            savedValue: this.formData.get(node.id)
        };
    }

    createTextareaConfig(node) {
        const savedValue = this.formData.get(node.id);
        return {
            type: 'textarea',
            className: 'form-control mt-2',
            savedValue: savedValue !== undefined ? savedValue : (node.attributes && node.attributes.value) || '',
        };
    }

    createRangeConfig(node) {
        return {
            type: 'range',
            className: 'form-range mt-2',
            savedValue: this.formData.get(node.id),
            defaultValue: node.attributes.value
        };
    }

    createTextInputConfig(node) {
        return {
            type: node.type,
            className: 'form-control mt-2',
            savedValue: this.formData.get(node.id)
        };
    }

    createUnsupportedConfig(node) {
        return {
            type: 'unsupported',
            message: `[Tipo no soportado: ${node.type}]`
        };
    }

    createInputElement(config, node, formElement) {
        const creators = {
            'select': () => this.createSelectElement(config, node, formElement),
            'checkbox': () => this.createCheckboxElement(config, node, formElement),
            'radio': () => this.createRadioElement(config, node, formElement),
            'file': () => this.createFileElement(config, node, formElement),
            'textarea': () => this.createTextareaElement(config, node, formElement),
            'range': () => this.createRangeElement(config, node, formElement),
            'text': () => this.createTextInputElement(config, node, formElement),
            'number': () => this.createTextInputElement(config, node, formElement),
            'email': () => this.createTextInputElement(config, node, formElement),
            'password': () => this.createTextInputElement(config, node, formElement),
            'unsupported': () => this.createUnsupportedElement(config)
        };

        return creators[config.type] ? creators[config.type]() : null;
    }

    createSelectElement(config, node, formElement) {
        const select = this.createElement('select', {
            className: config.className,
            name: this.getFieldName(node)
        });

        select.innerHTML = '<option value="">Seleccione una opción</option>';
        this.applyAttributes(select, node.attributes);

        let selectedValue = config.savedValue;
        if (!selectedValue && node.attributes && node.attributes.value) {
            selectedValue = node.attributes.value;
        }

        if (config.ajaxUrl) {
            this.loadSelectOptionsAjax(select, config.ajaxUrl, selectedValue);
        } else {
            this.loadSelectOptionsStatic(select, config.options, selectedValue);
        }

        this.addChangeListener(select, node, formElement);
        return select;
    }


    createCheckboxElement(config, node, formElement) {
        const container = this.createElement('div', { className: config.className });

        let selectedValues = config.savedValues || [];
        
        if (selectedValues.length === 0 && node.attributes && node.attributes.value) {
            if (Array.isArray(node.attributes.value)) {
                selectedValues = node.attributes.value;
            } else if (typeof node.attributes.value === 'string') {
                selectedValues = node.attributes.value.split(',').map(v => v.trim());
            }
        }

        config.options.forEach((opt, idx) => {
            const checkboxDiv = this.createElement('div', { className: 'form-check' });
            
            const shouldBeChecked = selectedValues.includes(opt.value) || 
                                    opt.checked || 
                                    opt.selected || 
                                    false;
            
            const checkbox = this.createElement('input', {
                type: 'checkbox',
                className: 'form-check-input',
                id: opt.id || `checkbox-${node.id}-${idx}`,
                name: opt.name || `${this.getFieldName(node)}[]`,
                value: opt.value,
                checked: shouldBeChecked
            });

            const label = this.createElement('label', {
                className: 'form-check-label',
                htmlFor: checkbox.id,
                textContent: opt.description
            });

            checkbox.addEventListener('change', () => {
                this.updateCheckboxData(node, formElement);
            });

            checkboxDiv.appendChild(checkbox);
            checkboxDiv.appendChild(label);
            container.appendChild(checkboxDiv);
        });

        return container;
    }

    createRadioElement(config, node, formElement) {
        const container = this.createElement('div', { className: config.className });
        this.applyAttributes(container, node.attributes);

        let selectedValue = config.savedValue;
        if (!selectedValue && node.defaultRadioValue) {
            selectedValue = node.defaultRadioValue;
        }
        if (!selectedValue && node.attributes && node.attributes.value) {
            selectedValue = node.attributes.value;
        }

        config.options.forEach((opt, idx) => {
            const radioDiv = this.createElement('div', { className: 'form-check' });
            
            const shouldBeChecked = selectedValue ? 
                selectedValue === opt.value : 
                (opt.checked || opt.selected || false);

            const radio = this.createElement('input', {
                type: 'radio',
                className: 'form-check-input',
                id: opt.id || `radio-${node.id}-${idx}`,
                name: opt.name || this.getFieldName(node),
                value: opt.value,
                checked: shouldBeChecked
            });

            const label = this.createElement('label', {
                className: 'form-check-label',
                htmlFor: radio.id,
                textContent: opt.description
            });

            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.formData.set(node.id, radio.value);
                    if (this.options.onlyForm) {
                        this.updateHiddenFields(formElement);
                    }
                }
            });

            radioDiv.appendChild(radio);
            radioDiv.appendChild(label);
            container.appendChild(radioDiv);
        });

        return container;
    }

    createFileElement(config, node, formElement) {
        const input = this.createElement('input', {
            type: 'file',
            className: config.className,
            name: this.getFieldName(node),
            placeholder: node.placeholder || ''
        });

        this.applyAttributes(input, node.attributes);

        const previewContainer = this.createElement('div', {
            className: 'file-preview-container mt-2 mb-2'
        });

        const updatePreview = (fileData) => {
            this.updateFilePreview(previewContainer, fileData, node, formElement, input);
        };

        updatePreview(config.savedValue);

        input.addEventListener('change', () => {
            this.handleFileChange(input, node, formElement, updatePreview);
        });

        const wrapper = this.createElement('div');
        wrapper.appendChild(previewContainer);
        wrapper.appendChild(input);
        
        return wrapper;
    }

    createTextareaElement(config, node, formElement) {
        const textarea = this.createElement('textarea', {
            className: config.className,
            name: this.getFieldName(node),
            placeholder: node.placeholder || ''
        });

        if (config.savedValue || config.savedValue === '') {
            textarea.textContent = config.savedValue;
        } else if (node.attributes && node.attributes.value !== undefined) {
            textarea.textContent = node.attributes.value;
        }

        this.applyAttributes(textarea, node.attributes);
        this.addInputListener(textarea, node, formElement);
        return textarea;
    }


    createRangeElement(config, node, formElement) {
        const savedValue = config.savedValue !== undefined && config.savedValue !== '' 
            ? config.savedValue 
            : (node.attributes && node.attributes.value) || '';

        const input = this.createElement('input', {
            type: 'range',
            className: config.className,
            name: this.getFieldName(node),
            value: savedValue
        });

        this.applyAttributes(input, node.attributes);
        this.addInputListener(input, node, formElement);
        return input;
    }

    createTextInputElement(config, node, formElement) {
        const savedValue = config.savedValue !== undefined && config.savedValue !== '' 
            ? config.savedValue 
            : (node.attributes && node.attributes.value) || '';

        const input = this.createElement('input', {
            type: config.type,
            className: config.className,
            name: this.getFieldName(node),
            placeholder: node.placeholder || '',
            value: savedValue
        });

        this.applyAttributes(input, node.attributes);
        this.addInputListener(input, node, formElement);
        return input;
    }

    createUnsupportedElement(config) {
        return this.createElement('div', {
            className: 'alert alert-warning mt-2',
            textContent: config.message
        });
    }

    createElement(tag, attributes = {}) {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'textContent') {
                element.textContent = value;
            } else if (key === 'innerHTML') {
                element.innerHTML = value;
            } else if (key === 'checked') {
                element.checked = value;
            } else if (key === 'value' && tag === 'textarea') {
                // Para textarea, usar textContent en lugar de setAttribute
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        });
        return element;
    }

    getFieldName(node) {
        return (node.attributes?.name) || `field_${node.id}`;
    }

    applyAttributes(element, attributes) {
        if (!attributes || typeof attributes !== 'object') return;
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (typeof value === 'boolean') {
                if (value) element.setAttribute(key, '');
            } else {
                element.setAttribute(key, value);
            }
        });
    }

    addChangeListener(element, node, formElement) {
        element.addEventListener('change', () => {
            const value = element.value || "";
            this.formData.set(node.id, value);
            if (this.options.onlyForm) {
                this.updateHiddenFields(formElement);
            }
        });
    }

    addInputListener(element, node, formElement) {
        element.addEventListener('input', () => {
            const value = element.value || "";
            this.formData.set(node.id, value);
            if (this.options.onlyForm) {
                this.updateHiddenFields(formElement);
            }
        });
        
        element.addEventListener('blur', () => {
            const value = element.value || "";
            this.formData.set(node.id, value);
            if (this.options.onlyForm) {
                this.updateHiddenFields(formElement);
            }
        });
    }

    shouldRadioBeChecked(value, savedValue, defaultValue) {
        if (savedValue) return savedValue === value;
        return !savedValue && defaultValue === value;
    }

    updateCheckboxData(node, formElement) {
        const checkedValues = [];
        node.options.forEach(option => {
            const cb = document.getElementById(option.id || `checkbox-${node.id}-${node.options.indexOf(option)}`);
            if (cb?.checked) {
                checkedValues.push(cb.value);
            }
        });
        this.formData.set(node.id, checkedValues);
        if (this.options.onlyForm) {
            this.updateHiddenFields(formElement);
        }
    }

    loadSelectOptionsAjax(select, ajaxUrl, savedValue) {
        fetch(ajaxUrl)
            .then(response => {
                if (!response.ok) throw new Error('Error al cargar opciones');
                return response.json();
            })
            .then(data => {
                const optionsArray = Object.values(data);
                optionsArray.forEach(opt => {
                    const option = this.createElement('option', {
                        value: opt.value,
                        textContent: opt.description
                    });
                    select.appendChild(option);
                });
                if (savedValue) {
                    select.value = savedValue;
                }
            })
            .catch(error => {
                console.error('Error cargando opciones por AJAX:', error);
            });
    }

    loadSelectOptionsStatic(select, options, savedValue) {
        let defaultValue = savedValue;
        if (!defaultValue) {
            const defaultOption = options.find(opt => opt.selected || opt.checked);
            if (defaultOption) {
                defaultValue = defaultOption.value;
            }
        }

        options.forEach(opt => {
            const option = this.createElement('option', {
                value: opt.value,
                textContent: opt.description
            });
            select.appendChild(option);
        });
        
        if (defaultValue) {
            select.value = defaultValue;
            // CORRECCIÓN: Obtener el nodo correctamente usando el atributo name del select
            const fieldName = select.name;
            if (fieldName && !this.formData.has(fieldName)) {
                const allNodes = this.nodeManager.getAllNodes();
                const currentNode = allNodes.find(n => this.getFieldName(n) === fieldName);
                if (currentNode) {
                    this.formData.set(currentNode.id, defaultValue);
                }
            }
        }
    }

    handleFileChange(input, node, formElement, updatePreview) {
        if (input.files?.length > 0) {
            const file = input.files[0];
            const reader = new FileReader();
            
            reader.onload = () => {
                const newFileData = {
                    base64: reader.result,
                    fileName: file.name,
                    mimeType: file.type
                };
                
                this.formData.set(node.id, newFileData);
                updatePreview(newFileData);
                
                if (this.options.onlyForm) {
                    this.updateHiddenFields(formElement);
                }
            };
            
            reader.readAsDataURL(file);
        }
    }

    updateFilePreview(container, fileData, node, formElement, input) {
        container.innerHTML = '';
        
        if (!fileData?.base64) return;

        if (fileData.mimeType.startsWith('image/')) {
            this.createImagePreview(container, fileData);
        } else {
            this.createFileInfoPreview(container, fileData, node, formElement, input);
        }
    }

    createImagePreview(container, fileData) {
        const thumbnail = this.createElement('div', {
            className: 'file-preview-thumbnail position-relative d-inline-block'
        });
        thumbnail.style.cssText = 'border-radius: 8px; padding: 8px; max-width: 200px;';
        
        const img = this.createElement('img', {
            src: fileData.base64,
            alt: fileData.fileName
        });
        img.style.cssText = 'width: 100px; height: 100px; object-fit: cover; border-radius: 4px; display: block;';
        
        thumbnail.appendChild(img);
        container.appendChild(thumbnail);
    }

    createFileInfoPreview(container, fileData, node, formElement, input) {
        const fileInfo = this.createElement('div', {
            className: 'alert alert-info d-flex align-items-center'
        });
        fileInfo.innerHTML = `
            <div class="flex-grow-1">
                <strong>${fileData.fileName}</strong><br>
                <small class="text-muted">Tipo: ${fileData.mimeType}</small>
            </div>
        `;
        
        const removeBtn = this.createElement('button', {
            type: 'button',
            className: 'btn btn-sm btn-outline-danger ms-2',
            innerHTML: '✕'
        });
        
        removeBtn.addEventListener('click', () => {
            this.formData.delete(node.id);
            container.innerHTML = '';
            if (this.options.onlyForm) {
                this.updateHiddenFields(formElement);
            }
            input.value = '';
        });
        
        fileInfo.appendChild(removeBtn);
        container.appendChild(fileInfo);
    }

    // Renderizar botones de navegación
    renderNavigationButtons(stepDiv, node) {
        const navDiv = this.createElement('div', {
            className: 'mt-4 d-flex justify-content-end gap-5',
            style: "position: absolute; bottom: 10px; right: 10px;"
        });

        const backButton = this.createBackButton();
        const nextButton = this.createNextButton(node, stepDiv);

        navDiv.appendChild(backButton);
        navDiv.appendChild(nextButton);
        stepDiv.appendChild(navDiv);
    }

    createBackButton() {
        const backButton = this.createElement('button', {
            textContent: 'Back',
            className: 'btn btn-secondary',
            type: 'button'
        });
        
        // Determinar si el botón debe estar deshabilitado
        const canGoBack = this.canGoBack();
        backButton.disabled = !canGoBack;
        
        backButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (canGoBack) {
                await this.saveCurrentNodeData();
                this.goToPreviousNode();
            }
        });

        return backButton;
    }

    canGoBack() {
        if (this.testHistory.length <= 1) return false;
        
        // Si el historial solo contiene 'start' y el nodo actual, no se puede ir atrás
        const nonStartHistory = this.testHistory.filter(nodeId => {
            const node = this.nodeManager.getNode(nodeId);
            return node && node.type !== 'start' && node.id !== 'start';
        });
        
        return nonStartHistory.length > 1;
    }

    goToPreviousNode() {
        // Remover el nodo actual
        this.testHistory.pop();
        
        // Buscar el nodo anterior válido (no-start)
        let prevNodeId = null;
        while (this.testHistory.length > 0) {
            const candidateId = this.testHistory[this.testHistory.length - 1];
            const candidateNode = this.nodeManager.getNode(candidateId);
            
            if (candidateNode && candidateNode.type !== 'start' && candidateNode.id !== 'start') {
                prevNodeId = candidateId;
                break;
            }
            
            // Si es un nodo start, mantenerlo en el historial pero continuar buscando
            if (candidateNode && (candidateNode.type === 'start' || candidateNode.id === 'start')) {
                break;
            }
            
            this.testHistory.pop();
        }
        
        if (prevNodeId) {
            this.executeTestNode(prevNodeId, true);
        } else {
            // Si no hay nodo anterior válido, ir al primer nodo después de start
            const startNode = this.nodeManager.getNodeByType('start');
            if (startNode) {
                this.executeTestNode(startNode.id, true);
            }
        }
    }

    createNextButton(node,stepDiv) {
        const nextButton = this.createElement('button', {
            className: 'btn btn-primary',
            type: 'button',
            textContent: 'Next'
        });

        nextButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // NUEVO: Validar antes de continuar
            const validationResult = this.validateCurrentNode(node);
            if (!validationResult.isValid) {
                this.showValidationErrors(validationResult.errors, stepDiv);
                return;
            }
            
            await this.saveCurrentNodeData();
            this.handleNextNavigation(node);
        });

        return nextButton;
    }
    
    validateCurrentNode(node) {
        if (node.type === 'start') {
            return { isValid: true, errors: [] };
        }

        // Obtener el valor actual del campo
        let currentValue = this.getCurrentNodeValue(node);
        
        // Validar usando ValidationManager
        return this.validationManager.validateNode(node, currentValue);
    }

    getCurrentNodeValue(node) {
        const fieldName = this.getFieldName(node);
        
        switch (node.type) {
            case 'select': {
                const selectElement = document.querySelector(`select[name="${CSS.escape(fieldName)}"]`);
                return selectElement ? selectElement.value : "";
            }
            case 'text':
            case 'number':
            case 'email':
            case 'password':
            case 'range': {
                const input = document.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
                return input ? input.value : "";
            }
            case 'textarea': {
                const textarea = document.querySelector(`textarea[name="${CSS.escape(fieldName)}"]`);
                return textarea ? textarea.value : "";
            }
            case 'radio': {
                const selectedRadio = document.querySelector(`input[type="radio"][name="${CSS.escape(fieldName)}"]:checked`);
                return selectedRadio ? selectedRadio.value : "";
            }
            case 'checkbox': {
                const checkedBoxes = document.querySelectorAll(`input[type="checkbox"][name*="${CSS.escape(fieldName)}"]:checked`);
                return Array.from(checkedBoxes).map(cb => cb.value);
            }
            case 'file': {
                return this.formData ? this.formData.get(node.id) : null;
            }
            case 'hidden': {
                return (node.attributes && node.attributes.value) || node.content || '';
            }
            default:
                return "";
        }
    }

    showValidationErrors(errors, buttonElement) {
        // Remover errores anteriores
        const existingErrors = document.querySelectorAll('.validation-error-message');
        existingErrors.forEach(error => error.remove());
        
        // Crear contenedor de errores
        const errorContainer = this.createElement('div', {
            className: 'validation-error-message alert alert-danger mt-2 mb-0'
        });
        
        const errorList = this.createElement('ul', {
            className: 'mb-0'
        });
        
        errors.forEach(error => {
            const errorItem = this.createElement('li', {
                style: "list-style: none",
                textContent: error
            });
            errorList.appendChild(errorItem);
        });
        
        errorContainer.appendChild(errorList);
        
        // Insertar después del botón
        buttonElement.parentNode.insertBefore(errorContainer, buttonElement.nextSibling);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            if (errorContainer.parentNode) {
                errorContainer.remove();
            }
        }, 5000);
    }

    handleNextNavigation(node) {
        if (['select', 'radio'].includes(node.type)) {
            this.handleSelectRadioNavigation(node);
        } else if (node.type === 'checkbox') {
            this.handleCheckboxNavigation(node);
        } else {
            this.handleDefaultNavigation(node);
        }
    }

    handleSelectRadioNavigation(node) {
        const generalConnections = this.connectionManager.getConnectionsFrom(node.id, 'output');
        if (generalConnections.length > 0) {
            this.executeTestNode(generalConnections[0].to);
            return;
        }

        if (node.type === 'select') {
            this.handleSelectSpecificNavigation(node);
        } else if (node.type === 'radio') {
            this.handleRadioSpecificNavigation(node);
        }
    }

    handleSelectSpecificNavigation(node) {
        const selectElement = document.querySelector(`select[name="${this.getFieldName(node)}"]`);
        const selectedIndex = selectElement.selectedIndex - 1;
        
        if (selectedIndex < 0) {
            alert('Por favor, seleccione una opción');
            return;
        }

        const connections = this.connectionManager.getConnectionsFrom(node.id, 'option', selectedIndex);

        if (connections.length > 0) {
            this.executeTestNode(connections[0].to);
        } else {
            this.executeTestNode('__final_confirmation__');
        }
    }

    handleRadioSpecificNavigation(node) {
        const selectedRadio = document.querySelector(`input[name="${this.getFieldName(node)}"]:checked`);
        
        if (!selectedRadio) {
            alert('Por favor, seleccione una opción');
            return;
        }

        const radios = Array.from(document.querySelectorAll(`input[name="${this.getFieldName(node)}"]`));
        const selectedIndex = radios.indexOf(selectedRadio);
        
        const connections = this.connectionManager.getConnectionsFrom(node.id, 'option', selectedIndex);

        if (connections.length > 0) {
            this.executeTestNode(connections[0].to);
        } else {
           this.executeTestNode('__final_confirmation__');
        }
    }

    handleCheckboxNavigation(node) {
        const generalConnections = this.connectionManager.getConnectionsFrom(node.id, 'output');
        if (generalConnections.length > 0) {
            this.executeTestNode(generalConnections[0].to);
        } else {
            this.executeTestNode('__final_confirmation__');
        }
    }

    handleDefaultNavigation(node) {
        const nextConnections = this.connectionManager.getConnectionsFrom(node.id, 'output');
        
        if (nextConnections.length === 0) {
            this.executeTestNode('__final_confirmation__');
            return;
        }
        
        this.executeTestNode(nextConnections[0].to);
    }

    showFinalConfirmation(fromBack = false) {
        const testContent = this.getTestContainer();
        if (!testContent) return;

        if (!fromBack) {
            this.saveCurrentNodeData();
            this.testHistory.push('__final_confirmation__');
        }

        const { formElement, stepDiv } = this.createFinalConfirmationStructure(testContent);
        
        this.renderFinalConfirmationContent(stepDiv, formElement);

        this.renderFinalConfirmationButtons(stepDiv, formElement);
        
        this.appendToContainer(testContent, formElement, stepDiv);
        this.scrollToBottom(testContent);
    }

    createFinalConfirmationStructure(testContent) {
        testContent.innerHTML = '';
        let formElement = null;
        
        if (this.options.onlyForm) {
            formElement = this.createFormElement();
            this.addHiddenFields(formElement);
            testContent.appendChild(formElement);
        }

        const stepDiv = this.createElement('div', {
            className: 'test-step p-3 mb-3'
        });

        return { formElement, stepDiv };
    }

    renderFinalConfirmationContent(stepDiv, formElement) {
        const title = this.createElement('h5', {
            className: 'mb-3 text-primary',
            innerHTML: '<i class="fas fa-check-circle"></i> Confirmation of sending data'
        });
        stepDiv.appendChild(title);

        const message = this.createElement('div', {
            className: 'alert alert-info mb-3',
            innerHTML: `
                <strong>Are you sure you want to submit the form?</strong><br>
                <small class="text-muted">
                    Please check that all information entered is correct.
                    Once submitted, you will not be able to modify the data.
                </small>
            `
        });
        stepDiv.appendChild(message);

        if (this.formData && this.formData.size > 0) {
            this.renderDataSummary(stepDiv);
        }
    }

    renderDataSummary(stepDiv) {
        const summaryDiv = this.createElement('div', {
            className: 'card mb-3'
        });
        
        const summaryHeader = this.createElement('div', {
            className: 'card-header',
            innerHTML: '<h6 class="mb-0">Summary of data entered</h6>'
        });
        
        const summaryBody = this.createElement('div', {
            className: 'card-body'
        });

        const dataList = this.createElement('div', {
            className: 'row'
        });

        this.formData.forEach((value, nodeId) => {
            const node = this.nodeManager.getNode(nodeId);
            if (!node || node.type === 'hidden' || node.type === 'start' || node.id === 'start') return;

            const dataItem = this.createElement('div', {
                className: 'col-md-6 mb-2'
            });

            let displayValue = this.formatValueForDisplay(value, node);
            
            dataItem.innerHTML = `
                <strong>${node.content || node.title}:</strong><br>
                <span class="text-muted">${displayValue}</span>
            `;

            dataList.appendChild(dataItem);
        });

        summaryBody.appendChild(dataList);
        summaryDiv.appendChild(summaryHeader);
        summaryDiv.appendChild(summaryBody);
        stepDiv.appendChild(summaryDiv);
    }

    formatValueForDisplay(value, node) {
        if (!value) return '<em>Empty</em>';

        switch (node.type) {
            case 'checkbox':
                if (Array.isArray(value) && value.length > 0) {
                    return value.join(', ');
                }
                return '<em>No option selected</em>';
                
            case 'file':
                if (typeof value === 'object' && value.fileName) {
                    return `${value.fileName} (${value.mimeType})`;
                }
                return '<em>No file</em>';
                
            case 'select':
            case 'radio':
                if (node.options) {
                    const selectedOption = node.options.find(opt => opt.value === value);
                    return selectedOption ? selectedOption.description : value;
                }
                return value;
                
            case 'password':
                return '••••••••';
                
            default:
                return String(value).substring(0, 50) + (String(value).length > 50 ? '...' : '');
        }
    }

    renderFinalConfirmationButtons(stepDiv, formElement) {
        const navDiv = this.createElement('div', {
            className: 'mt-4 d-flex justify-content-end gap-5',
            style: "position: absolute; bottom: 10px; right: 10px;"
        });

        const backButton = this.createElement('button', {
            textContent: 'Back',
            className: 'btn btn-secondary',
            type: 'button'
        });
    
        backButton.addEventListener('click', async (e) => {
            e.preventDefault();
            if (this.testHistory.length > 1) {
                await this.saveCurrentNodeData();
                this.testHistory.pop(); // Remover la confirmación
                const prevNodeId = this.testHistory[this.testHistory.length - 1];
                this.executeTestNode(prevNodeId, true);
            }
        });

        const submitButton = this.createElement('button', {
            innerHTML: 'Submit',
            className: 'btn btn-primary',
            type: this.options.onlyForm ? 'submit' : 'button'
        });

        if (!this.options.onlyForm) {
            submitButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleFinalSubmit();
            });
        }

        navDiv.appendChild(backButton);
        navDiv.appendChild(submitButton);
        stepDiv.appendChild(navDiv);
    }

    handleFinalSubmit() {
        const tempForm = this.createFormElement();
        this.addHiddenFields(tempForm);
        
        document.body.appendChild(tempForm);
        
        if (this.options.onSave) {
            const formData = this.formManager ? this.formManager.exportFormData() : this.exportFormDataLegacy();
            this.options.onSave(formData);
        }
        
        if (this.options.formAttributes && this.options.formAttributes.action) {
            tempForm.submit();
        } else {
            this.showSuccessMessage();
        }
        
        setTimeout(() => {
            if (tempForm.parentNode) {
                tempForm.parentNode.removeChild(tempForm);
            }
        }, 1000);
    }

    exportFormDataLegacy() {
        const data = {};
        if (this.formData) {
            this.formData.forEach((value, key) => {
                data[key] = value;
            });
        }
        return data;
    }

    showSuccessMessage() {
        const testContent = this.getTestContainer();
        testContent.innerHTML = `
            <div class="alert alert-success text-center p-4">
                <i class="fas fa-check-circle fa-3x text-success mb-3"></i>
                <h4>Form submitted successfully!</h4>
                <p class="mb-0">Your data has been successfully processed.</p>
            </div>
        `;
    }

    appendToContainer(testContent, formElement, stepDiv) {
        if (this.options.onlyForm) {
            formElement.appendChild(stepDiv);
        } else {
            testContent.appendChild(stepDiv);
        }
    }

    scrollToBottom(testContent) {
        testContent.scrollTop = testContent.scrollHeight;
    }


    saveCurrentNodeData() {
        if (!this.options.onlyForm || this.testHistory.length === 0) return;
        const currentNodeId = this.testHistory[this.testHistory.length - 1];
        const currentNode = this.nodeManager.getNode(currentNodeId);
        if (!currentNode || currentNode.type === 'start' || currentNode.id === 'start') return;

        if (currentNode.type === 'file') {
            return this.saveFileData(currentNodeId, currentNode);
        }

        this.saveOtherNodeData(currentNodeId, currentNode);
    }

    saveFileData(currentNodeId, currentNode) {
        return new Promise((resolve) => {
            const fieldName = this.formManager.getFieldName(currentNode);
            const fileInput = document.querySelector(`input[name="${CSS.escape(fieldName)}"]`);

            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                const file = fileInput.files[0];
                const reader = new FileReader();

                reader.onload = () => {
                    const base64Data = reader.result;
                    this.formManager.setFormData(fieldName, {
                        base64: base64Data,
                        fileName: file.name,
                        mimeType: file.type
                    });
                    const form = fileInput.closest('form');
                    if (form) this.formManager.updateHiddenFields(form, this.nodeManager.getAllNodes());
                    resolve();
                };

                reader.onerror = () => {
                    console.error('Error al leer archivo');
                    resolve();
                };

                reader.readAsDataURL(file);
            } else {
                resolve();
            }
        });
    }

    saveOtherNodeData(currentNodeId, currentNode) {
        const fieldName = this.getFieldName ? this.getFieldName(currentNode) : this.getFieldNameFallback(currentNode);

        switch (currentNode.type) {
            case 'select': {
                const selectInput = document.querySelector(`select[name="${CSS.escape(fieldName)}"]`);
                const value = selectInput ? selectInput.value : "";
                this.setNodeData(currentNode, fieldName, value);
                break;
            }
            case 'text':
            case 'number':
            case 'email':
            case 'password':
            case 'range': {
                const input = document.querySelector(`input[name="${CSS.escape(fieldName)}"]`);
                const value = input ? input.value : "";
                this.setNodeData(currentNode, fieldName, value);
                break;
            }
            case 'textarea': {
                const textarea = document.querySelector(`textarea[name="${CSS.escape(fieldName)}"]`);
                const value = textarea ? textarea.value : "";
                this.setNodeData(currentNode, fieldName, value);
                break;
            }
            case 'radio': {
                const selectedRadio = document.querySelector(`input[type="radio"][name="${CSS.escape(fieldName)}"]:checked`);
                const value = selectedRadio ? selectedRadio.value : "";
                this.setNodeData(currentNode, fieldName, value);
                break;
            }
            case 'checkbox': {
                const checkedValues = [];
                if (currentNode.options) {
                    for (const opt of currentNode.options) {
                        const checkboxId = opt.id || `checkbox-${currentNodeId}-${currentNode.options.indexOf(opt)}`;
                        const checkboxInput = document.getElementById(checkboxId);
                        if (checkboxInput && checkboxInput.checked) {
                            checkedValues.push(checkboxInput.value);
                        }
                    }
                }
                this.setNodeData(currentNode, fieldName, checkedValues);
                break;
            }
            case 'hidden': {
                const value = (currentNode.attributes && currentNode.attributes.value) 
                    ? currentNode.attributes.value 
                    : currentNode.content || '';
                this.setNodeData(currentNode, fieldName, value);
                break;
            }
            default:
                this.setNodeData(currentNode, fieldName, "");
                break;
        }
    }

    setNodeData(node, fieldName, value) {
        if (this.formManager && this.formManager.setFormData) {
            this.formManager.setFormData(fieldName, value);
        } else if (this.formData) {
            this.formData.set(node.id, value);
        }
        
        if (this.logger) {
            this.logger.debug('WebWizard', 'setNodeData', 'Node data set', {
                nodeId: node.id,
                fieldName: fieldName,
                value: value,
                valueType: typeof value
            });
        }
    }

    getFieldNameFallback(node) {
        return (node.attributes && node.attributes.name) ? node.attributes.name : `field_${node.id}`;
    }


    updateHiddenFields(formElement) {
        if (!formElement) return;
        this.formManager.updateHiddenFields(formElement, this.nodeManager.getAllNodes());
    }

    addHiddenFields(formElement) {
        if (!this.formData) {
            this.initializeFormData();
        }

        const processedNodes = this.getProcessedNodes();
        
        processedNodes.forEach(node => {
            if (!this.formData.has(node.id)) {
                const defaultValue = this.getDefaultValueForNode(node);
                this.formData.set(node.id, defaultValue);
            }
        });

        this.formData.forEach((value, nodeId) => {
            const node = this.nodeManager.getNode(nodeId);
            if (!node || node.type === 'start' || node.id === 'start') return;

            const fieldName = this.getFieldNameFallback(node);
            this.createHiddenInputsForNode(formElement, node, fieldName, value);
        });
    }


    getProcessedNodes() {
        const processedNodeIds = new Set();
    
        this.testHistory.forEach(nodeId => {
            if (nodeId !== '__final_confirmation__') {
                processedNodeIds.add(nodeId);
            }
        });

        const processedNodes = [];
        processedNodeIds.forEach(nodeId => {
            const node = this.nodeManager.getNode(nodeId);
            if (node && node.type !== 'start' && node.id !== 'start') {
                processedNodes.push(node);
            }
        });

        return processedNodes;
    }


    getDefaultValueForNode(node) {
        switch (node.type) {
            case 'checkbox':
                return [];
            case 'file':
                return null;
            case 'hidden':
                return (node.attributes && node.attributes.value) || node.content || '';
            default:
                return "";
        }
    }

    createHiddenInputsForNode(formElement, node, fieldName, value) {

        const existingInputs = formElement.querySelectorAll(`input[name="${fieldName}"], input[name="${fieldName}[]"]`);
        existingInputs.forEach(input => input.remove());

        if (node.type === 'checkbox' && Array.isArray(value)) {
            if (value.length === 0) {
                const hiddenInput = this.createHiddenInput(`${fieldName}[]`, "");
                formElement.appendChild(hiddenInput);
            } else {
                value.forEach(val => {
                    const hiddenInput = this.createHiddenInput(`${fieldName}[]`, val);
                    formElement.appendChild(hiddenInput);
                });
            }
        } else if (node.type === 'file') {
            if (value && typeof value === 'object' && value.base64) {
                // Archivo con datos
                const hiddenInputBase64 = this.createHiddenInput(fieldName, value.base64);
                const hiddenInputFileName = this.createHiddenInput(`${fieldName}_file`, value.fileName);
                const hiddenInputMime = this.createHiddenInput(`${fieldName}_mime`, value.mimeType);
                
                formElement.appendChild(hiddenInputBase64);
                formElement.appendChild(hiddenInputFileName);
                formElement.appendChild(hiddenInputMime);
            } else {
                // Sin archivo, crear inputs vacíos
                const hiddenInputBase64 = this.createHiddenInput(fieldName, "");
                const hiddenInputFileName = this.createHiddenInput(`${fieldName}_file`, "");
                const hiddenInputMime = this.createHiddenInput(`${fieldName}_mime`, "");
                
                formElement.appendChild(hiddenInputBase64);
                formElement.appendChild(hiddenInputFileName);
                formElement.appendChild(hiddenInputMime);
            }
        } else {
            const finalValue = (value !== null && value !== undefined) ? String(value) : "";
            const hiddenInput = this.createHiddenInput(fieldName, finalValue);
            formElement.appendChild(hiddenInput);
        }
    }

    createHiddenInput(name, value) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value || "";
        return input;
    }

    validateFormDataCompleteness() {
        const processedNodes = this.getProcessedNodes();
        const missingFields = [];
        
        processedNodes.forEach(node => {
            // CORRECCIÓN: Asegurar que no se incluya el nodo 'start'
            if ((node.type === 'start' || node.id === 'start') || this.formData.has(node.id)) {
                return; // Skip start node or nodes that already have data
            }
            
            missingFields.push({
                nodeId: node.id,
                nodeType: node.type,
                fieldName: this.getFieldNameFallback(node)
            });
        });
        
        if (missingFields.length > 0 && this.logger) {
            this.logger.warn('WebWizard', 'validateFormDataCompleteness', 'Missing fields detected', {
                missingFields: missingFields
            });
        }
        
        return missingFields;
    }

}
