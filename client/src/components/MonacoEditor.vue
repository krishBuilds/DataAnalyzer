<template>
  <div class="editor-container">
    <div class="editor-toolbar" v-if="debugMode">
      <button @click="stepOver" :disabled="!isDebugging">
        <i class="fas fa-step-forward"></i> Step Over
      </button>
      <button @click="stepInto" :disabled="!isDebugging">
        <i class="fas fa-step-into"></i> Step Into
      </button>
      <button @click="stepOut" :disabled="!isDebugging">
        <i class="fas fa-step-out"></i> Step Out
      </button>
      <button @click="continueExecution" :disabled="!isDebugging">
        <i class="fas fa-play"></i> Continue
      </button>
      <button @click="stopDebug" :disabled="!isDebugging" class="stop-btn">
        <i class="fas fa-stop"></i> Stop
      </button>
    </div>
    <div ref="editorContainer" class="monaco-container"></div>
  </div>
</template>

<script>
import * as monaco from 'monaco-editor';
import { PythonDebuggerClient } from '../utils/PythonDebuggerClient';

export default {
  name: 'MonacoEditor',
  props: {
    value: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'python',
    },
    theme: {
      type: String,
      default: 'vs-dark',
    },
    data: {
      type: Array,
      default: () => [],
    },
    debugMode: {
      type: Boolean,
      default: false
    }
  },
  
  emits: ['dataframe-update', 'breakpoints-changed', 'variables-update', 'debug-complete'],

  data() {
    return {
      editor: null,
      debuggerClient: null,
      isDebugging: false,
      breakpoints: [],
      variables: {},
      currentLine: null
    };
  },

  computed: {
    showDebugControls() {
      return this.debugMode;
    }
  },

  mounted() {
    this.editor = monaco.editor.create(this.$refs.editorContainer, {
      value: this.value,
      language: this.language,
      theme: this.theme,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      glyphMargin: true,
      folding: true,
      scrollBeyondLastLine: false,
      fixedOverflowWidgets: true,
      padding: { top: 8 }
    });

    this.editor.onMouseDown((e) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position.lineNumber;
        this.toggleBreakpoint(lineNumber);
      }
    });

    monaco.editor.defineTheme('custom-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.lineHighlightBackground': '#282828',
      }
    });

    this.editor.updateOptions({
      theme: 'custom-theme'
    });

    if (this.debugSession) {
      this.debugSession.close();
      this.debugSession = null;
    }
  },

  methods: {
    async startDebug() {
      const code = this.editor.getValue();
      if (!this.debuggerClient) {
        try {
          this.debuggerClient = new PythonDebuggerClient(this.editor);
          this.debuggerClient.onBreakpointHit = this.handleBreakpointHit;
          this.debuggerClient.onDebugComplete = this.handleDebugComplete;
          await this.debuggerClient.startDebugging(code);
        } catch (error) {
          console.error('Failed to initialize debugger:', error);
        }
      } else {
        await this.debuggerClient.startDebugging(code);
      }
    },

    handleBreakpointHit(info) {
      this.currentLine = info.line;
      this.variables = info.locals;
      this.isDebugging = true;
      this.$emit('variables-update', info.locals);
    },

    handleDebugComplete(result) {
      this.isDebugging = false;
      this.currentLine = null;
      this.variables = {};
      this.$emit('debug-complete', result);
    },

    toggleBreakpoint(lineNumber) {
      if (this.debuggerClient) {
        this.debuggerClient.toggleBreakpoint(lineNumber);
      }
    },

    stepOver() {
      this.debuggerClient?.sendCommand('next');
    },

    stepInto() {
      this.debuggerClient?.sendCommand('step');
    },

    stepOut() {
      this.debuggerClient?.sendCommand('return');
    },

    continueExecution() {
      this.debuggerClient?.sendCommand('continue');
    },

    stopDebug() {
      this.debuggerClient?.sendCommand('stop');
      this.isDebugging = false;
    }
  },

  beforeUnmount() {
    if (this.editor) {
      this.editor.dispose();
    }
    if (this.debuggerClient) {
      this.debuggerClient.dispose();
    }
  },

  watch: {
    value(newValue) {
      if (this.editor && newValue !== this.editor.getValue()) {
        this.editor.setValue(newValue);
      }
    },
    debugMode: {
      immediate: true,
      handler(newValue) {
        if (this.editor) {
          this.editor.updateOptions({
            glyphMargin: newValue,
            lineNumbers: 'on'
          });
          
          // Start debug session if code exists
          if (newValue && this.editor.getValue().trim()) {
            this.startDebug();
          } else if (!newValue) {
            this.stopDebug();
          }
        }
      }
    }
  }
};
</script>

<style>
.editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.monaco-container {
  flex: 1;
  overflow: hidden;
}

.editor-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #1e1e1e;
  border-bottom: 1px solid #333;
}

.editor-toolbar button {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.editor-toolbar button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stop-btn {
  margin-left: auto;
  background: #dc3545;
}

.breakpoint {
  background: #e51400 !important;
  border-radius: 50%;
  width: 8px !important;
  height: 8px !important;
  margin: 5px;
  cursor: pointer;
}

.monaco-editor .margin-view-overlays .cgmr {
  width: 20px !important;
}
</style>
