<template>
  <Transition name="fade">
    <div v-if="show" class="flows-overlay" @click.self="handleOverlayClick">
      <div class="flows-panel" @click.stop>
        <!-- Left Pane: Flow List -->
        <div class="flows-list-pane">
          <div class="flows-header">
            <h3>My Flows</h3>
            <button @click="handleOverlayClick" class="close-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <div class="flows-list">
            <div v-for="flow in flows" 
                 :key="flow.id" 
                 :class="['flow-item', { active: selectedFlow?.id === flow.id }]"
                 @click="selectFlow(flow)">
              <div class="flow-item-content">
                <div class="flow-item-header">
                  <div class="flow-name-edit">
                    <span v-if="!editingName || editingId !== flow.id" 
                          @dblclick="startEditing(flow)">
                      {{ flow.name }}
                    </span>
                    <input v-else
                           v-model="editedName"
                           @blur="saveName(flow)"
                           @keyup.enter="saveName(flow)"
                           ref="nameInput"
                           type="text">
                  </div>
                  <span class="flow-date">{{ formatDate(flow.timestamp) }}</span>
                </div>
                <div class="flow-meta">
                  <span class="flow-file" v-if="flow.fileName">
                    <i class="fas fa-file"></i> {{ flow.fileName }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Pane: Flow Visualization -->
        <div class="flow-detail-pane" v-if="selectedFlow">
          <div class="detail-header">
            <div class="flow-title">
              <h3>{{ selectedFlow.name }}</h3>
              <div class="flow-actions">
                <button 
                  class="action-btn rename"
                  @click="startEditing(selectedFlow)"
                  title="Rename flow"
                >
                  <i class="fas fa-edit"></i>
                </button>
                <button 
                  class="action-btn delete"
                  @click="$emit('delete-flow', selectedFlow.id)"
                  title="Delete flow"
                >
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>

            <div class="compact-execution-actions">
              <button 
                class="flow-exec-btn current-data"
                :disabled="isRunning"
                @click="executeFlow('current')"
                title="Run this flow on the currently loaded data"
              >
                <i class="fas fa-play"></i>
                <span>Run Current</span>
              </button>

              <button 
                class="flow-exec-btn file-data"
                :disabled="isRunning"
                @click="runFlowOnFile"
                title="Run this flow on a new file"
              >
                <i class="fas fa-file-import"></i>
                <span>Run New File</span>
              </button>
            </div>
          </div>

          <!-- Vue Flow Container -->
          <div class="flow-container">
            <VueFlow
              v-model="elements"
              :default-viewport="{ zoom: 1 }"
              :min-zoom="0.2"
              :max-zoom="4"
              :fit-view-on-init="true"
              class="flow-canvas"
              @paneReady="onLoad"
            >
              <template #node-message="nodeProps">
                <MessageNode 
                  :data="nodeProps.data"
                  :type="nodeProps.type"
                  @toggle-code="toggleCode"
                />
              </template>
              
              <Background 
                v-if="backgroundVariant" 
                :variant="backgroundVariant.Dots" 
                pattern-color="#444" 
              />
              <Controls />
              <MiniMap />
            </VueFlow>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.flows-overlay {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.flows-panel {
  display: flex;
  width: 90%;
  height: 90%;
  background: #1e1e1e;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.flows-list-pane {
  width: 300px;
  background: #252525;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
}

.flows-header {
  padding: 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #333;
}

.flows-header h3 {
  color: #fff;
  margin: 0;
  font-size: 1.2em;
}

.flows-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.flow-item {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  background: #2d2d2d;
  cursor: pointer;
  transition: all 0.2s;
}

.flow-item:hover {
  background: #333;
}

.flow-item.active {
  background: #0078d4;
}

.flow-item-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.flow-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.flow-name {
  color: #fff;
  font-weight: 500;
}

.flow-date {
  color: #888;
  font-size: 0.8em;
}

.flow-item-preview {
  color: #aaa;
  font-size: 0.9em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.flow-detail-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e1e1e;
}

.detail-header {
  padding: 12px;
  border-bottom: 1px solid #ddd;
}

.flow-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.flow-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  padding: 4px 8px;
  background: none;
  border: none;
  cursor: pointer;
  color: #666;
  border-radius: 4px;
}

.action-btn:hover {
  background: #f5f5f5;
}

.action-btn.delete:hover {
  color: #dc3545;
}

.compact-execution-actions {
  display: flex;
  gap: 8px;
  padding: 0 8px;
}

.flow-exec-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  max-width: 120px;
  height: 32px;
  transition: all 0.2s ease;
}

