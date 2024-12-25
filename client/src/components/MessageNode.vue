<template>
  <div class="message-node" :class="data.type">
    <div class="node-header">
      <div class="node-type">
        <i :class="getMessageIcon(data.type)"></i>
        <span>{{ data.type === 'user' ? 'Prompt' : 'Response' }}</span>
      </div>
      <span class="node-time">{{ formatTime(data.timestamp) }}</span>
    </div>
    
    <div class="node-content">
      <div class="message-text">{{ data.text }}</div>
      
      <!-- Code Section with Monaco Editor -->
      <div v-if="data.code">
        <div class="code-preview" @click="isCodeVisible = !isCodeVisible">
          <i class="fas fa-code"></i>
          <span>{{ isCodeVisible ? 'Hide Code' : 'View Code' }}</span>
        </div>
        
        <div v-show="isCodeVisible" class="code-editor-container">
          <MonacoEditor
            :value="data.code"
            :options="editorOptions"
            theme="vs-dark"
            language="python"
            :readonly="true"
            class="code-editor"
            @change="handleCodeChange"
          />
        </div>
      </div>

      <!-- Plot Preview -->
      <div v-if="data.plot_html" class="plot-preview" @click="$emit('view-plot', data.plot_html)">
        <i class="fas fa-chart-bar"></i>
        <span>View Plot</span>
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
      required: true
    },
    type: String
  },

  data() {
    return {
      isCodeVisible: false,
      localCode: '',
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

  created() {
    // Initialize localCode with prop value
    this.localCode = this.data.code || '';
  },

  methods: {
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
    handleCodeChange(value) {
      this.localCode = value;
      this.$emit('code-change', value);
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

.message-text {
  color: #fff;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.code-preview,
.plot-preview {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  cursor: pointer;
  color: #fff;
  font-size: 0.8em;
  margin-top: 8px;
}

.code-preview:hover,
.plot-preview:hover {
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

.message-node {
  width: 300px;
  max-width: 100%;
}
</style> 