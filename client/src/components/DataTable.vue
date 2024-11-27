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
              <th class="row-number-header"></th>
              <th v-for="(header, index) in headers" 
                  :key="header"
                  @dblclick="startEditingHeader(index)"
                  :class="{ 'editing': isEditingHeader(index) }">
                <div class="header-content">
                  <template v-if="isEditingHeader(index)">
                    <input
                      type="text"
                      v-model="headers[index]"
                      @blur="stopEditingHeader"
                      @keyup.enter="stopEditingHeader"
                      @keyup.esc="cancelEditingHeader"
                      v-focus
                    />
                  </template>
                  <template v-else>
                    {{ header }}
                    <span class="remove-column" @click.stop="removeColumn(index)" title="Remove column">×</span>
                  </template>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, rowIndex) in tableData" 
                :key="rowIndex"
                :class="{ 'highlighted': changedRows.includes(rowIndex) }"
                @mousedown="startSelection(rowIndex, 0, 'row')"
                @mouseover="updateSelection(rowIndex, headers.length - 1)"
                @mouseup="stopSelection">
              <td class="row-number" 
                  @mousedown.stop="startSelection(rowIndex, -1, 'row')"
                  @mouseover="updateSelection(rowIndex, -1)"
                  @mouseup="stopSelection"
                  :class="{ 
                    'selected': isRowSelected(rowIndex),
                    'in-selection-range': isInSelectionRange(rowIndex)
                  }">
                {{ rowIndex + 1 }}
              </td>
              <td v-for="(header, colIndex) in headers" 
                  :key="header"
                  @dblclick="startEditing(rowIndex, header)"
                  :class="{ 
                    'editing': isEditing(rowIndex, header),
                    'selected': isCellSelected(rowIndex, colIndex)
                  }">
                <template v-if="isEditing(rowIndex, header)">
                  <input
                    type="text"
                    v-model="row[header]"
                    @blur="stopEditing"
                    @keyup.enter="stopEditing"
                    @keyup.esc="cancelEditing"
                    v-focus
                  />
                </template>
                <template v-else>
                  {{ row[header] }}
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="button-container">
        <button @click="cleanData" :disabled="!tableData.length || loading" class="primary">
          <i class="fas fa-broom"></i>
          Clean Data
        </button>
        <button @click="undo" :disabled="currentHistoryIndex <= 0">
          <i class="fas fa-undo"></i>
          Undo
        </button>
        <button @click="redo" :disabled="currentHistoryIndex >= history.length - 1">
          <i class="fas fa-redo"></i>
          Redo
        </button>
        <div class="export-buttons">
          <button @click="exportData('csv')" :disabled="!tableData.length">
            <i class="fas fa-file-csv"></i>
            Export CSV
          </button>
          <button @click="exportData('xlsx')" :disabled="!tableData.length">
            <i class="fas fa-file-excel"></i>
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
            <div v-if="message.plot_html" class="plot-container">
              <div class="plot-preview"
                   @click="openPlotModal(message.plot_html)">
                <div class="preview-content">
                  <i class="fas fa-chart-bar"></i>
                  <span>Click to view visualization</span>
                </div>
              </div>
            </div>
            
            <!-- Code block if present -->
            <div v-if="message.code" class="code-block-container">
              <div class="code-header" @click="toggleCode(index)">
                <span class="code-label">Generated Code</span>
                <span class="toggle-icon" :class="{ 'expanded': expandedCodes[index] }">▼</span>
              </div>
              <div class="code-block-wrapper" v-show="expandedCodes[index]">
                <pre class="code-block"><code>{{ message.code }}</code></pre>
              </div>
            </div>
            
            <!-- Error display -->
            <div v-if="message.error" class="error-block">
              <div class="error-title">
                <span class="error-icon">❌</span>
                <span>Error</span>
              </div>
              
              <!-- Python Error Traceback -->
              <div v-if="message.error.pythonError" class="python-error">
                <div class="error-header">Python Error:</div>
                <pre class="error-traceback">{{ message.error.pythonError }}</pre>
              </div>

              <!-- General Error Message -->
              <div class="error-message">
                {{ message.error.message || message.error }}
              </div>

              <!-- Code Block for Error -->
              <div v-if="message.error.code" class="code-block-container">
                <div class="code-header" @click="toggleCode(index + '_error')">
                  <span class="code-label">Error Code</span>
                  <span class="toggle-icon" :class="{ 'expanded': expandedCodes[index + '_error'] }">▼</span>
                </div>
                <div class="code-block-wrapper" v-show="expandedCodes[index + '_error']">
                  <pre class="code-block"><code>{{ message.error.code }}</code></pre>
                </div>
              </div>
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

    <div v-if="selectedPlotHtml" class="modal" @click="closePlotModal">
      <div class="modal-content" @click.stop>
        <button class="close-button" @click="closePlotModal">&times;</button>
        <div class="plot-modal-container" ref="modalPlot"></div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import * as XLSX from 'xlsx';
