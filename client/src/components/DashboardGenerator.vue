<template>
  <div class="dashboard-container">
    <!-- Main Dashboard Area -->
    <div class="dashboard-area" :class="{ 'expanded': !showGenerator }">
      <!-- Dashboard Display -->
      <div class="dashboard-column">
        <!-- Loading State -->
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

        <!-- Additional Analyses (Non-Plotly) -->
        <div v-if="nonPlotlyAnalyses.length && !isGenerating" class="analysis-section">
          <h3>Additional Analyses</h3>
          <div
            class="analysis-block"
            v-for="(analysis, i) in nonPlotlyAnalyses"
            :key="i"
          >
            <h4>{{ analysis.title }}</h4>
            <p>{{ analysis.content }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Generator Panel -->
    <div class="generator-panel" :class="{ 'hidden': !showGenerator }">
      <div class="panel-toggle" @click="toggleGenerator">
        <i :class="['fas', showGenerator ? 'fa-chevron-left' : 'fa-chevron-right']"></i>
      </div>
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
                    placeholder="Describe your preferred theme (e.g., light theme with green accents)"
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
                  <span v-if="!isGenerating">Generate Dashboard</span>
                  <div v-else class="loading-spinner">
                    <div class="spinner"></div>
                    <span>Generating...</span>
                  </div>
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
      nonPlotlyAnalyses: [], /* to store additional textual/numeric analyses not rendered on Plotly */
      grid: null,
      showGenerator: true,
      dashboardHeader: 'My Dashboard',
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
  async beforeMount() {
    try {
      // Clean up any existing Handsontable instances
      const hotInstances = document.querySelectorAll('.handsontable');
      for (const instance of hotInstances) {
        if (instance.__handsontable) {
          try {
            const hot = instance.__handsontable;
            // Remove all hooks
            hot.removeHook('afterChange');
            hot.removeHook('afterSelection');
            hot.removeHook('afterDeselect');
            hot.removeHook('afterRender');
            // Destroy instance
            hot.destroy();
            // Clear reference
            instance.__handsontable = null;
          } catch (error) {
            console.warn('Error cleaning up Handsontable instance:', error);
          }
        }
      }

      // Clear any remaining Handsontable global references
      if (window.Handsontable) {
        window.Handsontable.hooks.clear();
      }

      // Wait for cleanup to complete
      await this.$nextTick();
    } catch (error) {
      console.error('Error in beforeMount cleanup:', error);
    }
  },
  mounted() {
    // Initialize only after ensuring cleanup
    this.$nextTick(() => {
      this.initializeGridStack();
      window.addEventListener('resize', this.handleResize);
    });
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

            if (!data || !data.length) {
              throw new Error('No data found in file');
            }

            // Ensure consistent row structure
            const headers = Object.keys(data[0]);
            data = data.filter(row => Object.keys(row).length === headers.length);

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
              handles: 'all'
            },
            margin: 5
          });

          this.grid.on('resizestop', (event, element) => {
            if (element.plotContainer && document.body.contains(element.plotContainer)) {
              Plotly.Plots.resize(element.plotContainer);
            }
          });
        }
      });
    },

    createChartWidget(component, index) {
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'grid-stack-item';
      // Add title section above the chart
      widgetContainer.innerHTML = `
        <div class="grid-stack-item-content">
          <div class="chart-title">${component.title || ''}</div>
          <div id="chart-container-${index}" class="chart-container"></div>
        </div>
      `;

      const gridItem = this.grid.addWidget({
        w: component.size?.w || 6,
        h: component.size?.h || 6,
        autoPosition: true,
        el: widgetContainer,
        minW: 3,
        minH: 4
      });

      const container = widgetContainer.querySelector('.chart-container');

      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          if (entry.target === widgetContainer && gridItem.plotContainer) {
            if (document.body.contains(gridItem.plotContainer)) {
              const layout = {
                ...component.content?.layout,
                autosize: true,
                width: entry.contentRect.width,
                height: entry.contentRect.height - 40
              };
              Plotly.relayout(gridItem.plotContainer, layout);
            }
          }
        }
      });
      
      resizeObserver.observe(widgetContainer);
      gridItem.resizeObserver = resizeObserver;
      gridItem.plotContainer = container;

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

              const layout = {
                autosize: true,
                showlegend: false,
                title: component.title,
                ...component.content?.layout,
                width: container.clientWidth,
                height: container.clientHeight
              };

              Plotly.newPlot(
                container,
                component.content.data,
                layout,
                {
                  responsive: true,
                  useResizeHandler: true,
                  autosize: true,
                  resize: true,
                  editable: true
                }
              ).then(() => {
                // Only resize if it's still in DOM
                if (document.body.contains(container)) {
                  Plotly.Plots.resize(container);
                }
              });
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
        // Cleanup from previous generation
        if (this.grid) {
          const items = this.grid.getGridItems();
          items.forEach(item => {
            if (item.plotContainer) {
              try {
                Plotly.purge(item.plotContainer);
              } catch (e) {
                console.warn('Error purging Plotly:', e);
              }
            }
            if (item.resizeObserver) {
              item.resizeObserver.disconnect();
            }
          });
          this.grid.removeAll();
        }
        this.dashboardComponents = [];
        this.nonPlotlyAnalyses = [];

        // 1. Get chart suggestions
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

        // 2. Generate final chart objects + any textual analyses
        const dashboardResponse = await axios.post('/api/dashboard/generate-visualizations', {
          data: this.processedData,
          suggestions: suggestionsResponse.data.suggestions,
          analysis: this.basicAnalysis.raw,
          config: this.config
        });

        this.dashboardComponents = dashboardResponse.data.components;
        // If the server returns additional textual/numeric analysis, capture it here:
        this.nonPlotlyAnalyses = dashboardResponse.data.nonPlotlyAnalyses || [];

        this.renderCharts();

        // Optionally auto-hide generator panel
        this.showGenerator = false;
      } catch (error) {
        this.analysisError = error.response?.data?.error || 'Error generating dashboard';
        console.error('Dashboard generation error:', error);
      } finally {
        this.isGenerating = false;
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
  display: flex;
}

