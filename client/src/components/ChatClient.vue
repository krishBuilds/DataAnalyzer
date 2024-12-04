<template>
        <div class="excel-toolbar">
        <div class="toolbar-left">
          <button @click="undo" :disabled="!canUndo" class="toolbar-btn">
            <i class="fas fa-undo"></i>
          </button>
          <button @click="redo" :disabled="!canRedo" class="toolbar-btn">
            <i class="fas fa-redo"></i>
          </button>
        </div>
        
        <div class="toolbar-center">
          <button @click="cleanData" :disabled="!gridOperations.getData().length || loading" class="primary">
            <i class="fas fa-broom"></i>
            Clean Data
          </button>
          <button @click="suggestPlots" :disabled="!gridOperations.getData().length || loading" class="primary">
            <i class="fas fa-chart-line"></i>
            Suggest Plots
          </button>
        </div>

        <div class="toolbar-right">
          <button @click="exportData('csv')" :disabled="!gridOperations.getData().length">
            <i class="fas fa-file-csv"></i>
            Export CSV
          </button>
          <button @click="exportData('xlsx')" :disabled="!gridOperations.getData().length">
            <i class="fas fa-file-excel"></i>
            Export XLSX
          </button>
        </div>

        <!-- Move file upload here -->
        <div class="file-upload">
          <div class="upload-row">
            <input 
              type="file" 
              @change="handleFileUpload" 
              accept=".csv,.xlsx,.xls"
              ref="fileInput"
            >
          </div>
        </div>
      </div>

  <div class="data-container">
    <!-- New header row, not visible for some reason-->
    <div v-if="tableData.length" class="table-header-row">
      <div class="header-content">
        <h2>{{ tableTitle || 'Dataset Overview' }}</h2>
        <div class="file-info">
          <span v-if="fileName"><i class="fas fa-file"></i> {{ fileName }}</span>
          <span><i class="fas fa-table"></i> {{ tableData.length }} rows</span>
          <span><i class="fas fa-columns"></i> {{ headers.length }} columns</span>
        </div>
      </div>
    </div>

    <!-- Left side: Table Section -->
    <div class="table-section">
      <div class="grid-wrapper">
        <hot-table
          ref="hotTable"
          :settings="hotSettings"
          @afterChange="handleAfterChange"
          @afterSelection="handleAfterSelection"
          @afterColumnResize="handleColumnResize"
          class="grid-component"
          v-if="hotSettings.data.length"
        />
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
            
            <!-- Add suggestions with checkboxes -->
            <div v-if="message.suggestions" class="suggestions-container">
              <div class="suggestions-header">Cleaning Suggestions:</div>
              <ul class="suggestions-list">
                <li v-for="(suggestion, idx) in message.suggestions" 
                    :key="idx" 
                    class="suggestion-item">
                  <label class="suggestion-label">
                    <input type="checkbox" 
                           v-model="message.selectedSuggestions[idx]" 
                           :checked="true">
                    <span>{{ suggestion }}</span>
                  </label>
                </li>
              </ul>
              <!-- Add clean button -->
              <button 
                v-if="message.suggestions.length" 
                @click="executeSelectedCleanings(message, index)"
                class="clean-selected-btn"
                :disabled="loading">
                <i class="fas fa-broom"></i>
                Clean Selected
              </button>
            </div>
            
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
          
          <!-- Add loading indicator -->
          <div v-if="loading" class="message bot loading-message">
            <div class="loading-content">
              <span>Processing</span>
              <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          </div>
        </div>
        <div class="chat-input-container">
          <textarea
            v-model="userMessage"
            @keyup.enter.exact.prevent="sendMessage"
            placeholder="Ask a question about your data..."
            :disabled="loading || !gridOperations.getData().length"
          ></textarea>
          <button 
            @click="sendMessage" 
            :disabled="loading || !userMessage.trim() || !gridOperations.getData().length"
            class="send-button"
          >
            <i class="fas fa-paper-plane"></i>
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
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { nextTick } from 'vue';
import { HandsontableOperations } from '../operations/HandsontableOperations';

// Register Handsontable modules
registerAllModules();

