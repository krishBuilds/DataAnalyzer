<template>
  <div class="message-node" :class="data.messages[0].type">
    <div class="handle left" data-handle-id="left" />
    <div class="handle right" data-handle-id="right" />
    
    <div class="node-header">
      <div class="node-type">
        <i :class="getMessageIcon(data.messages[0].type)"></i>
        <span>{{ data.messages[0].type === 'user' ? 'Prompt' : 'Response' }}</span>
      </div>
      <span class="node-time">{{ formatTime(data.messages[0].timestamp) }}</span>
    </div>
    
    <div class="node-content">
      <!-- User message -->
      <div class="message-text">{{ data.messages[0].text }}</div>
      
      <!-- Sample Data Section -->
      <div v-if="data.messages[0].sampleData" class="sample-data-section">
        <div class="data-preview" @click="isDataVisible = !isDataVisible">
          <i class="fas fa-table"></i>
          <span>{{ isDataVisible ? 'Hide Sample Data' : 'View Sample Data' }}</span>
        </div>
        
        <div v-show="isDataVisible" class="data-container">
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th v-for="header in data.messages[0].sampleData.headers" 
                      :key="header">{{ header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, index) in data.messages[0].sampleData.rows" 
                    :key="index">
                  <td v-for="header in data.messages[0].sampleData.headers" 
                      :key="header">{{ row[header] }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <!-- Bot response -->
      <div v-if="data.messages[1]" class="bot-response">
        <div class="message-text">{{ data.messages[1].text }}</div>
        
        <!-- Code Section with Monaco Editor -->
        <div v-if="data.messages[1].code" class="code-section">
          <div class="code-preview" @click="toggleCode">
            <i class="fas fa-code"></i>
            <span>{{ isCodeVisible ? 'Hide Code' : 'View Code' }}</span>
          </div>
          
          <!-- Only mount editor when visible -->
          <div v-if="isCodeVisible" class="code-editor-container">
            <MonacoEditor
              :value="data.messages[1].code"
              :options="editorOptions"
              theme="vs-dark"
              language="python"
              :readonly="true"
              class="code-editor"
              @mounted="handleEditorMounted"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import MonacoEditor from './MonacoEditor.vue';

export default {
  components: {
    MonacoEditor
  },

  props: {
    data: {
      type: Object,
      required: true,
      validator: function(value) {
        // Ensure messages array exists and has required properties
        return value.messages && Array.isArray(value.messages) && value.messages.length >= 1;
      }
    },
    type: String,
    isExecuting: {
      type: Boolean,
      default: false
    },
    executionResult: {
      type: Object,
      default: null
    }
  },

  computed: {
    userMessage() {
      return this.data.messages.find(m => m.type === 'user') || {};
    },
    botMessage() {
      return this.data.messages.find(m => m.type === 'assistant' || m.type === 'bot') || {};
    },
    messageContent() {
      return {
        prompt: this.userMessage.content || this.userMessage.text, // Handle both formats
        code: this.botMessage.code,
        text: this.botMessage.text || this.botMessage.content // Handle both formats
      };
    }
  },

  data() {
    return {
      isCodeVisible: false,
      isDataVisible: false,
      editor: null,
      editorModel: null,
      editorOptions: {
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        lineNumbers: 'on',
        readOnly: true,
        automaticLayout: true,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'auto'
        },
        lineHeight: 18,
        folding: true
      }
    }
  },

  watch: {
    data: {
      handler() {
        if (this.isCodeVisible) {
          this.cleanupEditor();
          this.isCodeVisible = false;
        }
      },
      deep: true
    }
  },

  beforeUnmount() {
    this.cleanupEditor();
  },

  methods: {
    toggleCode() {
      if (this.isCodeVisible) {
        this.cleanupEditor();
        this.isCodeVisible = false;
      } else {
        this.isCodeVisible = true;
      }
    },

    cleanupEditor() {
      if (this.editor) {
        //this.editor.setSelection(new monaco.Range(1, 1, 1, 1));
        
        if (this.editorModel) {
          this.editorModel.dispose();
          this.editorModel = null;
        }
        
        this.editor.dispose();
        this.editor = null;
      }
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },
    getMessageIcon(type) {
      return {
        user: 'fas fa-user',
        bot: 'fas fa-robot',
        system: 'fas fa-info-circle'
      }[type] || 'fas fa-comment';
    },
    handleEditorMounted(editor) {
      this.editor = editor;
      this.editorModel = editor.getModel();
      
      this.$nextTick(() => {
        if (this.editor) {
          this.editor.layout();
        }
      });
    }
  }
};
</script>

<style scoped>
.message-node {
  padding: 12px;
  border-radius: 8px;
  background: #2d2d2d;
  border: 1px solid #444;
  width: 300px;
  position: relative;
}

.message-node.user {
  background: #1a4971;
  border-color: #2d6898;
}

.message-node.bot {
  background: #1e4620;
  border-color: #2d6830;
}

.node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  color: #fff;
}

.node-type {
  display: flex;
  align-items: center;
  gap: 6px;
}

.node-time {
  font-size: 0.8em;
  color: #aaa;
}

.node-content {
  color: #fff;
}

.message-text {
  margin-bottom: 8px;
  font-size: 0.9em;
  line-height: 1.4;
}

.bot-response {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.code-section {
  margin-top: 8px;
}

.code-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  color: #fff;
  font-size: 0.8em;
}

.code-preview:hover {
  background: rgba(255, 255, 255, 0.15);
}

.code-editor-container {
  margin-top: 8px;
  border-radius: 4px;
  overflow: hidden;
  height: 200px;
  border: 1px solid #444;
}

.code-editor {
  height: 100%;
  width: 100%;
}

.handle {
  position: absolute;
  width: 12px;
  height: 12px;
  background: #666;
  border: 2px solid #1e1e1e;
  border-radius: 50%;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  transition: all 0.2s;
}

.handle:hover {
  background: #888;
  transform: translateY(-50%) scale(1.2);
}

.handle.left {
  left: -6px;
}

.handle.right {
  right: -6px;
}

.sample-data-section {
  margin: 12px 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.data-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  color: #fff;
  font-size: 0.9em;
}

.data-preview:hover {
  background: rgba(255, 255, 255, 0.15);
}

.data-container {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  max-height: 200px;
  overflow: auto;
}

.table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.table-wrapper table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85em;
}

.table-wrapper th,
.table-wrapper td {
  padding: 6px 12px;
  text-align: left;
  border: 1px solid rgba(255, 255, 255, 0.1);
  white-space: nowrap;
}

.table-wrapper th {
  background: rgba(255, 255, 255, 0.1);
  font-weight: 500;
  position: sticky;
  top: 0;
}

.table-wrapper tr:hover td {
  background: rgba(255, 255, 255, 0.05);
}
</style> 