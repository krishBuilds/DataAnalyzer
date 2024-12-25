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
                <button @click="$emit('view-flow', selectedFlow)" class="flow-action-btn">
                  <i class="fas fa-eye"></i> View
                </button>
                <button @click="$emit('delete-flow', selectedFlow.id)" class="flow-action-btn delete">
                  <i class="fas fa-trash"></i> Delete
                </button>
              </div>
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
  padding: 20px;
  border-bottom: 1px solid #333;
}

.detail-header h3 {
  color: #fff;
  margin: 0 0 12px 0;
}

.flow-actions {
  display: flex;
  gap: 8px;
}

.flow-action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #444;
  background: #2d2d2d;
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}

.flow-action-btn:hover {
  background: #333;
}

.flow-action-btn.delete {
  color: #ff4444;
  border-color: #ff4444;
}

.flow-action-btn.delete:hover {
  background: #ff4444;
  color: white;
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
</style>

<script>
import { ref, computed } from 'vue';
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
    
    const elements = computed(() => {
      if (!selectedFlow.value) return [];
      return createFlowElements(selectedFlow.value.messages);
    });

    function createFlowElements(messages) {
      const nodes = [];
      const edges = [];
      const spacing = { x: 400, y: 150 };
      const nodesPerRow = 2;

      messages.forEach((message, index) => {
        const row = Math.floor(index / nodesPerRow);
        const col = index % nodesPerRow;
        const isEvenRow = row % 2 === 0;
        
        const xPos = isEvenRow ? 
          col * spacing.x : 
          (nodesPerRow - 1 - col) * spacing.x;

        nodes.push({
          id: `node-${index}`,
          type: 'message',
          position: { 
            x: xPos,
            y: row * spacing.y
          },
          data: {
            ...message,
            index,
            expanded: expandedCodes.value[index] || false
          }
        });

        if (index < messages.length - 1) {
          edges.push({
            id: `edge-${index}`,
            source: `node-${index}`,
            target: `node-${index + 1}`,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#666', strokeWidth: 2 },
            markerEnd: {
              type: 'arrowclosed',
              color: '#666'
            }
          });
        }
      });

      return [...nodes, ...edges];
    }

    return {
      selectedFlow,
      expandedCodes,
      elements,
      backgroundVariant
    };
  },

  methods: {
    handleOverlayClick(e) {
      e?.stopPropagation();
      this.$emit('close');
    },

    selectFlow(flow) {
      this.selectedFlow = flow;
      this.expandedCodes = {};
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
    }
  }
};
</script> 