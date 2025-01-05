<template>
  <v-app>
    <div class="dashboard scrollable-content" :class="{ 'fade-in': mounted }" style="margin-left: 16px;">
      <v-container fluid>
        <v-row>
          <!-- Plots Section -->
          <v-col cols="12" md="8">
            <v-row>
              <template v-for="(plot, index) in plots" :key="index">
                <!-- First row: two plots side by side if available -->
                <v-col 
                  :cols="12" 
                  :md="6"
                  :class="{'mb-4': true}"
                >
                  <v-card class="plot-card">
                    <v-card-title>Plot {{ index + 1 }}</v-card-title>
                    <div 
                      class="plot-container"
                      :ref="`plot${index + 1}Container`"
                    ></div>
                    <v-card-text class="plot-description" v-html="renderMarkdown(plot.description)"></v-card-text>
                  </v-card>
                </v-col>
              </template>
            </v-row>
          </v-col>
          
          <!-- Analysis Results -->
          <v-col cols="12" md="4">
            <v-card class="analysis-card">
              <v-card-title>Analysis Results</v-card-title>
              <v-card-text>
                <div class="results-content">
                  <div v-if="isLoading" class="loading-indicator">
                    <v-progress-circular indeterminate color="primary"></v-progress-circular>
                    <p>Generating analysis...</p>
                  </div>
                  <div v-else-if="error" class="error-message">
                    {{ error }}
                  </div>
                  <div v-else>
                    <div v-for="(plot, index) in plots" :key="index" class="analysis-item">
                      <h3>Plot {{ index + 1 }}</h3>
                      <div v-html="renderMarkdown(plot.description)"></div>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>

            <!-- Data Description Card -->
            <v-card class="analysis-card mt-4">
              <v-card-title>Data Description</v-card-title>
              <v-card-text>
                <div v-if="isDescriptionLoading && !dataDescription" class="loading-indicator">
                  <v-progress-circular indeterminate color="primary"></v-progress-circular>
                  <p>Analyzing data...</p>
                </div>
                <div class="description-content">
                  <div v-html="formattedDescription" class="streaming-text"></div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- Commented out chat overlay -->
      <!-- Perplexity-style Chat Overlay -->
      <!-- <div class="chat-overlay" :class="{ 'chat-expanded': isChatExpanded }">
        <div class="chat-header" @click="toggleChat">
          <v-icon>{{ isChatExpanded ? 'mdi-chevron-down' : 'mdi-chevron-up' }}</v-icon>
        </div>
        <div v-show="isChatExpanded" class="chat-content">
          <v-text-field
            v-model="userInput"
            placeholder="Ask about your data..."
            @keyup.enter="sendMessage"
            outlined
            dense
            dark
          >
            <template v-slot:append>
              <v-btn icon @click="sendMessage">
                <v-icon>mdi-send</v-icon>
              </v-btn>
            </template>
          </v-text-field>
        </div>
      </div> -->
    </div>
  </v-app>
</template>

<script>
import axios from 'axios';
import { marked } from 'marked';