import { nextTick } from 'vue';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 300000, 
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
      selectedPlotHtml: null,
      isRetrying: false,
      editingCell: null,
      editingHeader: null,
      tempValue: null,
      selection: {
        start: null,  // { row: number, col: number }
        end: null,    // { row: number, col: number }
        type: null,   // 'cell', 'row', 'column'
        selectedCells: new Set(), // Store selected cell coordinates
      },
      isSelecting: false,
      shiftPressed: false,
      expandedCodes: {},
      plotImages: {}, // Store base64 images for each plot
      ctrlPressed: false,
      selectedRows: new Set(), // Add this to track selected rows
    }
  },
  directives: {
    focus: {
      mounted(el) {
        el.focus()
        el.select()
      }
    }
  },
  mounted() {
    // Add keyboard event listeners
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
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

    getSelectedRowsData() {
      const selectedRowsData = [];
      this.selectedRows.forEach(rowIndex => {
        if (this.tableData[rowIndex]) {
          selectedRowsData.push(this.tableData[rowIndex]);
        }
      });
      return selectedRowsData;
    },

    async sendMessage() {
      if (!this.userMessage.trim() || !this.tableData.length) return;

      const question = this.userMessage;
      this.chatMessages.push({ type: 'user', text: question });
      this.userMessage = '';
      this.loading = true;
      this.error = null;

      // Get selected rows data if any
      const selectedRowsData = this.getSelectedRowsData();
      
      const response = await this.executeAnalysis(question, selectedRowsData);

      if (!response.data.error) {
        this.handleSuccessResponse(response);
      } else {
        // Display the original error first
        this.displayError(response);

        // Try once with modified prompt if it's a Python error
        if (!this.isRetrying && response?.data?.error?.message) {
          this.isRetrying = true;
          
            const modifiedQuestion = `${question} Please keep in mind the following error : "${response.data.error.message}"`;
            const retryResponse = await this.executeAnalysis(modifiedQuestion);
            if (!retryResponse.data.error) {
              this.handleSuccessResponse(retryResponse);
            } else {
              // Display the original error first
              this.displayError(retryResponse);
            }
        }
      }
      this.loading = false;
      this.isRetrying = false;
      
    },

    async executeAnalysis(question, selectedRowsData = []) {
      return await axiosInstance.post('/api/analyze', {
        question: question,
        data: this.tableData,
        selectedRows: selectedRowsData,
        selectedIndices: Array.from(this.selectedRows)
      });
    },

    async handleSuccessResponse(response) {
      try {
        // Handle data updates first (restore previous functionality)
        if (response.data.data && response.data.data.length > 0) {
          // Add current state to history before making changes
          this.addToHistory({
            data: this.tableData,
            headers: this.headers
          });
          
          // Update the state after adding to history
          this.tableData = response.data.data;
          this.headers = Object.keys(response.data.data[0] || {});
          this.changedRows = response.data.changedRows || [];
        }

        // Create bot message
        const botMessage = {
          type: 'bot',
          text: response.data.analysis,
          code: response.data.code
        };

        // Add plot HTML if present
        if (response.data.plot_html) {
          botMessage.plot_html = response.data.plot_html;
        }

        // Add message to chat
        this.chatMessages.push(botMessage);
        
        // Update chat scroll position
        await nextTick();
        if (this.$refs.chatMessages) {
          this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
        }
      } catch (error) {
        console.error('Error in handleSuccessResponse:', error);
      }
    },

    displayError( response) {
      //let errorMessage = 'An error occurred';
      
      this.chatMessages.push({ 
        type: 'bot', 
        text: 'An error occurred while processing your request:',
        error: {
          message: response?.data?.error?.message,
          details: response?.data?.message
        },
        code: response?.data?.error?.code
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
      this.currentHistoryIndex = this.history.length - 1;
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
    },

    startEditing(rowIndex, header) {
      this.tempValue = this.tableData[rowIndex][header]
      this.editingCell = { rowIndex, header }
    },

    stopEditing() {
      if (this.editingCell) {
        const { rowIndex, header } = this.editingCell
        const newValue = this.tableData[rowIndex][header]
        
        if (this.tempValue !== newValue) {
          // Add to changed rows if not already included
          if (!this.changedRows.includes(rowIndex)) {
            this.changedRows.push(rowIndex)
          }
          
          // Add to history
          this.addToHistory({
            data: this.tableData,
            headers: this.headers
          })
        }
      }
      this.editingCell = null
      this.tempValue = null
    },

    cancelEditing() {
      if (this.editingCell) {
        const { rowIndex, header } = this.editingCell
        this.tableData[rowIndex][header] = this.tempValue
      }
      this.editingCell = null
      this.tempValue = null
    },

    isEditing(rowIndex, header) {
      return this.editingCell &&
             this.editingCell.rowIndex === rowIndex &&
             this.editingCell.header === header
    },

    startEditingHeader(index) {
      this.tempValue = this.headers[index]
      this.editingHeader = index
    },

    stopEditingHeader() {
      if (this.editingHeader !== null) {
        const newValue = this.headers[this.editingHeader]
        const oldValue = this.tempValue
        
        if (oldValue !== newValue) {
          // Update all row data with new header key
          this.tableData = this.tableData.map(row => {
            const newRow = { ...row }
            newRow[newValue] = row[oldValue]
            delete newRow[oldValue]
            return newRow
          })
          
          // Add to history
          this.addToHistory({
            data: this.tableData,
            headers: this.headers
          })
        }
      }
      this.editingHeader = null
      this.tempValue = null
    },

    cancelEditingHeader() {
      if (this.editingHeader !== null) {
        this.headers[this.editingHeader] = this.tempValue
      }
      this.editingHeader = null
      this.tempValue = null
    },

    isEditingHeader(index) {
      return this.editingHeader === index
    },

    removeColumn(index) {
      const headerToRemove = this.headers[index];
      
      // Create copies for history
      const newData = this.tableData.map(row => {
        const newRow = { ...row };
        delete newRow[headerToRemove];
        return newRow;
      });
      
      // Remove the header
      const newHeaders = this.headers.filter((_, i) => i !== index);
      
      // Add current state to history before making changes
      this.addToHistory({
        data: this.tableData,
        headers: this.headers
      });
      
      // Update the data
      this.tableData = newData;
      this.headers = newHeaders;
    },

    handleKeyDown(e) {
      if (e.key === 'Shift') {
        this.shiftPressed = true;
      }
      if (e.key === 'Control' || e.key === 'Meta') { // Meta for Mac
        this.ctrlPressed = true;
      }
    },

    handleKeyUp(e) {
      if (e.key === 'Shift') {
        this.shiftPressed = false;
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        this.ctrlPressed = false;
      }
    },

    startSelection(rowIndex, colIndex, type = 'cell') {
      if (this.editingCell || this.editingHeader) return;
      
      if (type === 'row') {
        // Handle row number column clicks
        if (colIndex === -1) {
          if (this.ctrlPressed) {
            // Toggle the row selection
            if (this.selectedRows.has(rowIndex)) {
              // Unselect the row
              this.selectedRows.delete(rowIndex);
              // Remove all cells in the row from selection
              for (let j = 0; j < this.headers.length; j++) {
                this.selection.selectedCells.delete(`${rowIndex},${j}`);
              }
            } else {
              // Select the row
              this.selectedRows.add(rowIndex);
              // Add all cells in the row to selection
              for (let j = 0; j < this.headers.length; j++) {
                this.selection.selectedCells.add(`${rowIndex},${j}`);
              }
            }
          } else {
            // Single click without Ctrl
            if (this.selectedRows.has(rowIndex) && this.selectedRows.size === 1) {
              // If clicking the only selected row, unselect it
              this.selectedRows.delete(rowIndex);
              this.selection.selectedCells.clear();
            } else {
              // Clear previous selection and select only this row
              this.selectedRows.clear();
              this.selection.selectedCells.clear();
              this.selectedRows.add(rowIndex);
              // Add all cells in the row to selection
              for (let j = 0; j < this.headers.length; j++) {
                this.selection.selectedCells.add(`${rowIndex},${j}`);
              }
            }
          }
        }
        
        // Continue with existing drag selection logic
        this.isSelecting = true;
        this.selection.type = 'row';
        this.selection.start = { row: rowIndex, col: -1 };
        this.selection.end = { row: rowIndex, col: -1 };
      }
    },

    updateSelection(rowIndex) {
      if (!this.isSelecting || this.selection.type !== 'row') return;
      
      // Handle drag selection
      if (this.selection.start && this.selection.end) {
        const startRow = Math.min(this.selection.start.row, rowIndex);
        const endRow = Math.max(this.selection.start.row, rowIndex);
        
        if (!this.ctrlPressed) {
          this.selectedRows.clear();
          this.selection.selectedCells.clear();
        }
        
        // Add all rows in the range to selection
        for (let i = startRow; i <= endRow; i++) {
          this.selectedRows.add(i);
          // Add all cells in each selected row to selection
          for (let j = 0; j < this.headers.length; j++) {
            this.selection.selectedCells.add(`${i},${j}`);
          }
        }
      }
    },

    stopSelection() {
      this.isSelecting = false;
    },

    calculateSelectedCells() {
      if (this.selection.type !== 'row') return;

      const startRow = Math.min(this.selection.start.row, this.selection.end.row);
      const endRow = Math.max(this.selection.start.row, this.selection.end.row);

      // Clear previous selection
      this.selection.selectedCells.clear();

      // Select all cells in the row range
      for (let i = startRow; i <= endRow; i++) {
        this.headers.forEach((_, j) => {
          this.selection.selectedCells.add(`${i},${j}`);
        });
      }
    },

    isCellSelected(rowIndex, colIndex) {
      return this.selection.selectedCells.has(`${rowIndex},${colIndex}`);
    },

    getSelectedData() {
      const selectedData = [];
      const selectedHeaders = new Set();
      
      this.selection.selectedCells.forEach(coord => {
        const [row, col] = coord.split(',').map(Number);
        const header = this.headers[col];
        selectedHeaders.add(header);
        
        if (!selectedData[row]) {
          selectedData[row] = {};
        }
        selectedData[row][header] = this.tableData[row][header];
      });

      return {
        data: selectedData.filter(Boolean),
        headers: Array.from(selectedHeaders)
      };
    },

    isRowSelected(rowIndex) {
      return this.selectedRows.has(rowIndex);
    },

    isInSelectionRange(rowIndex) {
      if (this.selection.type !== 'row' || !this.isSelecting) return false;
      
      const startRow = Math.min(this.selection.start.row, this.selection.end.row);
      const endRow = Math.max(this.selection.start.row, this.selection.end.row);
      return rowIndex >= startRow && rowIndex <= endRow;
    },

    toggleCode(index) {
      this.expandedCodes[index] = !this.expandedCodes[index];
    },

    async openPlotModal(plotHtml) {
      try {
        this.selectedPlotHtml = plotHtml;
        await nextTick();
        
        const modalPlot = this.$refs.modalPlot;
        if (modalPlot) {
          // Create an iframe to isolate the plot HTML
          const iframe = document.createElement('iframe');
          iframe.style.width = '100%';
          iframe.style.height = '100%';
          iframe.style.border = 'none';
          
          modalPlot.innerHTML = ''; // Clear previous content
          modalPlot.appendChild(iframe);
          
          // Write the HTML content to the iframe
          const iframeDoc = iframe.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(plotHtml);
          iframeDoc.close();
        }
      } catch (error) {
        console.error('Error opening plot modal:', error);
      }
    },

    closePlotModal() {
      this.selectedPlotHtml = null;
      const modalPlot = this.$refs.modalPlot;
      if (modalPlot) {
        modalPlot.innerHTML = '';
      }
    },
  }
}
</script>

<style scoped>
.data-container {
  display: flex;
  gap: 20px;
  height: 100vh;
  padding: 10px 20px;
  box-sizing: border-box;
}

.table-section {
  flex: 2;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.table-wrapper {
  flex: 1;
  overflow: auto;
  border: 1px solid #ddd;
  border-radius: 4px;
  margin-bottom: 16px;
  height: 100%;
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
  padding: 8px;
}

.chat-section {
  flex: 1;
  min-width: 300px;
  max-width: 500px;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.chat-container {
  background: #f8f9fa;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #ddd;
  text-align: left;
  overflow: hidden;
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
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
}

.chat-input button {
  padding: 8px 16px;
  background-color: #000000;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s ease;
  min-width: 80px;
}

.chat-input button:hover:not(:disabled) {
  background-color: #333333;
  transform: translateY(-1px);
}

.chat-input button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
  opacity: 0.7;
}

.message-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  resize: none;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
}

.message-input:focus {
  outline: none;
  border-color: #000000;
  box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
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
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.code-header:hover {
  background: #2c313a;
}

.toggle-icon {
  transition: transform 0.3s ease;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.code-block-wrapper {
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.code-block {
  margin: 0;
  padding: 12px 16px;
  color: #abb2bf;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  background: #282c34;
  overflow-x: auto;
}

.error-block {
  background: rgba(255, 240, 240, 0.7);
  border: 1px solid #ffd7d7;
  border-radius: 6px;
  padding: 12px;
  margin-top: 8px;
}

.error-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ff8080;
  font-weight: bold;
  margin-bottom: 12px;
}

.python-error {
  margin: 12px 0;
  background: #f8f8f8;
  border-radius: 4px;
  overflow: hidden;
}

.error-header {
  background: #fff0f0;
  padding: 8px 12px;
  color: #ff8080;
  font-weight: 500;
}

.error-traceback {
  margin: 0;
  padding: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  color: #666;
  background: #fafafa;
  overflow-x: auto;
}

.error-message {
  color: #ff8080;
  font-family: monospace;
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 8px;
  line-height: 1.4;
  overflow-wrap: break-word;
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
  gap: 12px;
  margin: 8px 0;
  align-items: center;
  justify-content: center;
  padding: 8px 0;
  max-width: fit-content;
}

.button-container button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: 1px solid #e0e0e0;
  background: white;
  color: #666;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 32px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.button-container button:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
}

.button-container button:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
  border-color: #e0e0e0;
}

.button-container button i {
  font-size: 14px;
}

/* Style for primary actions */
.button-container button.primary {
  background: white;
  color: #666;
  border: 1px solid #e0e0e0;
}

.button-container button.primary:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
}

