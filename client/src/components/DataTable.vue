<template>
  <div class="data-container">
    <!-- Left side: Table Section -->
    <div class="table-section">
      <div class="file-upload">
        <div class="upload-row">
          <input 
            type="file" 
            @change="handleFileUpload" 
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
        <button @click="cleanData" :disabled="!tableData.length || loading">
          Clean Data
        </button>
        <button @click="undo" :disabled="currentHistoryIndex <= 0">
          <span class="icon">↩</span> Undo
        </button>
        <button @click="redo" :disabled="currentHistoryIndex >= history.length - 1">
          <span class="icon">↪</span> Redo
        </button>
        <div class="export-buttons">
          <button @click="exportData('csv')" :disabled="!tableData.length">
            Export CSV
          </button>
          <button @click="exportData('xlsx')" :disabled="!tableData.length">
            Export XLSX
          </button>
        </div>
      </div>
    </div>

    <!-- Right side: Chat Section -->
    <div class="chat-section">
      <div class="chat-container">
        <h3>AI Assistant</h3>
        <div class="chat-messages" ref="chatMessages">
          <div v-for="(message, index) in chatMessages" 
               :key="index" 
               :class="['message', message.type]">
            <div class="message-text">{{ message.text }}</div>
            
            <!-- Plot display -->
            <div v-if="message.plot" class="plot-container">
              <img 
                :src="`data:image/png;base64,${message.plot}`" 
                alt="Data Visualization" 
                class="visualization-plot"
                @click="selectedPlot = message.plot"
              />
            </div>
            
            <!-- Code display -->
            <div v-if="message.code" class="code-block-container">
              <div class="code-header">
                <span class="code-label">Generated Code</span>
              </div>
              <div class="code-block-wrapper">
                <pre class="code-block"><code>{{ message.code }}</code></pre>
              </div>
            </div>
            
            <!-- Error display -->
            <div v-if="message.error" class="error-block">
              <div class="error-title">
                <span class="error-icon">❌</span>
                <span>Error</span>
                <span v-if="message.error.line" class="error-location">at line {{ message.error.line }}</span>
              </div>
              <pre class="error-content">{{ message.error.message || message.error }}</pre>
            </div>
          </div>
        </div>
        <div class="chat-input">
          <textarea 
            v-model="userMessage" 
            @keyup.enter.exact="sendMessage"
            placeholder="Ask about your data..."
            class="message-input"
            rows="1"
          ></textarea>
          <button @click="sendMessage" :disabled="!userMessage.trim() || loading">
            Send
          </button>
        </div>
      </div>
    </div>

    <div v-if="selectedPlot" class="modal" @click="selectedPlot = null">
      <div class="modal-content" @click.stop>
        <img :src="`data:image/png;base64,${selectedPlot}`" alt="Data Visualization" class="modal-image">
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import * as XLSX from 'xlsx';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 60000, // 60 second timeout
  maxContentLength: 100 * 1024 * 1024, // 100MB max content length
});

