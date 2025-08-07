export class Logger {
    constructor(enabled = true, level = 'info') {
        this.enabled = enabled;
        this.level = level;
        this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    }

    _log(level, module, method, message, data = null) {
        if (!this.enabled || this.levels[level] > this.levels[this.level]) return;
        
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${module}::${method}]`;
        
        console.log(`${prefix} ${message}`);
        if (data) console.log('Data:', data);
        
        // Stack trace para errores
        if (level === 'error') {
            console.trace();
        }
    }

    error(module, method, message, data) { this._log('error', module, method, message, data); }
    warn(module, method, message, data) { this._log('warn', module, method, message, data); }
    info(module, method, message, data) { this._log('info', module, method, message, data); }
    debug(module, method, message, data) { this._log('debug', module, method, message, data); }
}