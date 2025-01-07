<template>
  <div class="dashboard-container">
    <!-- Main Dashboard Area -->
    <div class="dashboard-area" :class="{ 'expanded': !showGenerator }">
      <!-- Dashboard Display -->
      <div class="dashboard-column">
        <!-- Loading State - Only show when generating dashboard -->
        <div v-if="isGenerating" class="loading-state">
          <div class="loader"></div>
          <span>Generating dashboard, please wait...</span>
        </div>

        <!-- Dashboard Display -->
        <div v-if="dashboardComponents.length && !isGenerating" class="dashboard-display">
          <div class="dashboard-header">
            <h2 class="dashboard-title">{{ dashboardHeader }}</h2>
          </div>
          <div class="gridstack-wrapper">
            <div class="grid-stack"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Generator Panel -->
    <div class="generator-panel" :class="{ 'hidden': !showGenerator }">
      <div class="panel-toggle" @click="toggleGenerator">
        <i :class="['fas', showGenerator ? 'fa-chevron-left' : 'fa-chevron-right']"></i>
      </div>
      <!-- Wrap generator content in a scrollable container -->
      <div class="generator-scroll-container">
        <div class="generator-column">
          <div class="dashboard-generator">
            <h2>Dashboard Generator</h2>
            <div class="generator-form">
              <!-- Data Source Section -->
              <div class="form-section data-source-row">
                <h3>Data Source</h3>
                <div class="file-upload">
                  <input 
                    type="file" 
                    id="file-input" 
                    @change="handleFileSelect" 
                    accept=".csv,.json,.xlsx"
                    style="display: none;"
                  >
                  <label for="file-input" class="file-label" :class="{ 'analyzing': isAnalyzing }">
                    <i :class="['fas', isAnalyzing ? 'fa-spinner fa-spin' : 'fa-cloud-upload-alt']"></i>
                    {{ getFileButtonText }}
                  </label>
                </div>
              </div>

              <!-- Visualization Description -->
              <div class="form-section">
                <h3>Visualization Description</h3>
                <div class="text-input-group">
                  <textarea 
                    v-model="config.visualizationDesc"
                    placeholder="What kind of diagrams do you want? (e.g., line chart for sales over time)"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <!-- Analysis Level -->
              <div class="form-section">
                <h3>Analysis Level</h3>
                <div class="analysis-level-buttons">
                  <button 
                    v-for="level in ['Basic', 'Intermediate', 'Advanced']" 
                    :key="level"
                    :class="['level-btn', { active: config.analysisLevel === level.toLowerCase() }]"
                    @click="config.analysisLevel = level.toLowerCase()"
                  >
                    {{ level }}
                  </button>
                </div>
              </div>

              <!-- Theme Customization -->
              <div class="form-section">
                <h3>Theme <span class="optional-tag">Optional</span></h3>
                <div class="text-input-group">
                  <textarea 
                    v-model="config.themeDesc"
                    placeholder="Describe your preferred theme (e.g., light theme with blue accents)"
                    rows="2"
                  ></textarea>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="action-row">
                <div class="insights-toggle">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="config.generateInsights">
                    <span class="toggle-slider"></span>
                    <span class="toggle-label">Generate Insights</span>
                  </label>
                </div>
                <button 
                  class="generate-btn" 
                  @click="generateDashboard" 
                  :disabled="!canGenerateDashboard"
                >
                  {{ isGenerating ? 'Generating...' : 'Generate Dashboard' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import * as XLSX from 'xlsx';
import 'gridstack/dist/gridstack.min.css';
import { GridStack } from 'gridstack';
import Plotly from 'plotly.js-dist';
import { debounce } from 'lodash';

export default {
  name: 'DashboardGenerator',
  data() {
    return {
      config: {
        file: null,
        visualizationDesc: '',
        analysisLevel: 'basic',
        themeDesc: '',
        generateInsights: false
      },
      processedData: null,
      basicAnalysis: null,
      isAnalyzing: false,
      isGenerating: false,
      analysisComplete: false,
      dashboardComponents: [],
      grid: null,
      showGenerator: true,
    }
  },
  computed: {
    getFileButtonText() {
      if (this.isAnalyzing) return 'Analyzing data...'
      if (this.config.file) return this.config.file.name
      return 'Choose a file'
    },
    canGenerateDashboard() {
      return this.config.file && 
             this.analysisComplete && 
             !this.isGenerating && 
             !this.isAnalyzing
    }
  },
  mounted() {
    this.initializeGridStack();
    window.addEventListener('resize', this.handleResize);
  },
  beforeUnmount() {
    // Clean up resize observers
    if (this.grid) {
      const items = this.grid.getGridItems();
      items.forEach(item => {
        if (item.resizeObserver) {
          item.resizeObserver.disconnect();
        }
      });
    }
    window.removeEventListener('resize', this.handleResize);
  },
  methods: {
    async handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.config.file = file;
      this.analysisComplete = false;
      this.isAnalyzing = true;

      try {
        this.processedData = await this.readFile(file);
        await this.performBackgroundAnalysis();
      } catch (error) {
        console.error('File processing error:', error);
        // Show error toast or notification instead of setting error state
      } finally {
        this.isAnalyzing = false;
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
            } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
              // Parse Excel
              const workbook = XLSX.read(e.target.result, { type: 'binary' });
              data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            } else {
              throw new Error('Unsupported file format. Please use CSV or Excel files.');
            }

            // Validate data structure
            if (!data || !data.length) {
              throw new Error('No data found in file');
            }

            // Ensure all rows have the same structure
            const headers = Object.keys(data[0]);
            data = data.filter(row => {
              return Object.keys(row).length === headers.length;
            });

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

    initializeGridStack() {
      this.$nextTick(() => {
        const gridElement = document.querySelector('.grid-stack');
        if (gridElement) {
          this.grid = GridStack.init({
            column: 12,
            cellHeight: 50,
            float: true,
            animate: true,
            minRow: 1,
            draggable: {
              scroll: true,
              handle: '.grid-stack-item-content'
            },
            resizable: {
              handles: 'all',
              autoHide: false
            },
            disableOneColumnMode: true,
            margin: 8
          });
        }
      });
    },

    createChartWidget(component, index) {
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'grid-stack-item';
      widgetContainer.innerHTML = `
        <div class="grid-stack-item-content">
          <div id="chart-container-${index}" class="chart-container"></div>
        </div>
      `;

      // Add widget to grid with default size
      const gridItem = this.grid.addWidget({
        w: 6,
        h: 6,
        autoPosition: true,
        el: widgetContainer
      });

      const container = widgetContainer.querySelector('.chart-container');
      gridItem.plotContainer = container;

      // Wait for container to be mounted before adding resize observer
      this.$nextTick(() => {
        // Only add resize observer if container is mounted
        if (container && document.body.contains(container)) {
          const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
              if (entry.target === container && document.body.contains(container)) {
                try {
                  Plotly.Plots.resize(container);
                } catch (error) {
                  console.warn('Resize error:', error);
                }
              }
            }
          });

          resizeObserver.observe(container);
          // Store observer reference for cleanup
          gridItem.resizeObserver = resizeObserver;
        }
      });

      return gridItem;
    },

    renderCharts() {
      this.$nextTick(() => {
        if (!this.grid) {
          this.initializeGridStack();
        }

        setTimeout(() => {
          if (this.grid) {
            this.grid.removeAll();

            this.dashboardComponents.forEach((component, index) => {
              const gridItem = this.createChartWidget(component, index);
              const container = gridItem.plotContainer;

              const defaultLayout = {
                autosize: true,
                showlegend: true,
                legend: {
                  orientation: 'h',
                  xanchor: 'center',
                  y: -0.15,
                  x: 0.5
                },
                margin: { t: 10, r: 10, l: 40, b: 40 },
                paper_bgcolor: 'white',
                plot_bgcolor: 'white',
                font: {
                  color: '#2c3e50',
                  family: 'Arial, sans-serif'
                }
              };

              const defaultConfig = {
                responsive: true,
                useResizeHandler: true, // Enable auto-resizing
                displayModeBar: 'hover',
                displaylogo: false,
                scrollZoom: false // Disable scroll zoom to prevent conflicts
              };

              // Create the plot
              Plotly.newPlot(
                container,
                component.content.data,
                { ...defaultLayout, ...component.content.layout },
                defaultConfig
              );

              // Store reference for resizing
              gridItem.plotContainer = container;
            });

            // Add resize event listener to grid
            this.grid.on('resizestop', (event, element) => {
              if (element.plotContainer) {
                Plotly.Plots.resize(element.plotContainer);
              }
            });

            // Add resize event listener to grid
            this.grid.on('resize', (event, element) => {
              if (element.plotContainer) {
                requestAnimationFrame(() => {
                  Plotly.Plots.resize(element.plotContainer);
                });
              }
            });
          }
        }, 100);
      });
    },

    async generateDashboard() {
      if (!this.processedData || !this.basicAnalysis) {
        return;
      }

      this.isGenerating = true;
      this.analysisError = null;

      try {
        if (this.grid) {
            // Get all grid items
            const items = this.grid.getGridItems();
            
            // Clean up each item's observers and Plotly instances
            items.forEach(item => {
                if (item.plotContainer) {
                    try {
                        // Remove Plotly instance
                        Plotly.purge(item.plotContainer);
                    } catch (e) {
                        console.warn('Error purging Plotly instance:', e);
                    }
                }
                
                // Disconnect resize observer
                if (item.resizeObserver) {
                    item.resizeObserver.disconnect();
                }
            });

            // Remove all items from grid
            this.grid.removeAll();
        }
        
        // Clear components array
        this.dashboardComponents = [];

        // Get visualization suggestions using the analysis results
        const suggestionsResponse = await axios.post('/api/dashboard/get-suggestions', {
          data: this.processedData,
          headers: Object.keys(this.processedData[0]),
          analysis: this.basicAnalysis.raw,
          config: {
            visualizationDesc: this.config.visualizationDesc,
            analysisLevel: this.config.analysisLevel,
            themeDesc: this.config.themeDesc
          }
        });

        if (!suggestionsResponse.data.suggestions) {
          throw new Error('No visualization suggestions received');
        }

        // Generate visualizations based on suggestions
        const dashboardResponse = await axios.post('/api/dashboard/generate-visualizations', {
          data: this.processedData,
          suggestions: suggestionsResponse.data.suggestions,
          analysis: this.basicAnalysis.raw,
          config: this.config
        });

        // Clear existing dashboard
        if (this.grid) {
          this.grid.removeAll();
        }

        // Store components and create widgets
        this.dashboardComponents = dashboardResponse.data.components;
        this.renderCharts(); // Call to render charts after receiving components

        // Hide generator panel after successful dashboard generation
        this.showGenerator = false;

      } catch (error) {
        this.analysisError = error.response?.data?.error || 'Error generating dashboard';
        console.error('Dashboard generation error:', error);
      } finally {
        this.isGenerating = false; // Hide loading state
      }
    },

    toggleGenerator() {
      this.showGenerator = !this.showGenerator;
    },

    handleResize: debounce(function() {
      if (this.grid && this.dashboardComponents.length) {
        this.renderCharts();
      }
    }, 250),

    async performBackgroundAnalysis() {
      try {
        const analysisResponse = await axios.post('/api/dashboard/analyze', {
          data: this.processedData,
          config: {
            analysisLevel: this.config.analysisLevel
          }
        });

        if (analysisResponse.data.error) {
          throw new Error(analysisResponse.data.error);
        }

        this.basicAnalysis = {
          text: analysisResponse.data.analysis,
          raw: analysisResponse.data.rawAnalysis
        };
        this.analysisComplete = true;
      } catch (error) {
        console.error('Analysis error:', error);
        // Show error toast or notification
      }
    }
  }
}
</script>

