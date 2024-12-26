<template>
  <div class="excel-toolbar">
    <div class="toolbar-left">
      <!-- File input must be present -->
      <input 
        type="file" 
        @change="handleFileUpload" 
        accept=".csv,.xlsx,.xls"
        ref="fileInput"
        class="file-input"
        id="file-upload"
      >
      <!-- File button -->
      <button class="toolbar-btn" @click="$refs.fileInput?.click()">
        <i class="fas fa-file-import"></i>
        <span>Open</span>
      </button>
      
      <!-- Show filename when present -->
      <div v-if="fileName" class="file-name">
        <i class="fas fa-file"></i>
        <span>{{ fileName }}</span>
      </div>

      <!-- Separator -->
      <div class="toolbar-separator"></div>
      
      <!-- Rest of the toolbar buttons -->
      <button class="toolbar-btn icon-only" :disabled="!canUndo" @click="undo">
        <i class="fas fa-undo"></i>
      </button>
      <button class="toolbar-btn icon-only" :disabled="!canRedo" @click="redo">
        <i class="fas fa-redo"></i>
      </button>
    </div>

    <div class="toolbar-center">
      <!-- Clean and Plot buttons with icons only -->
      <button class="toolbar-btn" @click="cleanData">
        <i class="fas fa-broom"></i>
        <span>Clean</span>
      </button>
      <button class="toolbar-btn" @click="suggestPlots">
        <i class="fas fa-chart-bar"></i>
        <span>Plot</span>
      </button>
    </div>

    <div class="toolbar-right">
      <!-- Export buttons with minimal text -->
      <button class="toolbar-btn" @click="exportData('csv')">
        <i class="fas fa-file-csv"></i>
        <span>CSV</span>
      </button>
      <button class="toolbar-btn" @click="exportData('xlsx')">
        <i class="fas fa-file-excel"></i>
        <span>XLSX</span>
      </button>
    </div>
  </div>

  <div class="data-container">
    <div class="table-section" :style="{ width: tableWidth }">
      <!-- Add background wrapper -->
      <div class="table-background">
        <div class="grid-wrapper">
          <hot-table
            ref="hotTable"
            :settings="hotSettings"
            @afterChange="handleAfterChange"
            @afterSelection="handleAfterSelection"
            @afterColumnResize="handleColumnResize"
            class="grid-component"
            v-if="hotSettings.data.length && !isDestroyed"
          />
        </div>
      </div>
    </div>

    <div 
      class="resizer"
      @mousedown="startResize"
      @dblclick="resetSize"
    >
      <div class="resizer-line"></div>
    </div>

    <div class="chat-section" :style="{ width: `${chatWidth}px` }">
      <!-- Resizer -->
      <div 
        class="resizer"
        :class="{ 'is-dragging': isDragging }" 
        @mousedown="startResize"
        @dblclick="resetSize">
        <div class="resizer-handle"></div>
      </div>

      <div class="chat-container">
        <h3>AI Assistant</h3>
        <div class="flow-controls">
          <button @click="captureFlow" class="flow-btn">
            <i class="fas fa-camera"></i>
            <span>Capture</span>
          </button>
          <button @click="toggleFlowRecording" :class="['flow-btn', { 'recording': isRecording }]">
            <i class="fas fa-record-vinyl"></i>
            <span>{{ isRecording ? 'Stop' : 'Record' }}</span>
          </button>
          <button @click="showFlows" class="flow-btn">
            <i class="fas fa-list"></i>
            <span>Flows</span>
          </button>
        </div>
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
                <MonacoEditor
                  :value="message.code"
                  :data="gridOperations.getData()"
                  @dataframe-update="handleDataFrameUpdate"
                  :language="'python'"
                  :theme="'vs-dark'"
                  class="code-editor"
                  :debug-mode="debugMode"
                />
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
          <div class="input-group">
            <textarea 
              v-model="userMessage"
              @keydown.enter.exact.prevent="sendMessage"
              placeholder="Type your message..."
              :disabled="loading"
            ></textarea>
            <div class="controls-group">
              <button 
                @click="sendMessage" 
                :disabled="loading || !userMessage.trim()"
                class="send-button"
              >
                <i class="fas fa-paper-plane"></i>
              </button>
              <label class="toggle-switch">
                <input 
                  type="checkbox" 
                  :checked="debugMode"
                  @change="$emit('update:debugMode', $event.target.checked)"
                />
                <span class="slider">
                  <i class="fas fa-bug"></i>
                </span>
                <small class="debug-label">Debug</small>
              </label>
            </div>
          </div>
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

  <!-- Replace the FlowsOverlay component with ChatFlows -->
  <ChatFlows
    v-if="showFlowsOverlay"
    :show="showFlowsOverlay"
    :flows="chatFlows.flows"
    @close="handleFlowsClose"
    @view-flow="viewFlow"
    @delete-flow="deleteFlow"
    @rename-flow="handleRenameFlow"
    @flow-step-complete="handleFlowStepComplete"
    @flow-complete="handleFlowComplete"
  />