export default {
  name: 'AnalysisDashboard',
  props: {
    initialQuery: {
      type: String,
      default: ''
    },
    uploadedFile: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      mounted: false,
      fileData: null,
      fileType: null,
      userInput: '',
      isChatExpanded: false,
      messages: [],
      plots: [],
      isLoading: false,
      error: null,
      dataDescription: '',
      isDescriptionLoading: false,
      descriptionEventSource: null,
      descriptionDict: {}
    }
  },
  computed: {
    formattedDescription() {
      return this.dataDescription.replace(/\n/g, '<br>');
    }
  },
  watch: {
    uploadedFile: {
      immediate: true,
      handler(newFile) {
        if (newFile) {
          this.handleFileData(newFile);
        }
      }
    },
    plots: {
      immediate: true,
      deep: true,
      handler(newPlots) {
        this.$nextTick(() => {
          this.renderPlot(newPlots[newPlots.length - 1]);
        });
      }
    }
  },
  mounted() {
    setTimeout(() => {
      this.mounted = true;
      //this.generatePlotsStream();
      if (this.initialQuery) {
        this.messages.push({
          type: 'user',
          text: this.initialQuery
        });
      }
    }, 100);
  },
  methods: {
    async handleFileData(fileInfo) {
      if (!fileInfo || !fileInfo.data) {
        console.error('Invalid file data received:', fileInfo);
        this.error = 'Invalid file data received';
        return;
      }

      this.fileData = fileInfo.data;
      this.fileType = fileInfo.type;
      this.analyzeData();
    },
    
    renderMarkdown(markdown) {
      return marked(markdown);
    },

    async generatePlotsStream() {
      if (!this.fileData) {
        this.error = 'No file data available';
        return;
      }

      this.isLoading = true;
      this.error = null;
      this.plots = [];

      try {
        const response = await axios({
          method: 'post',
          url: '/api/dashboard/generate-plots-stream',
          data: {
            data: this.fileData,
            headers: Object.keys(this.fileData[0] || {}),
          },
          responseType: 'text',
          onDownloadProgress: (progressEvent) => {
            const text = progressEvent.event.target.responseText;
            const lines = text.split('\n\n');
            
            lines.forEach(line => {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(5));
                  
                  switch (data.type) {
                    case 'plot':
                      // Check for error in the plot data
                      if (data.data.error) {
                        console.error('Error in plot data:', data.data.error);
                        break;
                      }

                      // Check if description already exists
                      if (this.descriptionDict[data.data.description]) {
                        console.warn('Duplicate description found:', data.data.description);
                        break;
                      }

                      // Add description to dictionary and push plot
                      this.descriptionDict[data.data.description] = true;
                      this.plots.push({
                        plot_html: data.data.plot_html,
                        description: data.data.description
                      });
                        this.renderPlot(this.plots[this.plots.length - 1]);
                      break;
                      
                    case 'error':
                      console.error('Error generating plot:', data.error);
                      break;
                    
                    case 'complete':
                      this.isLoading = false;
                      break;
                  }
                } catch (e) {
                  console.debug('Skipping invalid JSON line:', e);
                }
              }
            });
          }
        });

        if (response.status !== 200) {
          throw new Error('Failed to generate plots');
        }
      } catch (error) {
        console.error('Error in plot stream:', error);
        this.error = error.message;
      } finally {
        this.isLoading = false;
      }
    },

    renderPlot(plot) {

      const containerRef = `plot${this.plots.length}Container`;
      const containers = this.$refs[containerRef];
      const container = containers ? containers[0] : null;
      
      if (container) {
        // Clear previous content
        container.innerHTML = '';
        
        // Create and configure iframe
        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        iframe.style.border = 'none';
        container.appendChild(iframe);
        
        // Write plot HTML to iframe
        const iframeDoc = iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(plot.plot_html);
        iframeDoc.close();
      }
    },

    toggleChat() {
      this.isChatExpanded = !this.isChatExpanded;
    },
    sendMessage() {
      if (this.userInput.trim()) {
        this.messages.push({
          type: 'user',
          text: this.userInput
        });
        // Add mock response
        setTimeout(() => {
          this.messages.push({
            type: 'assistant',
            text: 'Analysis in progress...'
          });
        }, 500);
        this.userInput = '';
      }
    },
    async analyzeData() {
      this.isLoading = true;
      this.isDescriptionLoading = true;
      this.error = null;
      this.dataDescription = '';
      
      try {
        // Start both processes in parallel
        await Promise.all([
          this.generatePlotsStream(),
          this.startDescriptionStream()
        ]);
      } catch (error) {
        console.error('Error in parallel analysis:', error);
        this.error = error.message;
      } finally {
        this.isLoading = false;
      }
    },

    async startDescriptionStream() {
      this.isDescriptionLoading = true;
      this.dataDescription = '';
      
      try {
        const response = await axios.post('/api/dashboard/describe-data', {
          data: this.fileData,
          headers: Object.keys(this.fileData[0] || {})
        }, {
          responseType: 'text',
          onDownloadProgress: (progressEvent) => {
            const text = progressEvent.event.target.responseText;
            const lines = text.split('\n');
            let newContent = '';
            
            lines.forEach(line => {
              if (line.startsWith('data: ')) {
                try {
                  if (line.includes('[DONE]')) return;
                  const data = JSON.parse(line.slice(5));
                  if (data.content) {
                    newContent = this.renderMarkdown(data.content);
                  }
                } catch (e) {
                  console.debug('Skipping invalid JSON line:', e);
                }
              }
            });

            if (newContent) {
              this.dataDescription += newContent;
            }
          }
        });

        if (response.status !== 200) {
          throw new Error('Failed to get data description');
        }
      } catch (error) {
        console.error('Error in description stream:', error);
        this.error = error.message;
      } finally {
        this.isDescriptionLoading = false;
      }
    }
  }
}
</script>

<style scoped>
.dashboard {
  background: #1a1a1a;
  height: 100%;
  opacity: 0;
  transform: translateY(20px);
  overflow: hidden;
}

.fade-in {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.plot-card, .analysis-card {
  background: #2a2a2a !important;
  color: white !important;
  margin-bottom: 20px;
}

.plot-container {
  width: 100%;
  height: 400px;
  overflow: hidden;
  position: relative;
  background: white;
  margin-bottom: 16px;
  border-radius: 8px;
}

.plot-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.chat-overlay {
  position: fixed;
  bottom: 0;
  right: 20px;
  width: 400px;
  background: #2a2a2a;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.chat-header {
  padding: 12px;
  text-align: center;
  cursor: pointer;
  border-bottom: 1px solid #333;
}

.chat-expanded {
  height: 400px;
}

.chat-content {
  padding: 16px;
}

.messages-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message {
  padding: 10px 15px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background: #3a3a3a;
  align-self: flex-end;
}

.message.assistant {
  background: #4a4a4a;
  align-self: flex-start;
}

.chat-input-wrapper {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 20px;
  background: #2a2a2a;
  border-top: 1px solid #333;
  display: flex;
  gap: 10px;
  z-index: 1001;
}

.chat-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #333;
  border-radius: 6px;
  background: #3a3a3a;
  color: white;
}

.send-btn {
  margin-left: 8px;
}

.plot-description {
  font-size: 0.9em;
  color: #cccccc;
  padding: 8px 16px;
}

.loading-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.error-message {
  color: #ff5252;
  padding: 16px;
  text-align: center;
}

.analysis-item {
  margin-bottom: 20px;
  padding: 12px;
  border-bottom: 1px solid #333;
}

.analysis-item:last-child {
  border-bottom: none;
}

.scrollable-content {
  height: 100%;
  overflow-y: auto;
  padding: 20px 0;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.description-content {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  color: #ffffff;
}

.streaming-text {
  white-space: pre-wrap;
  line-height: 1.6;
  animation: fadeIn 0.3s ease-in;
  color: #ffffff;
  font-size: 1.1em;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Add a subtle typing animation to the last character */
.streaming-text:not(:empty)::after {
  content: '|';
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Add styles for stacked plots */
.v-col:nth-child(n+3) .plot-container {
  height: 600px;
}

.plot-container.full-width {
  height: 600px;
}

.mb-4 {
  margin-bottom: 16px;
}

.v-container {
  height: 100%;
  padding: 0;
  margin: 0;
}
</style> 