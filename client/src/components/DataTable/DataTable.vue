<template>
  <div class="data-container">
    <TableSection 
      :headers="headers"
      :tableData="tableData"
      :changedRows="changedRows"
      :loading="loading"
      :error="error"
      :history="history"
      :currentHistoryIndex="currentHistoryIndex"
      @file-upload="handleFileUpload"
      @clean-data="cleanData"
      @undo="undo"
      @redo="redo"
      @export-data="exportData"
    />

    <ChatSection 
      :chatMessages="chatMessages"
      :loading="loading"
      v-model:userMessage="userMessage"
      @send-message="handleSendMessage"
      @select-plot="selectedPlot = $event"
    />

    <div v-if="selectedPlot" class="modal" @click="selectedPlot = null">
      <div class="modal-content" @click.stop>
        <img :src="`data:image/png;base64,${selectedPlot}`" alt="Data Visualization" class="modal-image">
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import TableSection from './TableSection.vue';
import ChatSection from './ChatSection.vue';
import { useDataHandling } from './composables/useDataHandling';
import { useChatHandling } from './composables/useChatHandling';

export default {
  name: 'DataTable',
  components: {
    TableSection,
    ChatSection
  },
  setup() {
    const {
      headers,
      tableData,
      changedRows,
      loading,
      error,
      history,
      currentHistoryIndex,
      handleFileUpload,
      cleanData,
      undo,
      redo,
      exportData,
      updateTableData
    } = useDataHandling();

    const userMessage = ref('');
    const selectedPlot = ref(null);

    const {
      chatMessages,
      sendMessage
    } = useChatHandling(tableData, (newData) => {
      updateTableData(newData);
    });

    const handleSendMessage = async () => {
      if (!userMessage.value.trim()) return;
      const message = userMessage.value;
      userMessage.value = '';
      await sendMessage(message);
    };

    return {
      // Data handling
      headers,
      tableData,
      changedRows,
      loading,
      error,
      history,
      currentHistoryIndex,
      handleFileUpload,
      cleanData,
      undo,
      redo,
      exportData,
      // Chat handling
      chatMessages,
      userMessage,
      handleSendMessage,
      selectedPlot
    };
  }
}
</script>

<style scoped>
.data-container {
  display: flex;
  gap: 20px;
  height: calc(100vh - 120px);
  padding: 10px 20px;
}

/* Chat Section Styles */
.chat-section {
  flex: 1;
  min-width: 300px;
  max-width: 500px;
  display: flex;
  flex-direction: column;
}

.chat-container {
  background: #f8f9fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #ddd;
  text-align: left;
}

.chat-container h3 {
  margin: 0;
  padding: 15px;
  border-bottom: 1px solid #ddd;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Message Styles */
.message {
  padding: 10px;
  border-radius: 8px;
  max-width: 75%;
}

.message.bot {
  background: #e9ecef;
  color: #212529;
  align-self: flex-start;
}

.message.user {
  background: #007bff;
  color: white;
  align-self: flex-end;
}

/* Code Block Styles */
.code-block-container {
  margin-top: 8px;
  background: #282c34;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
}

.code-header {
  padding: 8px 12px;
  background: #21252b;
  color: #abb2bf;
  font-size: 0.9em;
  border-bottom: 1px solid #181a1f;
  display: flex;
  align-items: center;
}

.code-label {
  color: #61afef;
  font-weight: 500;
}

/* Error Styles */
.error-block {
  background: #fff0f0;
  border: 1px solid #ffcdd2;
  border-radius: 4px;
  padding: 12px;
  margin-top: 8px;
}

.error-message {
  color: #d32f2f;
  font-family: monospace;
  white-space: pre-wrap;
  margin-bottom: 8px;
}

.error-code .code-header {
  background: #ffebee;
  color: #d32f2f;
}

.error-code .code-block {
  background: #1e1e1e;
  color: #d4d4d4;
}

/* Plot Styles */
.plot-container {
  margin: 12px 0;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.visualization-plot {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.visualization-plot:hover {
  transform: scale(1.02);
}

/* Modal Styles */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  cursor: pointer;
}

.modal-content {
  background: transparent;
  cursor: default;
  padding: 20px;
  max-width: 95vw;
  max-height: 95vh;
}

.modal-image {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
</style> 