</template>

<script>
import { HotTable } from '@handsontable/vue3';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.min.css';
import axios from 'axios';
import * as XLSX from 'xlsx';
import { nextTick } from 'vue';
import { HandsontableOperations } from '../operations/HandsontableOperations';
import MonacoEditor from './MonacoEditor.vue';
import ChatFlows from './ChatFlows.vue';  // Keep only this import for the component
import chatFlowsManager from '../utils/ChatFlows';  // Keep only this import for the manager

// Register Handsontable modules
registerAllModules();

export default {
  name: 'DataTable',
  components: {
    HotTable,
    MonacoEditor,
    ChatFlows  // Use ChatFlows instead of FlowsOverlay
  },
  emits: ['update:debugMode', 'beforeDestroy'], // Add emits declaration
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
      chatWidth: 437,
      isDragging: false,
      minChatWidth: 280,
      maxChatWidth: 800,
      debugMode: false,
      fileName: '', // Ensure fileName is in data
      isDestroyed: false,
      isRecording: false,
      chatFlows: chatFlowsManager,
      showFlowsOverlay: false,
      isClosingOverlay: false,  // renamed from _isClosing
    }
  },
  created() {
    // Reset state when component is created
    this.gridOperations = new HandsontableOperations();
    this.hotSettings = {
      data: [{empty: ''}],
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
    
    // Clear any existing session storage
    sessionStorage.removeItem('tableState');
    
    // Remove this as we're using chatFlowsManager directly
    // const ChatFlows = require('../utils/ChatFlows').default;
    // this.chatFlows = ChatFlows;
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
    },
    tableFlexBasis() {
      return `calc(100% - ${this.chatWidth}px)`;
    },
    tableWidth() {
      return `calc(100% - ${this.chatWidth}px - 4px)`; // Account for resizer width
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
    window.addEventListener('mousemove', this.handleResize);
    window.addEventListener('mouseup', this.stopResize);

    // Initialize Handsontable after component is mounted
    this.$nextTick(() => {
      if (this.$refs.hotTable) {
        this.hotInstance = this.$refs.hotTable.hotInstance;
      }
    });
  },
  beforeUnmount() {
    // Ensure cleanup when component is destroyed
    if (this.showFlowsOverlay) {
      this.closeFlows();
    }
    this.cleanup();
    this.destroyHandsontable();
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
      
      // Get complete current table state after any change
      if (this.$refs.hotTable?.hotInstance) {
        const currentData = this.$refs.hotTable.hotInstance.getData();
        const currentHeaders = this.gridOperations.getHeaders();
        
        // Save complete state
        const newState = {
          data: JSON.parse(JSON.stringify(currentData)), // Deep copy to prevent reference issues
          headers: [...currentHeaders],
          selectedRows: new Set([...this.gridOperations.getSelectedRows()]),
          changedRows: new Set([...this.gridOperations.getChangedRows()])
        };
        
        // Update grid operations with complete state
        this.gridOperations.updateData(newState.data);
        this.gridOperations.saveState();
      }
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
      this.fileName = file.name; // Set the filename

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
      if (!this.userMessage.trim() || this.loading) return;
      
      // Get 5 random rows from current data
      const sampleData = this.getSampleRows(5);
      
      const userMessage = {
        type: 'user',
        text: this.userMessage,
        timestamp: new Date(),
        sampleData: {
          headers: this.gridOperations.getHeaders(),
          rows: sampleData
        }
      };
      
      this.chatMessages.push(userMessage);
      
      // Record user message if recording is active
      if (this.isRecording) {
        this.chatFlows.recordMessage(userMessage);
      }
      
      this.userMessage = '';
      this.loading = true;
      this.error = null;

      try {
        const selectedRowsData = this.getSelectedRowsData();
        const response = await this.executeAnalysis(userMessage.text, selectedRowsData);
        
        if (response.data.error) {
          // Display the first error
          this.displayError({
            data: {
              error: {
                message: response.data.error.message,
                code: response.data.error.code
              }
            }
          });

          // Attempt retry with error context
          const retryResponse = await this.executeAnalysis(
            userMessage.text,
            selectedRowsData,
            response.data.error
          );

          if (retryResponse.data.error) {
            this.displayError(retryResponse);
          } else {
            await this.handleSuccessResponse(retryResponse);
          }
        } else {
          await this.handleSuccessResponse(response);
          
          // Record bot response if recording is active
          if (this.isRecording) {
            this.chatFlows.recordMessage({
              type: 'bot',
              text: response.data.analysis,
              code: response.data.code,
              plot_html: response.data.plot_html,
              suggestions: response.data.suggestions
            });
          }
        }
      } catch (error) {
        this.handleError(error);
      } finally {
        this.loading = false;
      }
    },

    async executeAnalysis(question, selectedRowsData, previousError = null) {
      const payload = {
        question,
        data: this.gridOperations.getData(),
        selectedRows: selectedRowsData,
        selectedIndices: this.gridOperations.getSelectedRows()
      };

      // If there was a previous error, include it in the payload
      if (previousError) {
        payload.previousError = previousError;
      }

      return await axios.post('/api/analyze', payload);
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
        
        // Record bot message if recording is active
        if (this.isRecording) {
          this.chatFlows.recordMessage(botMessage);
        }
      } catch (error) {
        console.error('Error in handleSuccessResponse:', error);
        this.handleError(error);
      }
    },

    displayError(response) {
      this.chatMessages.push({ 
        type: 'bot', 
        text: 'An error occurred:',
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
      if (this.canUndo) {
        const success = this.gridOperations.undo();
        if (success) {
          const data = this.gridOperations.getData();
          
          // Update Handsontable with previous state
          this.hotSettings = {
            ...this.hotSettings,
            data: data,
            colHeaders: this.gridOperations.getHeaders(),
            columns: this.gridOperations.getColumns()
          };
          
          // Force table refresh
          this.$nextTick(() => {
            if (this.$refs.hotTable?.hotInstance) {
              this.$refs.hotTable.hotInstance.loadData(data);
              this.$refs.hotTable.hotInstance.render();
            }
          });
        }
      }
    },
    
    redo() {
      if (this.canRedo) {
        const success = this.gridOperations.redo();
        if (success) {
          const data = this.gridOperations.getData();
          
          // Update Handsontable with next state
          this.hotSettings = {
            ...this.hotSettings,
            data: data,
            colHeaders: this.gridOperations.getHeaders(),
            columns: this.gridOperations.getColumns()
          };
          
          // Force table refresh
          this.$nextTick(() => {
            if (this.$refs.hotTable?.hotInstance) {
              this.$refs.hotTable.hotInstance.loadData(data);
              this.$refs.hotTable.hotInstance.render();
            }
          });
        }
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
                  //pythonError: error.response.data.error.pythonError,
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
          //pythonError: error.response?.data?.error?.pythonError,
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

    async updateTableData(data) {
      if (this.isDestroyed) return;
      
      // Update Handsontable settings
      this.hotSettings = {
        ...this.hotSettings,
        data: data,
        columns: this.gridOperations.getColumns(),
        colHeaders: this.gridOperations.getHeaders()
      };

      await this.$nextTick();
      if (this.$refs.hotTable?.hotInstance) {
        this.$refs.hotTable.hotInstance.loadData(data);
        this.$refs.hotTable.hotInstance.render();
      }
    },

    startResize(event) {
      this.isDragging = true;
      this.initialX = event.clientX;
      this.initialWidth = this.chatWidth;
    },

    handleResize(event) {
      if (!this.isDragging) return;
      
      const diff = this.initialX - event.clientX;
      const newWidth = Math.min(
        Math.max(this.initialWidth + diff, this.minChatWidth),
        this.maxChatWidth
      );
      
      this.chatWidth = newWidth;
      
      // Force table refresh when resizing
      if (this.$refs.hotTable?.hotInstance) {
        this.$refs.hotTable.hotInstance.render();
      }
    },

    stopResize() {
      this.isDragging = false;
    },

    resetSize() {
      this.chatWidth = 380; // Reset to default width
      if (this.$refs.hotTable?.hotInstance) {
        this.$refs.hotTable.hotInstance.render();
      }
    },

    toggleDebugMode() {
      this.debugMode = !this.debugMode;
    },

    clearData() {
      // Clear grid operations first
      if (this.gridOperations) {
        try {
          // Try clearData first, if not available use reset or fall back to manual clearing
          if (typeof this.gridOperations.clearData === 'function') {
            this.gridOperations.clearData();
          } else if (typeof this.gridOperations.reset === 'function') {
            this.gridOperations.reset();
          } else {
            // Manual fallback
            this.gridOperations.data = [];
            this.gridOperations.headers = [];
            this.gridOperations.columns = [];
            this.gridOperations.selectedRows = [];
          }
        } catch (error) {
          console.warn('Error clearing grid operations:', error);
        }
      }

      // Clear Handsontable data
      if (this.hotSettings) {
        this.hotSettings.data = [];
        this.hotSettings.columns = [];
        this.hotSettings.colHeaders = [];
      }

      // Clear other data
      this.tableData = [];
      this.chatMessages = [];
      this.fileName = '';
    },

    destroyHandsontable() {
      // Remove event listeners
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('mousemove', this.handleResize);
      window.removeEventListener('mouseup', this.stopResize);
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);

      // Save current state before destroying
      const currentData = this.gridOperations.getData();
      const currentHeaders = this.gridOperations.getHeaders();

      // Destroy Handsontable instance
      if (this.$refs.hotTable?.hotInstance) {
        const hot = this.$refs.hotTable.hotInstance;
        if (hot && !hot.isDestroyed) {
          try {
            hot.destroy();
          } catch (error) {
            console.warn('Error destroying Handsontable:', error);
          }
        }
      }

      // Clear data structures
      this.hotSettings.data = [];
      this.hotSettings.columns = [];
      this.hotSettings.colHeaders = [];
      
      // Reset grid operations with saved state
      this.gridOperations = new HandsontableOperations();
      if (currentData.length && currentHeaders.length) {
        this.gridOperations.updateData(currentData);
        this.gridOperations.setHeaders(currentHeaders);
      }

      this.isDestroyed = true;
    },

    cleanup() {
      // Remove event listeners first
      window.removeEventListener('resize', this.onResize);
      window.removeEventListener('mousemove', this.handleResize);
      window.removeEventListener('mouseup', this.stopResize);
      window.removeEventListener('keydown', this.handleKeyDown);
      window.removeEventListener('keyup', this.handleKeyUp);

      // Clear all data
      this.clearData();
      
      // Set destroyed flag
      this.isDestroyed = true;
      
      // Destroy Handsontable instance last
      if (this.$refs.hotTable?.hotInstance) {
        try {
          this.$refs.hotTable.hotInstance.destroy();
        } catch (error) {
          console.warn('Error destroying Handsontable:', error);
        }
      }
    },

    beforeDestroy() {
      this.cleanup();
    },

    destroyed() {
      this.isDestroyed = true;
    },

    captureFlow() {
      const messagesToCapture = this.chatMessages.map(msg => ({
        type: msg.type,
        text: msg.text,
        timestamp: new Date().toISOString(),
        ...(msg.code && { code: msg.code }),
        ...(msg.plot_html && { plot_html: msg.plot_html }),
        ...(msg.suggestions && { suggestions: msg.suggestions }),
        ...(msg.error && { error: msg.error }),
        ...(msg.context && { context: msg.context })
      }));

      const flow = this.chatFlows.captureCurrentFlow(messagesToCapture, this.fileName);
      
      this.chatMessages.push({
        type: 'system',
        text: `Flow captured: ${flow.name}`,
        timestamp: new Date().toISOString()
      });
    },

    toggleFlowRecording() {
      if (this.isRecording) {
        this.chatFlows.stopRecording();
        this.chatMessages.push({
          type: 'system',
          text: 'Flow recording stopped'
        });
      } else {
        this.chatFlows.startRecording(this.fileName);
        this.chatMessages.push({
          type: 'system',
          text: 'Flow recording started'
        });
      }
      this.isRecording = !this.isRecording;
    },

    showFlows() {
      if (this.isClosingOverlay) return;
      this.showFlowsOverlay = true;
    },

    closeFlows() {
      // Stop recording first if active
      if (this.isRecording) {
        this.chatFlows.stopRecording();
        this.isRecording = false;
      }
      
      // Clear any pending timers
      if (this._closeFlowsTimer) {
        clearTimeout(this._closeFlowsTimer);
      }

      // Set flag and update state immediately
      this.isClosingOverlay = true;
      this.showFlowsOverlay = false;

      // Reset flag after a short delay
      this._closeFlowsTimer = setTimeout(() => {
        this.isClosingOverlay = false;
      }, 100);
    },

    viewFlow(flow) {
      if (!flow) return;
      
      // Close overlay first
      this.closeFlows();
      
      // Use nextTick to ensure DOM is updated before modifying messages
      this.$nextTick(() => {
        // Then update messages
        this.chatMessages = flow.messages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        
        if (flow.fileName) {
          this.fileName = flow.fileName;
        }
        
        // Scroll to bottom after messages are updated
        this.$nextTick(() => {
          if (this.$refs.chatMessages) {
            this.$refs.chatMessages.scrollTop = this.$refs.chatMessages.scrollHeight;
          }
        });
      });
    },

    deleteFlow(flowId) {
      if (confirm('Are you sure you want to delete this flow?')) {
        this.chatFlows.deleteFlow(flowId);
      }
    },

    // Add rename flow handler
    handleRenameFlow({ id, name }) {
      this.chatFlows.renameFlow(id, name);
    },

    handleFlowsClose() {
      // Use the closeFlows method to ensure consistent cleanup
      this.closeFlows();
    },

    // Add new method to get random rows
    getSampleRows(count) {
      const data = this.gridOperations.getData();
      const headers = this.gridOperations.getHeaders();
      if (!data.length) return null;
      
      const randomRows = [];
      const totalRows = data.length;
      const indices = new Set();
      
      while (indices.size < Math.min(count, totalRows)) {
        indices.add(Math.floor(Math.random() * totalRows));
      }
      
      Array.from(indices).forEach(index => {
        randomRows.push(data[index]);
      });
      
      return {
        headers,
        rows: randomRows
      };
    },

    async handleFlowStepComplete({ stepIndex, totalSteps, output }) {
      // Update progress in chat
      this.chatMessages.push({
        type: 'system',
        text: `Executing flow step ${stepIndex + 1}/${totalSteps}`
      });

      // If there's data to update, update the grid
      if (output.data) {
        await this.updateTableData(output.data);
      }

      // If there's a plot or analysis, show it
      if (output.plot_html || output.analysis) {
        this.chatMessages.push({
          type: 'bot',
          text: output.analysis || 'Step completed',
          plot_html: output.plot_html
        });
      }
    },

    async handleFlowComplete({ success, data, error }) {
      if (success) {
        // Final data update if needed
        if (data) {
          await this.updateTableData(data);
        }
        
        this.chatMessages.push({
          type: 'system',
          text: 'Flow execution completed successfully'
        });
      } else {
        this.chatMessages.push({
          type: 'system',
          text: `Flow execution failed: ${error}`,
          error: true
        });
      }
    },
  },

  // Add watcher for showFlowsOverlay
  watch: {
    showFlowsOverlay(newVal) {
      if (!newVal) {
        // Use nextTick to ensure DOM is updated
        this.$nextTick(() => {
          if (this.isRecording) {
            this.chatFlows.stopRecording();
            this.isRecording = false;
          }
        });
      }
    }
  },

  // Add beforeRouteLeave navigation guard
  beforeRouteLeave(to, from, next) {
    // Save state before leaving
    const savedState = {
      data: this.gridOperations.getData(),
      headers: this.gridOperations.getHeaders()
    };
    
    this.cleanup();
    
    // Store state for potential recovery
    if (to.name === 'analysis-board') {
      sessionStorage.setItem('tableState', JSON.stringify(savedState));
    }
    
    next();
  }
}
</script>

<style scoped>
.data-container {
  display: flex;
  position: relative;
  height: 100%;
  overflow: hidden;
}

.excel-toolbar {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  padding: 3px 12px; /* Reduced padding */
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  gap: 16px;
  height: 30px; /* Reduced from 40px to 30px (25% reduction) */
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-input {
  display: none;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #666;
  font-size: 12px; /* Smaller filename text */
  padding: 0 6px;
}

.toolbar-separator {
  width: 1px;
  height: 20px; /* Reduced separator height */
  background: #ddd;
  margin: 0 4px;
}

.toolbar-btn {
  height: 24px; /* Reduced button height */
  padding: 0 8px;
  font-size: 12px; /* Slightly smaller font */
  min-width: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid #ddd;
  background: white;
  color: #444;
  cursor: pointer;
  transition: all 0.2s;
}

.toolbar-btn.icon-only {
  width: 24px;
  padding: 0;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toolbar-center, .toolbar-right {
  display: flex;
  gap: 4px;
}

.toolbar-btn.primary {
  background: #007bff;
  color: white;
  border-color: #0056b3;
}

.toolbar-btn.primary:hover:not(:disabled) {
  background: #0056b3;
}

.file-input {
  display: none;
}

/* Fix text input color */
.chat-input-container textarea {
  color: #333;
  background: white;
}

/* Remove unnecessary scrollbar */
#app {
  overflow-y: hidden;
}

.scrollable-content {
  overflow-y: auto;
  height: 100%;
}

.resizer {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  position: relative;
  z-index: 10;
  margin: 0 2px;

  &:hover .resizer-line,
  &.is-dragging .resizer-line {
    background: rgba(0, 127, 212, 0.4);
  }
}

.resizer-line {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 100%;
  background: #ddd;
  transition: background-color 0.2s;
}

.grid-wrapper {
  flex: 1;
  position: relative;
  border: 1px solid #ddd;
  height: calc(100% - 48px);
  overflow: hidden;
  background: white;
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
  background: white !important;
  
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
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
  display: grid;
 grid-template-columns: auto 1fr auto;
  align-items: center;
  padding: 8px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  gap: 24px;
  height:40px
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* Add this new style for the black line */
.excel-toolbar::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: -12.5vw; /* Extend beyond the toolbar width */
  right: -12.5vw; /* Extend beyond the toolbar width */
  height: 1px;
  background-color: #000000;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.toolbar-center {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-left: 30px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
  margin-right: 10px;
}

.toolbar-btn, 
.primary,
.toolbar-right button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  color: #444;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  height: 36px;
  white-space: nowrap;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.toolbar-btn:hover:not(:disabled),
.primary:hover:not(:disabled),
.toolbar-right button:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #d0d0d0;
  transform: translateY(-1px);
}

.toolbar-btn:disabled,
.primary:disabled,
.toolbar-right button:disabled {
  background: #f5f5f5;
  color: #999;
  cursor: not-allowed;
  border-color: #e0e0e0;
}

.upload-row {
  display: flex;
  align-items: center;
}

/* Style file input */
.file-upload input[type="file"] {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.file-upload input[type="file"]::-webkit-file-upload-button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #f5f5f5;
  color: #444;
  font-weight: 500;
  margin-right: 8px;
  cursor: pointer;
}

.chat-container {
  background: #f8f9fa;
  border-radius: 0; /* Remove rounded corners */
  display: flex;
  flex: 1;
  flex-direction: column;
  height: calc(100% - 48px);
  border: 1px solid #ddd;
  text-align: left;
  overflow: hidden;
  margin: 0;
  padding: 0;
}

.chat-container h3 {
  margin: 0;
  padding: 15px 15px 10px 15px;  /* Reduce bottom padding */
  color: #000000;
  font-weight: 600;
  border-bottom: none;  /* Remove the border */
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
  margin: 0;
  margin-bottom: 15px;
  
  /* Add custom scrollbar for chat messages only */
  &::-webkit-scrollbar {
    width: 8px;
  }
  
  &::-webkit-scrollbar-track {
    background: #f1f1f1;
  }
  
  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  
  &::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
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
  padding: 12px;
  margin: 8px 0;
  border-radius: 8px;
  background: #f8f9fa;
  color: #212529; /* Set default text color to black */
}

.message.system {
  background: #e9ecef;
  color: #212529; /* Ensure system messages are black */
}

.message.error {
  background: #fff3f3;
  color: #dc3545; /* Keep error messages red */
}

.message.success {
  background: #f0fff4;
  color: #28a745; /* Keep success messages green */
}

.message.user {
  background: #1565c0;
  color: white;
  align-self: flex-end;
  max-width: 85%;
  border-radius: 18px 18px 4px 18px;
}

.message.bot {
  background: #ffffff;
  color: #000000;
  align-self: flex-start;
  width: 100%;
  max-width: 100%;
  border-radius: 18px 18px 18px 4px;
  border: 1px solid #e0e0e0;
}

.chat-input-container {
  position: sticky;
  bottom: 0;
  background: white;
  padding: 16px;
  padding-bottom: 12px;
  border-top: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: auto;
}

.input-group {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.controls-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
}

textarea {
  flex: 1;
  min-height: 44px;
  max-height: 120px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  resize: vertical;
  font-size: 14px;
  line-height: 1.4;
}

.send-button {
  width: 44px;
  height: 44px;
  padding: 0;
  border: none;
  border-radius: 8px;
  background: #1565c0; /* Match usermessage color */
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.send-button:hover:not(:disabled) {
  background: #0d47a1;
}

.send-button:disabled {
  background: #ccc;
}

.toggle-switch {
  width: 40px; /* Slightly smaller */
  height: 22px; /* Slightly smaller */
}

.slider {
  background-color: #e0e0e0;
}

.toggle-switch input:checked + .slider {
  background-color: #1565c0; /* Match theme */
}

.debug-label {
  font-size: 9px; /* Smaller text */
  color: #666;
  margin-top: 1px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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
  width: calc(100% - 16px);
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
.table-section {
  flex: 1;
  min-width: 0;
  position: relative;
  
  :deep(.handsontable) {
    scrollbar-width: thin;
    scrollbar-color: #c1c1c1 #f1f1f1;
    
    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }
    
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }
  }
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
  padding: 8px;
  background: #f5f5f5;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.code-label {
  font-weight: 500;
  color: #333;
}

.toggle-icon {
  transition: transform 0.2s ease;
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
  background: #e2e3e5; /* Darker background */
  border-bottom: 2px solid #6e757c;
}

/* Improve button contrast */
.toolbar-btn:disabled {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.5);
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
  flex-direction: column;
  gap: 12px;
}