export default {
  name: 'DataTable',
  data() {
    return {
      headers: [],
      tableData: [],
      changedRows: [],
      loading: false,
      error: null,
      userMessage: '',
      chatMessages: [
        { type: 'bot', text: 'Hello! Upload a file and I can help you analyze it.' }
      ],
      previousTableState: null,
      history: [],
      currentHistoryIndex: -1,
      selectedPlot: null,
      isRetrying: false,
    }
  },
  methods: {
    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.loading = true;
      this.error = null;
      this.tableData = [];
      this.headers = [];
      this.changedRows = [];

      try {
        const data = await this.readFile(file);
        this.tableData = data;
        this.headers = Object.keys(data[0] || {});
        
        // Initialize history with first state
        this.history = [{
          data: JSON.parse(JSON.stringify(data)),
          headers: [...this.headers]
        }];
        this.currentHistoryIndex = 0;
        
        // Upload data to server
        await axios.post('/api/upload', { data });
        
        this.chatMessages.push({
          type: 'bot',
          text: 'Data loaded successfully. What would you like to do with it?'
        });
      } catch (error) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    async readFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
          try {
            let data;
            if (file.name.endsWith('.csv')) {
              data = this.parseCSV(e.target.result);
            } else {
              const workbook = XLSX.read(e.target.result, { type: 'binary' });
              data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }
            resolve(data);
          } catch (error) {
            reject(error);
          }
        };

        if (file.name.endsWith('.csv')) {
          reader.readAsText(file);
        } else {
          reader.readAsBinaryString(file);
        }
      });
    },

    parseCSV(content) {
      // Basic CSV parsing
      const lines = content.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      return lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
          obj[header] = values[index]?.trim();
          return obj;
        }, {});
      });
    },

    async analyzeData() {
      this.loading = true;
      this.error = null;
      
      try {
        const response = await axios.post('/api/analyze', {
          data: this.tableData,
          question: 'Please clean this data and provide a summary'
        });
        
        if (response.data.data) {
          this.tableData = response.data.data;
          this.changedRows = response.data.changedRows || [];
        }
        
        this.chatMessages.push({ 
          type: 'bot', 
          text: response.data.analysis 
        });
      } catch (error) {
        this.error = error.response?.data?.error || 'An error occurred while analyzing data';
        console.error('Error analyzing data:', error);
      } finally {
        this.loading = false;
      }
    },

    async sendMessage() {
      if (!this.userMessage.trim() || !this.tableData.length) return;

      const question = this.userMessage;
      this.chatMessages.push({ type: 'user', text: question });
      this.userMessage = '';
      this.loading = true;
      this.error = null;

      try {
        const response = await this.executeAnalysis(question);
        this.handleSuccessResponse(response);
      } catch (error) {
        // Display the original error first
        this.displayError(error);

        // Try once with modified prompt if it's a Python error
        if (!this.isRetrying && error.response?.data?.error) {
          this.isRetrying = true;
          try {
            const modifiedQuestion = `${question} Please keep in mind the following error : "${error.response.data.error}"`;
            const retryResponse = await this.executeAnalysis(modifiedQuestion);
            this.handleSuccessResponse(retryResponse);
          } catch (retryError) {
            // Don't display retry error since we already showed the original error
            console.log('Retry attempt failed:', retryError);
          }
        }
      } finally {
        this.loading = false;
        this.isRetrying = false;
      }
    },

    async executeAnalysis(question) {
      return await axiosInstance.post('/api/analyze', {
        question: question,
        data: this.tableData
      });
    },

    handleSuccessResponse(response) {
      if (response.data.data && response.data.data.length > 0) {
        this.addToHistory({
          data: this.tableData,
          headers: this.headers
        });
        
        this.tableData = response.data.data;
        this.headers = Object.keys(response.data.data[0] || {});
        this.changedRows = response.data.changedRows || [];
      }

      const botMessage = {
        type: 'bot',
        text: response.data.analysis,
        code: response.data.code
      };

      if (response.data.plot) {
        botMessage.plot = response.data.plot;
      }

      this.chatMessages.push(botMessage);
      this.$nextTick(() => {
        this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
      });
    },

    displayError(error) {
      let errorMessage = error.response?.data?.error || 'An error occurred';
      if (error.request) {
        errorMessage = 'Server not responding. Please try again.';
      } else if (!error.response) {
        errorMessage = 'Failed to send request: ' + error.message;
      }

      this.chatMessages.push({ 
        type: 'bot', 
        text: errorMessage,
        error: {
          message: errorMessage,
          details: error.response?.data?.details || error.message,
          code: error.response?.data?.code
        }
      });

      this.$nextTick(() => {
        this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
      });
    },

    revertTable() {
      if (this.previousTableState) {
        this.tableData = [...this.previousTableState.data];
        this.headers = [...this.previousTableState.headers];
        this.changedRows = [];
        this.chatMessages.push({
          type: 'bot',
          text: 'Reverted to previous table state'
        });
      }
    },
    
    addToHistory(state) {
      // Remove any future states if we're in the middle of the history
      if (this.currentHistoryIndex < this.history.length - 1) {
        this.history = this.history.slice(0, this.currentHistoryIndex + 1);
      }
      
      // Create a deep copy of the state
      const newState = {
        data: JSON.parse(JSON.stringify(state.data)),
        headers: [...state.headers]
      };
      
      // Add new state
      this.history.push(newState);
      this.currentHistoryIndex++;
    },
    
    undo() {
      if (this.currentHistoryIndex > 0) {
        this.currentHistoryIndex--;
        const state = this.history[this.currentHistoryIndex];
        this.tableData = JSON.parse(JSON.stringify(state.data));
        this.headers = [...state.headers];
        this.changedRows = [];
      }
    },
    
    redo() {
      if (this.currentHistoryIndex < this.history.length - 1) {
        this.currentHistoryIndex++;
        const state = this.history[this.currentHistoryIndex];
        this.tableData = JSON.parse(JSON.stringify(state.data));
        this.headers = [...state.headers];
        this.changedRows = [];
      }
    },

    async cleanData() {
      this.loading = true;
      const cleaningMessage = "Clean this dataset by: 1. Remove unnecessary columns 2. Rename headers to be more readable 3. Format data consistently";
      
      // Add user message to chat
      this.chatMessages.push({ type: 'user', text: 'Clean the data' });
      
      try {
        const response = await this.executeAnalysis(cleaningMessage);
        this.handleSuccessResponse(response);
      } catch (error) {
        this.displayError(error);
      } finally {
        this.loading = false;
      }
    },

    exportData(format) {
      if (format === 'csv') {
        const csvContent = this.headers.join(',') + '\n' + 
          this.tableData.map(row => 
            this.headers.map(header => row[header]).join(',')
          ).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `data_export.${format}`;
        a.click();
        window.URL.revokeObjectURL(url);
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(this.tableData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data');
        XLSX.writeFile(wb, 'data_export.xlsx');
      }
    }
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

.table-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin: 8px 0;
}