<style scoped>
.dashboard-container {
  position: relative;
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.dashboard-area {
  height: auto;
  min-height: 100vh;
  padding: 20px;
  overflow: visible;
}

.dashboard-area.expanded {
  margin-left: 0;
}

.generator-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 350px;
  background: white;
  transition: transform 0.3s ease;
  z-index: 1000;
  box-shadow: 2px 0 8px rgba(0,0,0,0.1);
  display: flex;
  flex-direction: column;
}

.generator-panel.hidden {
  transform: translateX(-100%);
}

.panel-toggle {
  position: absolute;
  right: -30px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 60px;
  background: white;
  border-radius: 0 8px 8px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 2px 0 8px rgba(0,0,0,0.1);
}

.panel-toggle:hover {
  background: #f8fafc;
}

.content-wrapper {
  height: 100%;
  padding: 20px;
}

.generator-column {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.form-section {
  background: #ffffff;
  padding: 15px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  margin-bottom: 16px;
}

h2 {
  color: #1a202c;
  font-size: 1.5em;
  margin-bottom: 20px;
  font-weight: 600;
}

h3 {
  color: #2d3748;
  font-size: 1em;
  margin-bottom: 8px;
  font-weight: 500;
}

.text-input-group textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
  color: #4a5568;
  background: #f8fafc;
  resize: vertical;
}

