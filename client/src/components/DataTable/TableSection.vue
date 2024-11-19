<template>
  <div class="table-section">
    <div class="file-upload">
      <div class="upload-row">
        <input 
          type="file" 
          @change="$emit('file-upload', $event)" 
          accept=".csv,.xlsx,.xls"
          ref="fileInput"
        >
        <span class="file-info">Supported formats: CSV, XLSX, XLS</span>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>
    
    <div v-if="loading" class="loading">
      Loading data...
    </div>

    <div class="table-wrapper">
      <table v-if="tableData.length" class="data-grid">
        <thead>
          <tr>
            <th v-for="header in headers" :key="header">{{ header }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in tableData" 
              :key="index"
              :class="{ 'highlighted': changedRows.includes(index) }">
            <td v-for="header in headers" :key="header">{{ row[header] }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="button-container">
      <button @click="$emit('clean-data')" :disabled="!tableData.length || loading">
        Clean Data
      </button>
      <button @click="$emit('undo')" :disabled="currentHistoryIndex <= 0">
        <span class="icon">↩</span> Undo
      </button>
      <button @click="$emit('redo')" :disabled="currentHistoryIndex >= history.length - 1">
        <span class="icon">↪</span> Redo
      </button>
      <div class="export-buttons">
        <button @click="$emit('export-data', 'csv')" :disabled="!tableData.length">
          Export CSV
        </button>
        <button @click="$emit('export-data', 'xlsx')" :disabled="!tableData.length">
          Export XLSX
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TableSection',
  props: {
    headers: Array,
    tableData: Array,
    changedRows: Array,
    loading: Boolean,
    error: String,
    history: Array,
    currentHistoryIndex: Number
  },
  emits: ['file-upload', 'clean-data', 'undo', 'redo', 'export-data']
}
</script>

<style scoped>
.table-section {
  flex: 2;
  min-width: 400px;
  display: flex;
  flex-direction: column;
}

.file-upload {
  margin-bottom: 16px;
}

.upload-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.file-info {
  color: #666;
  font-size: 0.9em;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 16px;
}

.data-grid {
  width: 100%;
  border-collapse: collapse;
}

.data-grid th, .data-grid td {
  padding: 8px;
  text-align: left;
  border-bottom: 1px solid #ddd;
}

.data-grid th {
  background: #f8f9fa;
  font-weight: bold;
}

.highlighted {
  background-color: #fff3cd;
}

.button-container {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #007bff;
  color: white;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.icon {
  font-size: 1.2em;
}
</style> 