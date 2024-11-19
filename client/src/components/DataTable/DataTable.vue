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
      :selectedPlot="selectedPlot"
      :userMessage="userMessage"
      @send-message="sendMessage"
      @select-plot="selectedPlot = $event"
      @update:userMessage="userMessage = $event"
      ref="chatSection"
    />

    <div v-if="selectedPlot" class="modal" @click="selectedPlot = null">
      <div class="modal-content" @click.stop>
        <img :src="`data:image/png;base64,${selectedPlot}`" alt="Data Visualization" class="modal-image">
      </div>
    </div>
  </div>
</template>

<script>
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
  data() {
    return {
      userMessage: '',
      selectedPlot: null
    }
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
      exportData
    } = useDataHandling();

    const {
      chatMessages,
      sendMessage
    } = useChatHandling(tableData, headers);

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
      sendMessage
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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
</style> 