.text-input-group textarea::placeholder {
  color: #a0aec0;
}

.file-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: #f8fafc;
  border: 2px dashed #cbd5e1;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #1a202c;
  font-weight: 500;
}

.file-label:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.file-label.analyzing {
  background: #e2e8f0;
  border-color: #94a3b8;
  cursor: wait;
  color: #4a5568;
}

.file-label i {
  color: #3b82f6;
}

.file-label.analyzing i {
  color: #4a5568;
}

.analysis-level-buttons {
  display: flex;
  gap: 6px;
}

.level-btn {
  background: #f8fafc;
  color: #4a5568;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s;
}

.level-btn.active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}

.generate-btn {
  background: #3b82f6;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  font-size: 0.9em;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s;
}

.generate-btn:hover {
  background: #2563eb;
}

.generate-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.toggle {
  width: 36px;
  height: 20px;
}

.slider:before {
  height: 16px;
  width: 16px;
}

.gridstack-wrapper {
  height: calc(100vh - 100px);
  padding: 20px;
  background: #f8fafc;
  overflow: auto;
  margin: 0 auto;
}

.grid-stack {
  background: transparent;
  min-height: 100%;
}

.grid-stack-item-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 15px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.grid-stack-item-content:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.chart-container {
  width: 100%;
  height: 100%;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.grid-stack-item-content:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #2c3e50;
}