.button-container button.primary:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
  border-color: #e0e0e0;
}

.export-buttons {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.plot-container {
  margin: 12px 0;
  padding: 8px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
  width: calc(100% - 16px); /* Account for padding */
  max-width: 100%;
  box-sizing: border-box;
}

.plot-preview {
  cursor: pointer;
  padding: 12px;
  background: #f8f9fa;
  border: 1px dashed #dee2e6;
  border-radius: 4px;
  transition: background-color 0.2s;
  width: 100%;
  box-sizing: border-box;
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
}

.modal-content {
  position: relative;
  background: white;
  padding: 20px;
  border-radius: 8px;
  width: 90vw;
  height: 90vh;
  overflow: hidden;
}

.plot-modal-container {
  width: 100%;
  height: 100%;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  z-index: 1;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: background-color 0.2s;
}

.close-button:hover {
  background-color: rgba(0, 0, 0, 0.1);
}

.plot-preview {
  cursor: pointer;
  padding: 20px;
  background: #f8f9fa;
  border: 1px dashed #dee2e6;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.plot-preview:hover {
  background: #e9ecef;
}

.preview-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #6c757d;
}

.preview-content i {
  font-size: 1.2em;
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
  overflow: hidden;
  width: 100%;
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

.python-file-block {
  margin-top: 12px;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 12px;
}

.file-header {
  color: #61afef;
  font-weight: 500;
  margin-bottom: 8px;
}

.file-content {
  color: #abb2bf;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  background: #282c34;
  padding: 8px;
  border-radius: 4px;
}

.python-error-block {
  margin-top: 8px;
  margin-bottom: 12px;
  background: #2c1215;
  border: 1px solid #442326;
  border-radius: 6px;
  padding: 12px;
}

.error-header {
  color: #ff6b6b;
  font-weight: 500;
  margin-bottom: 8px;
}

.python-file-block {
  margin-top: 12px;
  background: #1e1e1e;
  border-radius: 4px;
  padding: 12px;
}

.file-header {
  color: #61afef;
  font-weight: 500;
  margin-bottom: 8px;
}

.file-content {
  color: #abb2bf;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  background: #282c34;
  padding: 8px;
  border-radius: 4px;
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

.data-grid td {
  position: relative;
  min-width: 100px;
}

.data-grid td.editing,
.data-grid th.editing {
  padding: 0;
  border: 2px solid #000;
}

.data-grid td.editing input,
.data-grid th.editing input {
  width: 100%;
  height: 100%;
  padding: 8px;
  border: none;
  outline: none;
  box-sizing: border-box;
}

.data-grid th.editing {
  background-color: #f5f5f5;
}

.data-grid th.editing input {
  background-color: #f5f5f5;
  font-weight: bold;
}

.data-grid td:hover,
.data-grid th:hover {
  background-color: #f8f9fa;
  cursor: cell;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  padding-right: 20px; /* Space for the remove button */
}

.remove-column {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0;
  cursor: pointer;
  color: #999;
  font-size: 18px;
  font-weight: bold;
  padding: 0 5px;
  transition: opacity 0.2s, color 0.2s;
}

.header-content:hover .remove-column {
  opacity: 1;
}

.remove-column:hover {
  color: #666;
}

.data-grid td.selected {
  background-color: rgba(51, 153, 255, 0.2);
  position: relative;
}

.data-grid td.selected::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 1px solid #3399ff;
  pointer-events: none;
}

.data-grid tr:hover td {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Prevent text selection while dragging */
.data-grid {
  user-select: none;
}

/* Allow text selection when not dragging */
.data-grid:not(.selecting) {
  user-select: text;
}

.row-number-header {
  width: 25px !important;
  min-width: 25px !important;
  max-width: 40px !important;
  background-color: #f8f9fa;
  border-right: 2px solid #ddd;
  user-select: none;
  cursor: default;
  padding: 0 !important;
  text-align: center;
}

.row-number {
  width: 25px !important;
  min-width: 25px !important;
  max-width: 40px !important;
  background-color: #f8f9fa;
  border-right: 2px solid #ddd;
  text-align: center !important;
  user-select: none;
  color: #666;
  position: sticky;
  left: 0;
  z-index: 1;
  font-size: 0.9em;
  cursor: pointer;
  padding: 4px 2px !important;
  text-align: center;
}

.row-number:hover {
  background-color: #7497ba;
}

.row-number.selected {
  background-color: #0078d4 !important;
  color: white !important;
}

.row-number.in-selection-range {
  background-color: #0078d4 !important;
  color: white !important;
}

/* Update existing table styles */
.table-wrapper {
  position: relative;
}

.data-grid th:first-child,
.data-grid td:first-child {
  position: sticky;
  left: 0;
  z-index: 2;
}

.data-grid th.row-number-header {
  z-index: 3;
}

.code-block-wrapper {
  max-height: 300px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: #4b5263 #282c34;
}

.code-block {
  margin: 0;
  padding: 12px 16px;
  color: #abb2bf;
  font-family: 'Fira Code', 'Courier New', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  background: #282c34;
  white-space: pre;
  overflow-x: auto;
}

.code-block-container {
  margin-top: 8px;
  background: #282c34;
  border-radius: 8px;
  overflow: hidden;
}

.code-header {
  padding: 8px 12px;
  background: #21252b;
  color: #abb2bf;
  font-size: 0.9em;
  border-bottom: 1px solid #181a1f;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}

.toggle-icon {
  transition: transform 0.3s ease;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.plot-interactive :deep(.js-plotly-plot) {
  width: 100% !important;
}

.plot-image {
  width: 100%;
  height: auto;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.plot-image:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.plot-html-fallback {
  cursor: pointer;
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
}

.modal-content {
  background: white;
  padding: 20px;
  border-radius: 8px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
}

.plot-container {
  margin: 12px 0;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  overflow: hidden;
  width: 100%;
}

.plot-image {
  width: 100%;
  height: auto;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.plot-interactive {
  width: 100%;
  height: 300px;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.plot-interactive:hover {
  transform: scale(1.02);
}

.plot-interactive :deep(.js-plotly-plot) {
  width: 100% !important;
  height: 100% !important;
}
</style>