export default {
  name: 'DataTable',
  components: {
    HotTable
  },
  data() {
    return {
      gridOperations: new HandsontableOperations(),
      hotSettings: {
        data: [],
        colHeaders: true,
        rowHeaders: true,
        licenseKey: 'non-commercial-and-evaluation',
        height: '100%',
        width: '100%',
        stretchH: 'all',
        manualColumnResize: true,
        manualRowResize: true,
        contextMenu: ['row_above', 'row_below', 'remove_row', 'undo', 'redo'],
        multiSelect: true,
        fillHandle: {
          direction: 'vertical',
          autoInsertRow: true
        },
        selectionMode: 'multiple',
        outsideClickDeselects: false,
        cells() {
          return {
            className: 'htMiddle'
          };
        },
        renderAllRows: false,
        viewportRowRenderingOffset: 70,
        viewportColumnRenderingOffset: 30,
        batch: true,
        columnSorting: {
          sortEmptyCells: true,
          initialConfig: {
            column: 0,
            sortOrder: 'asc'
          }
        }
      },
      chatMessages: [],
      userMessage: '',
      loading: false,
      error: null,
      tableData: [],
      headers: [],
      selectedPlotHtml: null,
      isRetrying: false,
      expandedCodes: {},
    }
  },
  created() {
    this.hotSettings = {
      data: [],
      colHeaders: true,
      rowHeaders: true,
      licenseKey: 'non-commercial-and-evaluation',
      height: '100%',
      width: '100%',
      stretchH: 'all',
      manualColumnResize: true,
      manualRowResize: true,
      contextMenu: ['row_above', 'row_below', 'remove_row', 'undo', 'redo'],
      multiSelect: true,
      fillHandle: {
        direction: 'vertical',
        autoInsertRow: true
      },
      selectionMode: 'multiple',
      outsideClickDeselects: false,
      cells() {
        return {
          className: 'htMiddle'
        };
      },
      renderAllRows: false,
      viewportRowRenderingOffset: 70,
      viewportColumnRenderingOffset: 30,
      batch: true,
      columnSorting: {
        sortEmptyCells: true,
        initialConfig: {
          column: 0,
          sortOrder: 'asc'
        }
      }
    };
    
    this.gridOperations.updateData([{empty: ''}]);
    this.hotSettings.columns = this.gridOperations.getColumns();
  },
  computed: {
    changedRows() {
      return this.gridOperations?.getChangedRows() || [];
    },
    canUndo() {
      return this.gridOperations?.currentHistoryIndex > 0;
    },
    canRedo() {
      return this.gridOperations?.currentHistoryIndex < (this.gridOperations?.history.length - 1);
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
    console.log('Component mounted');
    window.addEventListener('resize', this.onResize);
    this.$nextTick(() => {
      console.log('Hot table instance:', this.$refs.hotTable?.hotInstance);
      this.onResize();
    });
  },
  beforeUnmount() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  },
  methods: {
    onResize() {
      console.log('Resizing table');
      if (this.$refs.hotTable?.hotInstance) {
        this.$refs.hotTable.hotInstance.render();
      }
    },

    handleAfterChange(changes, source) {
      if (!changes || source === 'loadData') return;
      
      changes.forEach(([row, prop, oldValue, newValue]) => {
        if (oldValue !== newValue) {
          this.gridOperations.handleCellUpdate(row, prop, newValue);
        }
      });
    },

    handleAfterSelection(row, col, row2, col2) {
      console.log('Selection changed:', { row, col, row2, col2 });
      const selectedRows = [];
      for (let i = Math.min(row, row2); i <= Math.max(row, row2); i++) {
        selectedRows.push(i);
      }
      this.gridOperations.selectRows(selectedRows);
    },

    async handleFileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.loading = true;
      this.error = null;

      try {
        const data = await this.readFile(file);
        if (!data || !data.length) {
          throw new Error('No data found in file');
        }

        // Update grid operations
        this.gridOperations.updateData(data);

        // Update Handsontable settings
        this.hotSettings = {
          ...this.hotSettings,
          data: this.gridOperations.getData(),
          colHeaders: this.gridOperations.getHeaders(),
          columns: this.gridOperations.getColumns(),
          minSpareRows: 1,
          minSpareCols: 1
        };

        // Force table refresh
        await this.$nextTick();
        if (this.$refs.hotTable?.hotInstance) {
          this.$refs.hotTable.hotInstance.loadData(this.hotSettings.data);
          this.$refs.hotTable.hotInstance.render();
        }

        await axios.post('/api/upload', { data });
        
        this.chatMessages.push({
          type: 'bot',
          text: 'Data loaded successfully. What would you like to do with it?'
        });
      } catch (error) {
        this.handleError(error);
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
              // Parse CSV
              const text = e.target.result;
              const rows = text.split('\n');
              const headers = rows[0].split(',').map(h => h.trim());
              
              data = rows.slice(1)
                .filter(row => row.trim())
                .map(row => {
                  const values = row.split(',');
                  const rowData = {};
                  headers.forEach((header, index) => {
                    rowData[header] = values[index]?.trim() || '';
                  });
                  return rowData;
                });
            } else {
              // Parse Excel
              const workbook = XLSX.read(e.target.result, { type: 'binary' });
              data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            }
            resolve(data);
          } catch (error) {
            reject(error);
          }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        
        if (file.name.endsWith('.csv')) {
          reader.readAsText(file);
        } else {
          reader.readAsBinaryString(file);
        }
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
      this.gridOperations?.getSelectedRows().forEach(rowIndex => {
        if (this.tableData[rowIndex]) {
          selectedRowsData.push(this.tableData[rowIndex]);
        }
      });
      return selectedRowsData;
    },

    async sendMessage() {
      if (!this.userMessage.trim() || !this.gridOperations.getData().length) return;

      const question = this.userMessage;
      this.chatMessages.push({ type: 'user', text: question });
      this.userMessage = '';
      this.loading = true;
      this.error = null;

      try {
        const selectedRowsData = this.getSelectedRowsData();
        const response = await axios.post('/api/analyze', {
          question,
          data: this.gridOperations.getData(),
          selectedRows: selectedRowsData,
          selectedIndices: this.gridOperations.getSelectedRows()
        });

        await this.handleSuccessResponse(response);
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    async handleSuccessResponse(response) {
      try {
        if (response.data.data) {
          this.addToHistory({
            data: this.gridOperations.getData(),
            headers: this.gridOperations.getHeaders()
          });
          
          // Update data through gridOperations with changedRows tracking
          const updatedData = this.gridOperations.updateFromServerResponse(response.data);
          await this.updateTableData(updatedData.data);
          
          // Track changed rows
          this.changedRows = updatedData.changedRows || [];
        }

        // Create bot message with all possible properties
        const botMessage = {
          type: 'bot',
          text: response.data.analysis || 'Analysis completed'
        };

        // Add code if present
        if (response.data.code) {
          botMessage.code = response.data.code;
        }

        // Add plot HTML if present
        if (response.data.plot_html) {
          botMessage.plot_html = response.data.plot_html;
        }

        // Add suggestions if present
        if (response.data.suggestions) {
          botMessage.suggestions = response.data.suggestions;
          botMessage.selectedSuggestions = response.data.suggestions.map(() => true);
          botMessage.context = response.data.context; // Store original context
        }

        this.chatMessages.push(botMessage);
        
        // Update chat scroll position
        await nextTick();
        if (this.$refs.chatMessages) {
          this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
        }
      } catch (error) {
        console.error('Error in handleSuccessResponse:', error);
        this.handleError(error);
      }
    },

    displayError(response) {
      this.chatMessages.push({ 
        type: 'bot', 
        text: 'An error occurred while processing your request:',
        error: {
          message: response?.data?.error?.message,
          details: response?.data?.error?.details,
          code: response?.data?.error?.code
        }
      });

      this.$nextTick(() => {
        if (this.$refs.chatMessages) {
          this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
        }
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
      if (!state || !state.data) return;

      // Remove any future states if we're in the middle of the history
      if (this.gridOperations.currentHistoryIndex < this.gridOperations.history.length - 1) {
        this.gridOperations.history = this.gridOperations.history.slice(0, this.gridOperations.currentHistoryIndex + 1);
      }

      this.gridOperations.saveState();
    },
    
    undo() {
      if (this.gridOperations.undo()) {
        this.tableData = this.gridOperations.getData();
        this.headers = this.gridOperations.getHeaders();
      }
    },
    
    redo() {
      if (this.gridOperations.redo()) {
        this.tableData = this.gridOperations.getData();
        this.headers = this.gridOperations.getHeaders();
      }
    },

    async cleanData() {
      this.loading = true;
      const cleaningMessage = "Analyze this dataset and suggest cleaning steps needed";
      
      try {
        const response = await axios.post('/api/clean/suggest', {
          data: this.gridOperations.getDataForServer(),
          question: cleaningMessage
        });
        
        if (response.data.suggestions) {
          this.chatMessages.push({
            type: 'bot',
            text: 'Here are the suggested cleaning operations:',
            suggestions: response.data.suggestions,
            selectedSuggestions: response.data.suggestions.map(() => true),
            context: cleaningMessage // Store original context
          });
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    async executeSelectedCleanings(message) {
      this.loading = true;
      this.isRetrying = false;
      
      try {
        const selectedOperations = message.suggestions.filter(
          (suggestion, idx) => message.selectedSuggestions[idx]
        );

        if (!selectedOperations.length) {
          throw new Error('No cleaning operations selected');
        }

        const executeCleaningRequest = async (operations, context = '', error = null) => {
          return await axios.post('/api/clean/execute', {
            data: this.gridOperations.getDataForServer(),
            suggestions: operations,
            context: context || message.context,
            previousError: error // Pass the error to the server
          });
        };

        // First attempt
        try {
          const response = await executeCleaningRequest(selectedOperations);
          await this.handleCleaningResponse(response);
        } catch (error) {
          // If first attempt fails, try again with error context
          if (!this.isRetrying && error.response?.data?.error) {
            this.isRetrying = true;
            
            // Display the first error
            this.displayError({
              data: {
                error: {
                  message: error.response.data.error.message || error.response.data.error,
                  pythonError: error.response.data.error.pythonError,
                  code: error.response.data.error.code
                }
              }
            });

            try {
              
              // Add the error suggestion to the selected operations
              const errorSuggestion = `Take care of the following error: "${error.response.data.error.message || error.response.data.error}"`;
              selectedOperations.unshift(errorSuggestion); // Add the error suggestion at the beginning

              const retryResponse = await executeCleaningRequest(
                selectedOperations, 
                message.context,
                error.response.data.error // Pass the original error
              );
              await this.handleCleaningResponse(retryResponse);
            } catch (retryError) {
              // If retry also fails, show the error
              this.handleError(retryError);
            }
          } else {
            // If not retrying or no error message, show the original error
            this.handleError(error);
          }
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
        this.isRetrying = false;
        
        // Scroll to bottom of chat
        await this.$nextTick();
        if (this.$refs.chatMessages) {
          this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
        }
      }
    },

    async handleCleaningResponse(response) {
      if (response.data.data) {
        // Use the updateFromServerResponse method
        const updatedData = this.gridOperations.updateFromServerResponse(response.data);
        await this.updateTableData(updatedData.data);
        
        // Add success message to chat
        this.chatMessages.push({
          type: 'bot',
          text: `Successfully applied cleaning operations. ${updatedData.changedRows?.length || 0} rows were modified.`,
          code: response.data.code
        });
      } else {
        throw new Error('No data returned from cleaning operation');
      }
    },

    handleError(error) {
      const errorMessage = {
        type: 'bot',
        text: 'An error occurred:',
        error: {
          message: error.response?.data?.error?.message || error.response?.data?.error || error.message,
          pythonError: error.response?.data?.error?.pythonError,
          code: error.response?.data?.error?.code
        }
      };
      this.chatMessages.push(errorMessage);
      console.error('Operation error:', error);
    },

    exportData(format) {
      if (format === 'csv') {
        this.gridOperations?.exportToCSV();
      } else if (format === 'xlsx') {
        this.gridOperations?.exportToXLSX();
      }
    },

    startEditing(rowIndex, header) {
      const colIndex = this.headers.indexOf(header);
      this.gridOperations?.startEditingCell(rowIndex, colIndex);
    },

    stopEditing() {
      this.gridOperations?.stopEditingCell();
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
      this.gridOperations?.startEditingHeader(index);
    },

    stopEditingHeader() {
      this.gridOperations?.stopEditingHeader();
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
      this.gridOperations?.removeColumn(index);
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

    startSelection(rowIndex) {
      this.gridOperations?.selectRows([rowIndex]);
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
      return this.gridOperations?.getSelectedRows().includes(rowIndex) || false;
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

    async suggestPlots() {
      this.loading = true;
      try {
        const response = await axios.post('/api/suggest-plots', {
          data: this.gridOperations.getDataForServer()
        });

        if (response.data.suggestions) {
          response.data.suggestions.forEach(suggestion => {
            this.chatMessages.push({
              type: 'bot',
              text: suggestion.description,
              plot_html: suggestion.plot_html,
              code: suggestion.code
            });
          });
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    updateExcelData() {
      const data = this.gridOperations.getData();
      const headers = this.gridOperations.getHeaders();
      
      // Format data for vue-excel-editor
      this.excelData = data.map((row, index) => {
        const formattedRow = { id: index + 1 }; // Add id for each row
        headers.forEach(header => {
          formattedRow[header] = row[header];
        });
        return formattedRow;
      });
      
      this.excelHeaders = headers;
    },

    handleColumnResize() {
      if (this.$refs.hotTable?.hotInstance) {
        this.$refs.hotTable.hotInstance.render();
      }
    },

    async updateTableData(newData, newHeaders = null) {
      const hot = this.$refs.hotTable?.hotInstance;
      if (!hot) return;

      // Batch updates to prevent multiple renders
      hot.batchRender(() => {
        if (newData) {
          this.gridOperations.updateData(newData);
          hot.loadData(this.gridOperations.getData());
        }
        
        if (newHeaders) {
          this.gridOperations.updateHeaders(newHeaders);
          hot.updateSettings({
            colHeaders: this.gridOperations.getHeaders(),
            columns: this.gridOperations.getColumns()
          });
        }
      });

      // Update settings after batch render
      this.hotSettings = {
        ...this.hotSettings,
        data: this.gridOperations.getData(),
        colHeaders: this.gridOperations.getHeaders(),
        columns: this.gridOperations.getColumns()
      };
    }
  }
}
</script>

<style scoped>
.data-container {
  display: flex;
  height: calc(100vh - 56px);
  width: 100vw;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.table-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.grid-wrapper {
  flex: 1;
  position: relative;
  border: 1px solid #ddd;
  margin: 0;
  overflow: auto;
}

.grid-component {
  width: 100%;
  height: 100%;
}
:deep(.handsontable th) {
  text-align: center;
  background-color: #e9ecef;
  color: #495057;
  font-weight: 600;
}
:deep(.handsontable) {
  font-size: 14px;
}

:deep(.handsontable .htDimmed) {
  color: #777;
}

:deep(.handsontable .current) {
  background-color: rgba(0, 123, 255, 0.1) !important;
}

:deep(.handsontable .htSelected) {
  background-color: rgba(0, 123, 255, 0.2) !important;
}

:deep(.handsontable td) {
  padding: 4px 8px;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.excel-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  gap: 24px;
}

.toolbar-left, 
.toolbar-center,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-upload {
  order: -1;
  margin-right: auto;
}

.upload-row {
  display: flex;
  align-items: center;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  height: 32px;
  white-space: nowrap;
}

.grid-wrapper {
  flex: 1;
  position: relative;
  border: 1px solid #ddd;
  height: calc(100vh - 56px);
  overflow: hidden;
}

.chat-section {
  width: 380px;
  min-width: 380px;
  max-width: 380px;
  height: 100%;
  border-left: 1px solid #ddd;
  display: flex;
  flex-direction: column;
  background: white;
  overflow: hidden;
  margin: 0;
  padding: 0;
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
  margin: 0;
  padding: 0;
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
  margin: 0;
}

.table-header-row {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #dee2e6;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
}

.header-content h2 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.25rem;
  font-weight: 600;
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
  margin: 0;
  padding: 0;
}

.upload-row {
  display: flex;
  align-items: center;
  gap: 8px;
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


/* Update existing table styles */
.table-wrapper {
  position: relative;
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

.suggestions-container {
  margin-top: 8px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 12px;
}

.suggestions-list {
  list-style-type: none;
  padding: 0;
  margin: 0;
}

.suggestion-item {
  padding: 8px 0;
  border-bottom: 1px solid #eee;
  color: #2c3e50;
  font-size: 0.95em;
}

.suggestion-item:last-child {
  border-bottom: none;
}
.suggestion-label {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  cursor: pointer;
}

.suggestion-label input[type="checkbox"] {
  margin-top: 4px;
}

.clean-selected-btn {
  margin-top: 12px;
  padding: 8px 16px;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.clean-selected-btn:disabled {
  background-color: #6c757d;
  cursor: not-allowed;
}

/* Add styles for excel editor */
.excel-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.grid-component {
  height: 600px;
  width: 100%;
  --rgCol-size: 150px;
}

.loading-message {
  display: flex;
  align-items: center;
  background: #e9ecef;
  max-width: fit-content;
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #666;
  animation: loadingDots 1.4s infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes loadingDots {
  0%, 80%, 100% {
    transform: scale(0);
    opacity: 0;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.chat-input-container {
  position: sticky;
  bottom: 0;
  background: white;
  padding: 16px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin: 0;
}

.chat-input-container textarea {
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: vertical;
  font-size: 14px;
  line-height: 1.4;
  font-family: inherit;
}

.chat-input-container button {
  padding: 12px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background-color 0.2s;
}

.chat-input-container button:hover:not(:disabled) {
  background: #0056b3;
}

.chat-input-container button:disabled {
  background: #6c757d;
  cursor: not-allowed;
}
</style>