.chart-controls {
  display: flex;
  gap: 8px;
}

.chart-control-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #64748b;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.chart-control-btn:hover {
  background: #e2e8f0;
  color: #334155;
}

/* Resize handle styling */
.grid-stack > .grid-stack-item > .ui-resizable-handle {
  width: 14px;
  height: 14px;
  background: #64748b;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.2s ease;
}

.grid-stack > .grid-stack-item:hover > .ui-resizable-handle {
  opacity: 0.4;
}

.grid-stack > .grid-stack-item > .ui-resizable-se {
  right: 4px;
  bottom: 4px;
  cursor: se-resize;
}

/* Custom scrollbar */
.gridstack-wrapper::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.gridstack-wrapper::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 8px;
}

.gridstack-wrapper::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 8px;
  border: 2px solid #f1f5f9;
}

.gridstack-wrapper::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.gridstack-wrapper::-webkit-scrollbar-corner {
  background: #f1f5f9;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 16px;
  color: #4b5563;
}

.loader {
  width: 30px;
  height: 30px;
  border: 3px solid #f3f3f3;
  border-top: 3px solid #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.optional-tag {
  font-size: 0.8em;
  background: #f1f5f9;
  color: #64748b;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
}

.generator-column::-webkit-scrollbar,
.dashboard-column::-webkit-scrollbar {
  width: 6px;
}

.generator-column::-webkit-scrollbar-thumb,
.dashboard-column::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}

@media (max-width: 1024px) {
  .content-wrapper {
    flex-direction: column;
  }
  
  .generator-column {
    flex: none;
    width: 100%;
  }
}

/* Custom scrollbar styles for both areas */
.dashboard-area::-webkit-scrollbar,
.generator-column::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.dashboard-area::-webkit-scrollbar-track,
.generator-column::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.dashboard-area::-webkit-scrollbar-thumb,
.generator-column::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.dashboard-area::-webkit-scrollbar-thumb:hover,
.generator-column::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Firefox scrollbar styles */
.dashboard-area,
.generator-column {
  scrollbar-width: thin;
  scrollbar-color: #888 #f1f1f1;
}

.generator-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.generator-column {
  padding: 16px;
}

/* Ensure scrollbar styles are applied */
.generator-scroll-container::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.generator-scroll-container::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

.generator-scroll-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.generator-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #666;
}

/* Firefox scrollbar styles */
.generator-scroll-container {
  scrollbar-width: thin;
  scrollbar-color: #888 #f1f1f1;
}

/* New modern toggle switch styles */
.toggle-switch {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.toggle-slider {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  background-color: #e2e8f0;
  border-radius: 12px;
  transition: .4s;
}

.toggle-switch input:checked + .toggle-slider {
  background-color: #3b82f6;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  border-radius: 50%;
  transition: .4s;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.toggle-switch input:checked + .toggle-slider:before {
  transform: translateX(20px);
}

.toggle-switch input {
  display: none;
}

.toggle-label {
  color: #4b5563;
  font-size: 14px;
  font-weight: 500;
}
</style> 