.data-grid {
  width: 100%;
  border-collapse: collapse;
  white-space: nowrap;
}

.data-grid th, .data-grid td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.data-grid th {
  background-color: #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 1;
}

.chat-section {
  width: 350px;
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
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
}

.message {
  padding: 10px;
  border-radius: 8px;
  max-width: 75%;
}

.message.user {
  background: #007bff;
  color: white;
  align-self: flex-end;
}

.message.bot {
  background: #e9ecef;
  color: #212529;
  align-self: flex-start;
  margin-right: auto;
}

.chat-input {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 10px;
}

.message-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: none;
  height: 38px;
  overflow: hidden;
  line-height: 20px;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

.chat-input button {
  padding: 8px 15px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.chat-input button:disabled {
  background: #ccc;
}

.file-upload {
  margin: 10px 0;
  padding: 12px;
  border: 2px dashed #ccc;
  border-radius: 8px;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 15px;
}

.file-info {
  color: #666;
  font-size: 0.9em;
}

.error-message {
  color: #dc3545;
  padding: 10px;
  margin: 10px 0;
  background-color: #ffe6e6;
  border-radius: 4px;
}

.analyze-btn {
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 10px;
}

.analyze-btn:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

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

.code-block {
  margin: 0;
  padding: 12px 16px;
  color: #abb2bf;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  background: #282c34;
}

.error-block {
  margin-top: 8px;
  background: #2c1215;
  border: 1px solid #442326;
  border-radius: 6px;
  padding: 12px;
}

.error-title {
  color: #ff4d4d;
  font-weight: bold;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-icon {
  font-size: 1.1em;
}

.error-location {
  font-size: 0.9em;
  color: #ff8080;
  margin-left: auto;
}

.error-content {
  color: #ffa6a6;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  background: rgba(255, 0, 0, 0.1);
  padding: 8px;
  border-radius: 4px;
  border: 1px solid rgba(255, 0, 0, 0.2);
}

.highlighted {
  background-color: #fff3cd;
  transition: background-color 0.3s;
}

.highlighted:hover {
  background-color: #ffe69c;
}

.button-container {
  display: flex;
  gap: 8px;
  margin: 8px 0;
  flex-wrap: wrap;
}

.button-container button {
  padding: 8px 15px;
  border: none;
  border-radius: 4px;
  background: #007bff;
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 5px;
}

.button-container button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.error-block {
  margin-top: 8px;
  background: #fee;
  border: 1px solid #fcc;
  border-radius: 4px;
  padding: 8px;
}

.error-title {
  color: #c00;
  font-weight: bold;
  margin-bottom: 4px;
}

.error-content {
  color: #666;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.code-block-container {
  margin-top: 8px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.code-header {
  padding: 8px 12px;
  background: #eef;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toggle-icon {
  transition: transform 0.2s;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.code-block-wrapper {
  overflow-x: auto;
  margin: 0;
  background: #282c34;
}

.code-block {
  margin: 0;
  padding: 8px;
  background: #282c34;
  color: #d4d4d4;
  font-family: 'Courier New', Courier, monospace;
  white-space: pre;
  min-width: 100%;
}

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

.message-text {
  margin-bottom: 8px;
}

.slide-enter-active, .slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from, .slide-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.export-buttons {
  display: flex;
  gap: 5px;
}

.plot-container {
  margin: 12px 0;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
}

.visualization-plot {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 0 auto;
}

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
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
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
</style>