.flow-exec-btn.current-data {
  background: #2c3e50;
  color: white;
}

.flow-exec-btn.current-data:hover:not(:disabled) {
  background: #34495e;
}

.flow-exec-btn.file-data {
  background: #16a085;
  color: white;
}

.flow-exec-btn.file-data:hover:not(:disabled) {
  background: #1abc9c;
}

.flow-exec-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.flow-exec-btn i {
  font-size: 0.9em;
  opacity: 0.9;
}

.flow-exec-btn span {
  font-weight: 500;
}

.flow-exec-btn:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.flow-exec-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.2);
}

.flow-exec-btn:not(:disabled):active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.detail-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.flow-boxes {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px;
}

.flow-box {
  background: #2d2d2d;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  position: relative;
}

.box-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #333;
  border-bottom: 1px solid #444;
}

.box-header.user {
  background: #1a4971;
}

.box-header.bot {
  background: #1e4620;
}

.box-type {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-weight: 500;
}

.box-timestamp {
  color: #aaa;
  font-size: 0.9em;
}

.box-content {
  padding: 16px;
}

.message-text {
  color: #fff;
  margin-bottom: 16px;
  line-height: 1.5;
}

.code-section {
  border: 1px solid #444;
  border-radius: 6px;
  overflow: hidden;
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #333;
  cursor: pointer;
  user-select: none;
}

.code-header:hover {
  background: #3a3a3a;
}

.code-editor-container {
  height: 200px;
  border-top: 1px solid #444;
}

.code-editor {
  height: 100%;
  width: 100%;
}

.flow-connector {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 24px;
  color: #555;
  margin: 8px 0;
}

.plot-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: #333;
  border-radius: 6px;
  cursor: pointer;
  color: #fff;
  margin-top: 16px;
}

.plot-preview:hover {
  background: #3a3a3a;
}

.plot-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
}

.plot-content {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  position: relative;
  max-width: 90%;
  max-height: 90%;
  overflow: auto;
}

.close-modal {
  position: absolute;
  top: 8px;
  right: 8px;
  background: none;
  border: none;
  color: #333;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
}

.close-modal:hover {
  background: #f0f0f0;
}

/* Scrollbar Styling */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e;
}

::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.flow-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  padding: 24px;
  align-items: start;
}

.flow-box {
  background: #2d2d2d;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  position: relative;
}

.flow-connector {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 1.2em;
}

.flow-name-edit {
  position: relative;
}

.flow-name-edit input {
  background: #333;
  border: 1px solid #555;
  color: white;
  padding: 4px 8px;
  border-radius: 4px;
  width: 200px;
}

.edit-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.edit-btn:hover {
  background: #333;
  color: white;
}

.flow-meta {
  font-size: 0.8em;
  color: #888;
  margin-top: 4px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.flow-container {
  flex: 1;
  background: #1e1e1e;
  position: relative;
  height: 600px; /* Fixed height for better visibility */
}

.flow-canvas {
  width: 100%;
  height: 100%;
}

:deep(.vue-flow__node) {
  min-width: 300px;
  max-width: 300px;
}

:deep(.vue-flow__edge) {
  stroke: #666;
  stroke-width: 2;
}

:deep(.vue-flow__edge.animated) {
  stroke-dasharray: 5;
  animation: flowEdge 1s infinite linear;
}

:deep(.vue-flow__edge-path) {
  stroke: #666;
  stroke-width: 2;
}

:deep(.vue-flow__edge-text) {
  fill: #fff;
}

@keyframes flowEdge {
  from {
    stroke-dashoffset: 10;
  }
  to {
    stroke-dashoffset: 0;
  }
}

.flow-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

:deep(.vue-flow__node.executing) {
  animation: nodeExecuting 1s infinite;
}

@keyframes nodeExecuting {
  0% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(255, 215, 0, 0); }
  100% { box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
}

.flow-execution-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  margin: 0 16px;
}

