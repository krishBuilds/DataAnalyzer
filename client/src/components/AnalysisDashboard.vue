<template>
  <v-app>
    <div class="dashboard" :class="{ 'fade-in': mounted }">
      <v-container fluid>
        <v-row>
          <!-- Plots Section -->
          <v-col cols="12" md="8">
            <v-row>
              <v-col cols="12" md="6" v-if="plots[0]">
                <v-card class="plot-card">
                  <v-card-title>Analysis Plot 1</v-card-title>
                  <div class="plot-container" ref="plot1Container"></div>
                  <v-card-text class="plot-description">
                    {{ plots[0].description }}
                  </v-card-text>
                </v-card>
              </v-col>
              <v-col cols="12" md="6" v-if="plots[1]">
                <v-card class="plot-card">
                  <v-card-title>Analysis Plot 2</v-card-title>
                  <div class="plot-container" ref="plot2Container"></div>
                  <v-card-text class="plot-description">
                    {{ plots[1].description }}
                  </v-card-text>
                </v-card>
              </v-col>
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
                      <p>{{ plot.description }}</p>
                    </div>
                  </div>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- Perplexity-style Chat Overlay -->
      <div class="chat-overlay" :class="{ 'chat-expanded': isChatExpanded }">
        <!-- Chat Header -->
        <div class="chat-header" @click="toggleChat">
          <span>Analysis Chat</span>
          <v-icon>{{ isChatExpanded ? 'mdi-chevron-down' : 'mdi-chevron-up' }}</v-icon>
        </div>

        <!-- Chat Messages -->
        <div v-show="isChatExpanded" class="chat-content">
          <div class="messages-container">
            <div v-for="(message, index) in messages" 
                 :key="index" 
                 class="message"
                 :class="message.type">
              <div class="message-content">{{ message.text }}</div>
            </div>
          </div>
        </div>

        <!-- Chat Input -->
        <div class="chat-input-wrapper">
          <input 
            type="text" 
            v-model="userInput"
            @keyup.enter="sendMessage"
            placeholder="Ask about your analysis..."
            class="chat-input"
          >
          <v-btn icon @click="sendMessage" class="send-btn">
            <v-icon>mdi-send</v-icon>
          </v-btn>
        </div>
      </div>
    </div>
  </v-app>
</template>

<script>
import axios from 'axios';
//import DOMPurify from 'dompurify';

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
      error: null
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
          this.renderPlots(newPlots);
        });
      }
    }
  },
  mounted() {
    setTimeout(() => {
      this.mounted = true;
      this.generatePlots();
      if (this.initialQuery) {
        this.messages.push({
          type: 'user',
          text: this.initialQuery
        });
      }
    }, 100);
  },
  methods: {
    handleFileData(fileInfo) {
      if (!fileInfo || !fileInfo.data) {
        console.error('Invalid file data received:', fileInfo);
        this.error = 'Invalid file data received';
        return;
      }

      this.fileData = fileInfo.data;
      this.fileType = fileInfo.type;
      console.log('Received file data:', {
        type: this.fileType,
        dataLength: Array.isArray(this.fileData) ? this.fileData.length : 'not array',
        sample: this.fileData.slice?.(0, 2)
      });
      this.generatePlots();
    },
    
    sanitizeHtml(html) {
      return html;
    },
    
    async generatePlots() {
      if (!this.fileData) {
        this.error = 'No file data available';
        return;
      }

      this.isLoading = true;
      this.error = null;

      try {
        const response = await axios.post('/api/dashboard/generate-plots', {
          data: this.fileData,
          headers: Object.keys(this.fileData[0] || {}),
          fileType: this.fileType
        });

        console.log('Plot response:', response.data); // Debug log

        if (!response.data.success) {
          throw new Error(response.data.error || 'Failed to generate plots');
        }

        this.plots = response.data.plots.map(plot => ({
          plot_html: plot.plot_html,
          description: plot.description
        }));

      } catch (error) {
        console.error('Error generating plots:', error);
        this.error = error.response?.data?.error || error.message;
      } finally {
        this.isLoading = false;
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
    renderPlots(plots) {
      plots.forEach((plot, index) => {
        const containerRef = `plot${index + 1}Container`;
        const container = this.$refs[containerRef];
        
        if (container && plot.plot_html) {
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

          // Log for debugging
          console.log(`Rendered plot ${index + 1}, HTML length:`, plot.plot_html.length);
        }
      });
    },
  }
}
</script>

<style scoped>
.dashboard {
  background: #1a1a1a;
  min-height: 100vh;
  opacity: 0;
  transform: translateY(20px);
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
}

.plot-container iframe {
  width: 100%;
  height: 100%;
  border: none;
}

.chat-overlay {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 800px;
  background: #2a2a2a;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
  transition: height 0.3s ease;
  height: 60px;
  z-index: 1000;
}

.chat-expanded {
  height: 500px;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  cursor: pointer;
  border-bottom: 1px solid #333;
}

.chat-content {
  height: calc(100% - 120px);
  overflow-y: auto;
  padding: 20px;
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
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 10px 20px;
  background: #2a2a2a;
  border-top: 1px solid #333;
  display: flex;
  gap: 10px;
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
</style> 