.dashboard-area {
  flex: 1;
  height: 100vh;
  padding: 20px;
  background: #f5f5f5;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.dashboard-area.expanded {
  margin-left: 0;
}

/* Generator Panel: White background, toggle on left, and softened green theme. */
.generator-panel {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 350px;
  background: #ffffff;
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
  background: #ffffff;
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

.generator-scroll-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  /* Soft green scrollbar color */
  scrollbar-color: #bbf7d0 #f5f5f5;
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
  background: #f1fdf4; /* subtle green tint */
  border-color: #bbf7d0;
}

.file-label.analyzing {
  background: #e2e8f0;
  border-color: #94a3b8;
  cursor: wait;
  color: #4a5568;
}

.file-label i {
  color: #10b981; /* changed from the original blue to green */
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
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.generate-btn {
  width: 80%;
  max-width: 300px;
  height: 48px;
  background: #10b981; /* green button */
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.generate-btn:hover:not(:disabled) {
  background: #059669; /* darker green on hover */
  transform: translateY(-1px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.generate-btn:disabled {
  background: #94a3b8;
  cursor: not-allowed;
  opacity: 0.7;
}

.gridstack-wrapper {
  overflow-y: auto;
  height: 90vh;
  position: relative;
  width: 100%;
  margin: 0 auto;
}

.grid-stack {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 100%;
}

/* Plotly tile appearance */
.grid-stack-item-content {
  position: relative;
  height: 100%;
  width: 100%;
  background: #ffffff;
  border-radius: 12px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
              0 2px 4px -1px rgba(0, 0, 0, 0.06);
  padding: 5px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.3s ease;
}

.grid-stack-item-content:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
              0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Make sure the chart fills the tile, and remove scrollbars from Plotly content. */
.chart-container {
  flex: 1;
  height: 100%;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden; /* Removes the scrollbar within each plot */
}

.grid-stack > .grid-stack-item > .grid-stack-item-content {
  border: 1px solid rgba(0, 0, 0, 0.05);
}

/* Loading State */
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
  width: 40px;
  height: 40px;
  border: 4px solid #e2e8f0;
  /* Using green highlight for loader top border */
  border-top: 4px solid #10b981;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.optional-tag {
  font-size: 0.8em;
  background: #f1fdf4;
  color: #059669;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
}

/* Additional Analyses Section */
.analysis-section {
  margin-top: 30px;
  background: #fff;
  border: 1px solid #e2e8f0;
  padding: 16px;
  border-radius: 8px;
}

.analysis-section h3 {
  margin-bottom: 16px;
  color: #2d3748;
  font-weight: 600;
}

.analysis-block {
  margin-bottom: 12px;
}

.analysis-block h4 {
  color: #10b981;
  font-weight: 600;
  margin-bottom: 4px;
}

.analysis-block p {
  color: #4b5563;
  margin-bottom: 8px;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .generator-column {
    width: 100%;
  }
}

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
  background-color: #10b981;
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

.action-row {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px 0;
  width: 100%;
}

/* Loading Spinner inside the generate button */
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.grid-stack {
  min-height: 100%;
}

::v-deep .grid-stack-item-content {
  border-radius: 12px;
  background: #fff;
  transition: box-shadow 0.3s ease;
}
::v-deep .grid-stack-item-content:hover {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
              0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
  padding: 8px 8px 12px 8px;
  background: #ffffff;
}

.chart-container {
  flex: 1;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
}

/* Only show bottom-right resize handle */
::v-deep .ui-resizable-handle {
  display: none !important;
}

::v-deep .ui-resizable-se {
  display: block !important;
  width: 14px;
  height: 14px;
  right: 5px;
  bottom: 5px;
  background-color: #cbd5e1;
  border-radius: 2px;
  cursor: se-resize;
}

/* Apply the same scrollbar style to the grid container */
.grid-wrapper {
  scrollbar-width: thin;
  scrollbar-color: #c1c1c1 #f1f1f1;

  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
    border: 2px solid #f1f1f1;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }

  &::-webkit-scrollbar-corner {
    background: #f1f1f1;
  }
}
</style> 