.input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
}

.debug-controls {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
  cursor: pointer;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

.toggle-switch input:checked + .slider {
  background-color: #0078d4;
}

.toggle-switch input:checked + .slider:before {
  transform: translateX(26px);
}

.toggle-switch input:checked + .slider i {
  color: white;
}

.slider i {
  color: #666;
  font-size: 12px;
  transition: .4s;
}

.debug-label {
  margin-left: 8px;
  font-size: 10px;
  color: #666;
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

.resizer {
  width: 8px;
  cursor: col-resize;
  position: absolute;
  left: -4px;
  top: 0;
  bottom: 0;
  z-index: 10;
  touch-action: none;
}

.resizer-line {
  position: absolute;
  left: 3px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ddd;
  transition: background-color 0.2s;
}

.resizer:hover .resizer-line {
  background: #999;
}

.code-block-container {
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.code-block-wrapper {
  height: 300px;
  width: 100%;
}

.code-editor {
  height: 100%;
  width: 100%;
}

.code-header {
  padding: 8px;
  background: #f5f5f5;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.code-label {
  font-weight: 500;
  color: #333;
}

.toggle-icon {
  transition: transform 0.2s ease;
}

.toggle-icon.expanded {
  transform: rotate(180deg);
}

.debug-toggle {
  padding: 12px;
  background: #333;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.debug-toggle.active {
  background: #0078d4;
}

.chat-controls {
  display: flex;
  gap: 8px;
  margin-left: 8px;
}

.chat-input-container {
  display: flex;
  padding: 16px;
  border-top: 1px solid #ddd;
  background: white;
  align-items: flex-start;
  margin: 0;
}

.debug-toggle {
  padding: 12px;
  background: #333;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.debug-toggle.active {
  background: #0078d4;
}

.debug-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
}

.debug-switch {
  position: relative;
  display: inline-block;
  width: 50px;
  height: 24px;
}

.debug-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.input-wrapper {
  display: flex;
  gap: 8px;
  width: 100%;
}

.debug-controls {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

.debug-label {
  font-size: 10px;
  color: #666;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #333;
  transition: .4s;
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.slider i {
  color: #666;
  transition: .4s;
}

.debug-switch input:checked + .slider {
  background-color: #0078d4;
}

.debug-switch input:checked + .slider i {
  color: #fff;
}

.debug-switch input:focus + .slider {
  box-shadow: 0 0 0 2px #0078d4;
}

.debug-switch input:checked + .slider {
  background-color: #0078d4;
}

.debug-switch input:checked + .slider i {
  color: #fff;
}

.debug-switch input:focus + .slider {
  box-shadow: 0 0 0 2px #0078d4;
}

.debug-label {
  font-weight: 500;
  color: #333;
}

.input-row {
  display: flex;
  width: 100%;
  gap: 8px;
}

.debug-toggle-wrapper {
  margin-top: 8px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 100%;
  gap: 8px;
}

/* Add these styles */
.file-name-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  color: #666;
  font-size: 0.9em;
}

.toolbar-btn {
  background: white;
  border: 1px solid #ddd;
  color: #333;
  padding: 8px 16px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #ccc;
}

.toolbar-btn:disabled {
  background: #f5f5f5;
  border-color: #ddd;
  color: #999;
  cursor: not-allowed;
}

.chat-section {
  position: relative;
  min-width: 280px;
  max-width: 800px;
}

/* Add this new class */
.table-background {
  background: white;
  height: 100%;
  width: 100%;
}

.flow-controls {
  display: flex;
  padding: 0 8px 4px 8px;  /* Remove top padding */
  gap: 0;
  margin-top: -4px;  /* Move buttons closer to AI Assistant */
}

.flow-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  background: white;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.8rem;
  height: 24px;  /* Slightly reduce height */
  margin: 0;
}

/* Remove border radius for middle button */
.flow-btn:not(:first-child):not(:last-child) {
  border-radius: 0;
  border-left: none;
  border-right: none;
}

/* Add border radius only to first and last buttons */
.flow-btn:first-child {
  border-radius: 4px 0 0 4px;
}

.flow-btn:last-child {
  border-radius: 0 4px 4px 0;
}

.flow-btn.recording {
  background: #ff4444;
  color: white;
  border-color: #cc0000;
}

.flow-btn:hover {
  background: #f5f5f5;
}

.flow-btn.recording:hover {
  background: #cc0000;
}

.close-btn:hover {
  background: #f5f5f5;
}
</style>
