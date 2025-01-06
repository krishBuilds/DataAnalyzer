<template>
  <div class="dashboard-container">
    <div class="content-wrapper">
      <!-- Left Column: Generator Form -->
      <div class="generator-column">
        <div class="dashboard-generator">
          <h2>Dashboard Generator</h2>
          <div class="generator-form">
            <!-- Data Source Section -->
            <div class="form-section data-source-row">
              <h3>Data Source</h3>
              <div class="file-upload">
                <input type="file" id="file-input" @change="handleFileSelect" accept=".csv,.json,.xlsx">
                <label for="file-input" class="file-label">
                  <i class="fas fa-cloud-upload-alt"></i>
                  {{ config.file ? config.file.name : 'Choose a file' }}
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
                <label class="toggle">
                  <input type="checkbox" v-model="config.generateInsights">
                  <span class="slider"></span>
                </label>
                <span class="toggle-label">Generate Insights</span>
              </div>
              <button 
                class="generate-btn" 
                @click="generateDashboard" 
                :disabled="isAnalyzing || !config.file"
              >
                {{ isAnalyzing ? 'Generating...' : 'Generate Dashboard' }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Dashboard Display -->
      <div class="dashboard-column">
        <!-- Loading State -->
        <div v-if="isAnalyzing" class="loading-state">
          <div class="loader"></div>
          <span>Generating dashboard, please wait...</span>
        </div>

        <!-- Dashboard Display -->
        <div v-if="dashboardComponents.length && !isAnalyzing" class="dashboard-display">
          <div class="dashboard-header">
            <h2>Generated Dashboard</h2>
          </div>
          <div class="gridstack-wrapper">
            <div class="grid-stack"></div>
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
//import _ from 'lodash';

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
      analysisError: null,
      dashboardComponents: [],
      grid: null,
    }
  },
  mounted() {
    this.initializeGridStack();
  },
  methods: {
    async handleFileSelect(event) {
      const file = event.target.files[0];
      if (!file) return;

      this.isAnalyzing = true;
      this.analysisError = null;
      this.config.file = file;

      try {
        const data = await this.readFile(file);
        if (!data || !data.length) {
          throw new Error('No data found in file');
        }

        this.processedData = data;

        // Send data to backend for initial analysis
        const analysisResponse = await axios.post('/api/dashboard/analyze', {
          data: this.processedData,
          config: {
            analysisLevel: this.config.analysisLevel
          }
        });

        if (analysisResponse.data.error) {
          throw new Error(analysisResponse.data.error);
        }

        // Store both formatted analysis and raw analysis data
        this.basicAnalysis = {
          text: analysisResponse.data.analysis,
          raw: analysisResponse.data.rawAnalysis
        };

      } catch (error) {
        this.analysisError = error.message || 'Error processing file';
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
              handle: '.chart-title',
              scroll: true
            },
            resizable: {
              handles: 'all',
              autoHide: true
            },
            disableOneColumnMode: true,
            margin: 10
          });
        }
      });
    },

    createChartWidget(component, index) {
      const widgetContainer = document.createElement('div');
      widgetContainer.className = 'grid-stack-item';
      widgetContainer.innerHTML = `
        <div class="grid-stack-item-content">
          <div class="chart-title">${component.description}</div>
          <div id="chart-container-${index}" class="chart-container"></div>
        </div>
      `;

      // Add widget to grid with size configuration
      const gridItem = this.grid.addWidget({
        w: 6,
        h: 6,
        el: widgetContainer
      });

      // Store reference to container for resizing
      gridItem.plotContainer = widgetContainer.querySelector('.chart-container');

      return gridItem;
    },

    renderCharts() {
      this.$nextTick(() => {
        // Ensure grid is initialized
        if (!this.grid) {
          this.initializeGridStack();
        }

        // Wait for grid initialization
        setTimeout(() => {
          if (this.grid) {
            // Clear existing widgets
            this.grid.removeAll();

            // Create and add new widgets
            this.dashboardComponents.forEach((component, index) => {
              const gridItem = this.createChartWidget(component, index);

              // Configure and render Plotly chart
              const container = gridItem.plotContainer;
              const defaultLayout = {
                margin: { t: 25, r: 10, l: 60, b: 40 },
                autosize: true,
                showlegend: true,
                legend: {
                  orientation: 'h',
                  y: -0.15
                },
                paper_bgcolor: 'white',
                plot_bgcolor: 'white',
                font: {
                  color: '#2c3e50',
                  family: 'Arial, sans-serif'
                },
                modebar: {
                  activecolor: '#3b82f6'
                }
              };

              const defaultConfig = {
                responsive: true,
                useResizeHandler: true,
                displayModeBar: 'hover',
                editable: true,
                editSelection: true,
                displaylogo: false,
                modeBarButtonsToAdd: [
                  'drawline',
                  'drawopenpath',
                  'eraseshape',
                  'editInChartStudio'
                ],
                modeBarButtonsToRemove: ['lasso2d'],
                toImageButtonOptions: {
                  format: 'png',
                  filename: 'chart',
                  height: 500,
                  width: 700,
                  scale: 2
                }
              };

              Plotly.newPlot(
                container,
                component.content.data,
                { ...defaultLayout, ...component.content.layout },
                defaultConfig
              );
            });
          }
        }, 100);
      });
    },

    async generateDashboard() {
      if (!this.processedData || !this.basicAnalysis) {
        this.analysisError = 'Please upload data and wait for analysis to complete';
        return;
      }

      this.isAnalyzing = true; // Show loading state
      this.analysisError = null;

      try {
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

      } catch (error) {
        this.analysisError = error.response?.data?.error || 'Error generating dashboard';
        console.error('Dashboard generation error:', error);
      } finally {
        this.isAnalyzing = false; // Hide loading state
      }
    },
  }
}
</script>

<style scoped>
.dashboard-container {
  height: 100vh;
  background: #f5f5f5;
  overflow: hidden;
}

.content-wrapper {
  display: flex;
  height: 100%;
  gap: 20px;
  padding: 20px;
}

.generator-column {
  flex: 0 0 350px;
  overflow-y: auto;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  padding: 16px;
}

.dashboard-column {
  flex: 1;
  overflow: hidden;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
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
  display: block;
  padding: 10px;
  background: #f1f5f9;
  border: 2px dashed #cbd5e1;
  border-radius: 6px;
  text-align: center;
  cursor: pointer;
  font-size: 0.9em;
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
  height: 90vh;
  overflow-y: auto;
  margin: 0 auto;
  background: #f5f5f5;
  padding: 20px;
}

.grid-stack {
  background: #f5f5f5;
}

.grid-stack-item-content {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 15px;
  overflow: hidden;
}

.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #1a202c;
  padding: 8px;
  margin: -12px -12px 12px -12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  cursor: move;
}

.chart-container {
  width: 100%;
  height: calc(100% - 30px);
}

/* Resize handle styling */
.ui-resizable-handle {
  background: #64748b;
  border-radius: 2px;
}

.ui-resizable-se {
  width: 12px;
  height: 12px;
  right: -5px;
  bottom: -5px;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 20px;
  color: #4a5568;
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
</style> 