<template>
  <div class="dashboard-generator">
    <h2>Dashboard Generator</h2>
    
    <!-- Basic Analysis Results
    <div v-if="basicAnalysis" class="form-section">
      <h3>Data Analysis</h3>
      <div class="analysis-results">
        <pre v-html="basicAnalysis"></pre>
      </div>
    </div> -->

    <!-- Error Display
    <div v-if="analysisError" class="error-message">
      {{ analysisError }}
    </div> -->

    <!-- Loading State
    <div v-if="isAnalyzing" class="loading-state">
      <span>Analyzing data...</span>
    </div>
 -->
    <div class="generator-form">
      <div class="form-section data-source-row">
        <div class="data-source-header">
          <h3>Data Source</h3>
        </div>
        <div class="file-upload">
          <input type="file" id="file-input" @change="handleFileSelect" accept=".csv,.json,.xlsx">
          <label for="file-input" class="file-label">
            <i class="fas fa-cloud-upload-alt"></i>
            {{ config.file ? config.file.name : 'Choose a file' }}
          </label>
        </div>
      </div>

      <div class="form-section">
        <h3>Visualization Description</h3>
        <div class="text-input-group">
          <textarea 
            v-model="config.visualizationDesc"
            placeholder="What kind of diagrams do you want? (e.g., line chart for sales over time, bar chart comparing categories)"
            rows="4"
          ></textarea>
        </div>
      </div>

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

      <div class="form-section optional-section">
        <h3>Theme Customization <span class="optional-tag">Optional</span></h3>
        <div class="text-input-group">
          <textarea 
            v-model="config.themeDesc"
            placeholder="Describe your preferred theme (e.g., dark theme with blue accents, corporate colors with white background)"
            rows="3"
          ></textarea>
        </div>
      </div>
      <div class="action-row">
        <div class="insights-toggle">
          <label class="toggle">
            <input type="checkbox" v-model="config.generateInsights">
            <span class="slider"></span>
          </label>
          <span class="toggle-label">Generate Insights</span>
        </div>
        <div class="action-container">
          <div v-if="isAnalyzing" class="loading-indicator"></div>
          <button class="generate-btn" @click="generateDashboard" :disabled="isAnalyzing">
            Generate Dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import * as XLSX from 'xlsx';

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
    }
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

    async generateDashboard() {
      if (!this.processedData || !this.basicAnalysis) {
        this.analysisError = 'Please upload data and wait for analysis to complete';
        return;
      }

      this.isAnalyzing = true;
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

        // Emit the generated dashboard components
        this.$emit('dashboard-generated', {
          analysis: this.basicAnalysis,
          components: dashboardResponse.data.components
        });

      } catch (error) {
        this.analysisError = error.response?.data?.error || 'Error generating dashboard';
        console.error('Dashboard generation error:', error);
      } finally {
        this.isAnalyzing = false;
      }
    }
  }
}
</script>

<style scoped>
.dashboard-generator {
  margin: 10px;
  height: 100%;
  overflow-y: auto;
  background: #1a1a1a;
  color: #e0e0e0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.generator-form {
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  background: #2a2a2a;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
}

h2 {
  text-align: center;
  color: #ffffff;
  margin-bottom: 24px;
  font-size: 1.8em;
}

.form-section {
  margin-bottom: 24px;
}

.form-section h3 {
  margin-bottom: 12px;
  color: #ffffff;
  font-size: 1.2em;
}

.data-source-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.data-source-header {
  min-width: 120px;
}

.file-upload {
  flex: 1;
}

.file-upload input[type="file"] {
  display: none;
}

.file-label {
  display: block;
  padding: 3px 6px;
  background: #333333;
  border: 2px dashed #4a4a4a;
  border-radius: 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #e0e0e0;
}

.file-label:hover {
  border-color: #007bff;
  background: #383838;
}

.text-input-group textarea {
  width: 100%;
  padding: 8px;
  border: 1px solid #4a4a4a;
  border-radius: 2px;
  font-size: 14px;
  resize: vertical;
  background: #333333;
  color: #e0e0e0;
  min-height: 40px;
}

.text-input-group textarea::placeholder {
  color: #888888;
}

.helper-text {
  display: block;
  margin-top: 8px;
  color: #888888;
  font-size: 12px;
}

.analysis-level-buttons {
  display: flex;
  gap: 0;
  margin-bottom: 12px;
  height: 30px;
}

.level-btn {
  flex: 1;
  padding: 3px 50px;
  border: 1px solid #4a4a4a;
  background: #333333;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #e0e0e0;
}

.level-btn:first-child {
  border-radius: 3px 0 0 3px;
}

.level-btn:last-child {
  border-radius: 0 3px 3px 0;
}

.level-btn.active {
  background: #007bff;
  color: #ffffff;
  border-color: #007bff;
}

.insights-toggle {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #4a4a4a;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #007bff;
}

input:checked + .slider:before {
  transform: translateX(18px);
}

.optional-section {
  opacity: 0.7;
}

.optional-tag {
  font-size: 12px;
  background: #333333;
  padding: 2px 8px;
  border-radius: 5px;
  margin-left: 8px;
  color: #888888;
}

.generate-btn {
  width: 100%;
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  transition: all 0.3s ease;
}

.generate-btn:hover {
  background: #0056b3;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 123, 255, 0.2);
}

/* Animations */
.level-btn {
  position: relative;
  overflow: hidden;
}

.level-btn::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.6s, height 0.6s;
}

.level-btn:active::after {
  width: 200px;
  height: 200px;
  opacity: 0;
}

/* Add some typography improvements */
.text-input-group textarea,
.helper-text,
.toggle-label {
  font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
}

/* Improve contrast for better readability */
.toggle-label {
  color: #e0e0e0;
}

/* Make the form sections more compact */
.form-section + .form-section {
  margin-top: -8px;
}

/* Improve visibility of optional sections */
.optional-section {
  position: relative;
  padding-left: 8px;
}

.optional-section::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: #4a4a4a;
  border-radius: 2px;
}
.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24px;
}

.action-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.loading-indicator {
  width: 20px;
  height: 20px;
  border: 2px solid #333;
  border-top: 2px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.generate-btn {
  padding: 8px 16px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.generate-btn:disabled {
  background: #666;
  cursor: not-allowed;
}

.generate-btn:hover:not(:disabled) {
  background: #0056b3;
}

/* Remove loading state styles */
.loading-state {
  display: none;
}

.insights-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}
/* Add subtle hover states */
.text-input-group textarea:focus {
  border-color: #007bff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.2);
}

.analysis-results {
  background: #333333;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  max-height: 300px;
  overflow-y: auto;
}

.analysis-results pre {
  color: #e0e0e0;
  font-family: 'Courier New', monospace;
  white-space: pre-wrap;
  margin: 0;
}

.error-message {
  color: #ff6b6b;
  background: rgba(255, 107, 107, 0.1);
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  color: #e0e0e0;
  background: #333333;
  border-radius: 8px;
  margin-bottom: 16px;
}

/* Improve visibility of analysis section */
.form-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-section h3::before {
  content: '';
  width: 4px;
  height: 16px;
  background: #007bff;
  border-radius: 2px;
}
</style> 