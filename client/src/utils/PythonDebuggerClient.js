import io from 'socket.io-client';
import * as monaco from 'monaco-editor';

export class PythonDebuggerClient {
  constructor(editor) {
    if (!editor) {
      throw new Error('Editor instance is required');
    }
    
    this.editor = editor;
    try {
      this.socket = io('http://localhost:5000', {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
      });
    } catch (error) {
      console.error('Failed to connect to debug server:', error);
      throw error;
    }
    
    this.breakpointDecorations = new Map();
    this.setupSocketListeners();
    this.currentFile = null;
    this.isDebugging = false;
    this.onBreakpointHit = null;
    this.onDebugComplete = null;
  }

  setupSocketListeners() {
    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    this.socket.on('connect', () => {
      console.log('Connected to debug server');
    });

    this.socket.on('debug_result', (result) => {
      switch(result.type) {
        case 'breakpoint':
          this.handleBreakpoint(result);
          break;
        case 'complete':
          this.handleExecutionComplete(result);
          break;
        case 'error':
          this.handleExecutionError(result);
          break;
      }
    });

    this.socket.on('debug_started', () => {
      this.isDebugging = true;
    });
  }

  toggleBreakpoint(lineNumber) {
    const model = this.editor.getModel();
    if (!model) return;

    const decorations = this.editor.getLineDecorations(lineNumber) || [];
    const existingBreakpoint = decorations.find(d => 
      d.options.glyphMarginClassName === 'breakpoint'
    );

    if (existingBreakpoint) {
      // Remove breakpoint
      model.deltaDecorations([existingBreakpoint.id], []);
      this.breakpointDecorations.delete(lineNumber);
    } else {
      // Add breakpoint
      const newDecorations = [{
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: 'breakpoint',
          glyphMarginHoverMessage: { value: 'Breakpoint' }
        }
      }];
      const [decorationId] = model.deltaDecorations([], newDecorations);
      this.breakpointDecorations.set(lineNumber, decorationId);
    }

    this.updateServerBreakpoints();
  }

  updateServerBreakpoints() {
    this.socket.emit('set_breakpoints', {
      file_path: this.currentFile,
      breakpoints: Array.from(this.breakpointDecorations.keys())
    });
  }

  startDebugging(code) {
    this.currentFile = `debug_${Date.now()}.py`;
    this.socket.emit('start_debug', {
      script_path: this.currentFile,
      code,
      breakpoints: Array.from(this.breakpointDecorations.keys())
    });
  }

  sendCommand(command) {
    if (this.isDebugging) {
      this.socket.emit('debug_command', command);
    }
  }

  handleBreakpoint(info) {
    if (this.onBreakpointHit) {
      this.onBreakpointHit(info);
    }
    this.editor.revealLineInCenter(info.line);
  }

  handleExecutionComplete(result) {
    this.isDebugging = false;
    if (this.onDebugComplete) {
      this.onDebugComplete(result);
    }
  }

  handleExecutionError(error) {
    console.error('Debug error:', error);
    this.isDebugging = false;
  }

  dispose() {
    this.socket.disconnect();
  }
} 