.flow-exec-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border: 2px solid transparent;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  max-width: 200px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.btn-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  flex-shrink: 0;
}

.btn-content {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.btn-title {
  font-weight: 600;
  font-size: 0.9em;
  color: #2c3e50;
}

.btn-desc {
  font-size: 0.75em;
  color: #6c757d;
}

.flow-exec-btn.current-data {
  border-color: #4CAF50;
}

.flow-exec-btn.current-data .btn-icon {
  background: #E8F5E9;
  color: #4CAF50;
}

.flow-exec-btn.current-data:hover:not(:disabled) {
  background: #F1F8E9;
}

.flow-exec-btn.file-data {
  border-color: #2196F3;
}

.flow-exec-btn.file-data .btn-icon {
  background: #E3F2FD;
  color: #2196F3;
}

.flow-exec-btn.file-data:hover:not(:disabled) {
  background: #E8EAF6;
}

.flow-exec-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-loader {
  position: absolute;
  right: 12px;
  display: flex;
  align-items: center;
}

.spinner {
  animation: rotate 2s linear infinite;
  width: 20px;
  height: 20px;
}

.spinner .path {
  stroke: currentColor;
  stroke-linecap: round;
  animation: dash 1.5s ease-in-out infinite;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}

@keyframes dash {
  0% {
    stroke-dasharray: 1, 150;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -35;
  }
  100% {
    stroke-dasharray: 90, 150;
    stroke-dashoffset: -124;
  }
}
</style>

<script>
import { ref, watch } from 'vue';
import { 
  VueFlow, 
  Background, 
  Controls, 
  MiniMap,
  BackgroundVariant
} from '@vue-flow/core';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import MessageNode from './MessageNode.vue';
import axios from 'axios';

export default {
  components: {
    VueFlow,
    Background,
    Controls,
    MiniMap,
    MessageNode
  },

  props: {
    show: Boolean,
    flows: Array
  },

  data() {
    return {
      editingName: false,
      editingId: null,
      editedName: ''
    }
  },

  setup() {
    const selectedFlow = ref(null);
    const expandedCodes = ref({});
    const backgroundVariant = ref(BackgroundVariant);
    const elements = ref([]);
    const isRunning = ref(false);

    watch(() => selectedFlow.value, (flow) => {
      if (flow) {
        elements.value = createFlowElements(flow.messages);
      } else {
        elements.value = [];
      }
    }, { immediate: true });

    function createFlowElements(messages) {
      const nodes = [];
      const edges = [];
      const spacing = { x: 400, y: 200 };
      const nodesPerRow = 2;

      let currentNode = null;
      messages.forEach((message) => {
        if (message.type === 'user') {
          currentNode = {
            messages: [message]
          };
        } else if ((message.type === 'assistant' || message.type === 'bot') && currentNode) {
          currentNode.messages.push(message);
          
          const nodeIndex = nodes.length;
          const row = Math.floor(nodeIndex / nodesPerRow);
          const col = nodeIndex % nodesPerRow;
          const isEvenRow = row % 2 === 0;
          
          nodes.push({
            id: `node-${nodeIndex}`,
            type: 'message',
            position: { 
              x: isEvenRow ? col * spacing.x : (nodesPerRow - 1 - col) * spacing.x,
              y: row * spacing.y
            },
            data: {
              messages: currentNode.messages,
              index: nodeIndex,
              expanded: false,
              isExecuting: false,
              executionResult: null
            }
          });

          if (nodeIndex > 0) {
            const prevRow = Math.floor((nodeIndex - 1) / nodesPerRow);
            //const prevCol = (nodeIndex - 1) % nodesPerRow;
            const isSameRow = row === prevRow;
            const isParallelOperation = (
              currentNode.messages[0].text.includes('plot') && 
              nodes[nodeIndex-1].data.messages[0].text.includes('rename')
            );

            edges.push({
              id: `edge-${nodeIndex-1}`,
              source: `node-${nodeIndex-1}`,
              target: `node-${nodeIndex}`,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#666', strokeWidth: 2 },
              markerEnd: {
                type: 'arrowclosed',
                color: '#666'
              },
              ...(isSameRow || isParallelOperation ? {
                sourceHandle: 'right',
                targetHandle: 'left'
              } : {})
            });
          }

          currentNode = null;
        }
      });

      return [...nodes, ...edges];
    }

    return {
      selectedFlow,
      expandedCodes,
      elements,
      backgroundVariant,
      isRunning
    };
  },

  methods: {
    handleOverlayClick(e) {
      e?.stopPropagation();
      // Cleanup before closing
      const messageNodes = document.querySelectorAll('.message-node');
      messageNodes.forEach(node => {
        const vm = this.findComponentInstance(node);
        if (vm && vm.cleanupEditor) {
          vm.cleanupEditor();
        }
      });
      
      this.$emit('close');
    },

    selectFlow(flow) {
      // Cleanup before changing flows
      if (this.selectedFlow) {
        // Find all MessageNode components and trigger cleanup
        this.$nextTick(() => {
          const messageNodes = document.querySelectorAll('.message-node');
          messageNodes.forEach(node => {
            const vm = this.findComponentInstance(node);
            if (vm && vm.cleanupEditor) {
              vm.cleanupEditor();
            }
          });
        });
      }

      this.editingName = false;
      this.editingId = null;
      this.selectedFlow = flow;
    },

    startEditing(flow) {
      this.editingId = flow.id;
      this.editedName = flow.name;
      this.editingName = true;
      this.$nextTick(() => {
        this.$refs.nameInput?.focus();
      });
    },

    saveName(flow) {
      if (this.editedName.trim()) {
        this.$emit('rename-flow', { id: flow.id, name: this.editedName.trim() });
      }
      this.editingName = false;
      this.editingId = null;
    },

    formatDate(timestamp) {
      return new Date(timestamp).toLocaleDateString();
    },

    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    },

    toggleCode(index) {
      this.expandedCodes[index] = !this.expandedCodes[index];
      this.selectedFlow = { ...this.selectedFlow };
    },

    getMessageIcon(type) {
      return {
        user: 'fas fa-user',
        bot: 'fas fa-robot',
        system: 'fas fa-info-circle'
      }[type] || 'fas fa-comment';
    },

    // Helper method to find Vue component instance
    findComponentInstance(el) {
      let vm = el.__vue__;
      while (el && !vm) {
        el = el.parentNode;
        vm = el?.__vue__;
      }
      return vm;
    },

    async runFlowOnData(type, file = null) {
      try {
        this.isRunning = true;
        const assistantMessage = this.selectedFlow.messages.find(m => m.type === 'assistant');
        let payload = {
          flowId: this.selectedFlow.id,
          type: type,
          currentData: this.$parent.gridOperations.getData(),
          headers: this.$parent.gridOperations.getHeaders(),
          code: assistantMessage?.code || '',
          prompt: assistantMessage?.content || '', // Add the prompt from assistant message
          sampleData: this.selectedFlow.messages[0]?.data || [] // Original sample data
        };

        let response;
        if (type === 'file' && file) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('flowId', this.selectedFlow.id);
          formData.append('currentData', JSON.stringify(payload.currentData));
          formData.append('headers', JSON.stringify(payload.headers));
          formData.append('code', payload.code);
          formData.append('prompt', payload.prompt);
          formData.append('sampleData', JSON.stringify(payload.sampleData));
          
          response = await axios.post('/api/flows/execute-with-file', formData);
        } else {
          response = await axios.post('/api/flows/execute', payload);
        }

        this.$emit('flow-complete', {
          success: true,
          data: response.data.data,
          result: response.data
        });
      } catch (error) {
        console.error('Flow execution error:', error);
        this.$emit('flow-complete', {
          success: false,
          error: error.response?.data?.error || 'Failed to execute flow'
        });
      } finally {
        this.isRunning = false;
      }
    },

    

    async runFlowOnFile() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.csv,.xlsx,.xls';
      
      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) {
          await this.runFlowOnData('file', file);
        }
      };
      
      input.click();
    },

    async executeFlow(type) {
      try {
        this.isRunning = true;
        const orderedNodes = this.elements
          .filter(el => el.type === 'message')
          .sort((a, b) => a.data.index - b.data.index);

        for (let i = 0; i < orderedNodes.length; i++) {
          const node = orderedNodes[i];
          const messages = node.data.messages;
          
          const messageContent = {
            prompt: messages.find(m => m.type === 'user')?.text,
            code: messages.find(m => m.type === 'assistant' || m.type === 'bot')?.code,
            sampleData: messages.find(m => m.type === 'user')?.sampleData || null
          };

          if (!messageContent.code || !messageContent.prompt) {
            console.warn('Skipping node - missing code or prompt:', node);
            continue;
          }

          node.data.isExecuting = true;

          let payload = {
            flowId: this.selectedFlow.id,
            type: type,
            currentData: this.$parent.gridOperations.getData(),
            headers: this.$parent.gridOperations.getHeaders(),
            code: messageContent.code?.trim(),
            prompt: messageContent.prompt?.trim(),
            sampleData: messageContent.sampleData?.rows || [] // Pass sample data rows
          };

          try {
            let response;
            if (type === 'file' && this.$parent.fileName) {
              // Create FormData for file upload
              const formData = new FormData();
              formData.append('flowId', payload.flowId);
              formData.append('currentData', JSON.stringify(payload.currentData));
              formData.append('headers', JSON.stringify(payload.headers));
              formData.append('code', payload.code);
              formData.append('prompt', payload.prompt);
              formData.append('sampleData', JSON.stringify(payload.sampleData));
              formData.append('file', await this.getFileFromInput());

              response = await axios.post('/api/flows/execute-with-file', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } else {
              response = await axios.post('/api/flows/execute', payload);
            }

            // Update node execution status
            node.data.executionResult = {
              success: true,
              message: 'Step completed successfully'
            };

            // Emit step completion
            this.$emit('flow-step-complete', {
              stepIndex: i,
              totalSteps: orderedNodes.length,
              output: response.data
            });

            // Update data for next step if needed
            if (response.data.data) {
              await this.$parent.gridOperations.setData(response.data.data);
            }

          } catch (error) {
            node.data.executionResult = {
              error: true,
              message: error.response?.data?.error || 'Step execution failed'
            };
            throw error;
          } finally {
            node.data.isExecuting = false;
          }
        }

        this.$emit('flow-complete', {
          success: true,
          data: this.$parent.gridOperations.getData()
        });

      } catch (error) {
        console.error('Flow execution error:', error);
        this.$emit('flow-complete', {
          success: false,
          error: error.response?.data?.error || 'Failed to execute flow'
        });
      } finally {
        this.isRunning = false;
      }
    },

    // Helper method to get file from input
    async getFileFromInput() {
      return new Promise((resolve, reject) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,.xlsx,.xls';
        
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            resolve(file);
          } else {
            reject(new Error('No file selected'));
          }
        };
        
        input.click();
      });
    }
  },

  beforeUnmount() {
    // Ensure cleanup when component is destroyed
    const messageNodes = document.querySelectorAll('.message-node');
    messageNodes.forEach(node => {
      const vm = this.findComponentInstance(node);
      if (vm && vm.cleanupEditor) {
        vm.cleanupEditor();
      }
    });
  }
};
</script> 