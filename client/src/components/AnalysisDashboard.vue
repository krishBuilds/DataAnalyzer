<template>
  <v-app>
    <div class="dashboard" :class="{ 'fade-in': mounted }">
      <!-- Dashboard Grid -->
      <v-container fluid>
        <v-row>
          <!-- Plots Section -->
          <v-col cols="12" md="8">
            <v-row>
              <v-col cols="12" md="6">
                <v-card class="plot-card">
                  <v-card-title>Analysis Plot 1</v-card-title>
                  <div ref="plot1" class="plot-container"></div>
                </v-card>
              </v-col>
              <v-col cols="12" md="6">
                <v-card class="plot-card">
                  <v-card-title>Analysis Plot 2</v-card-title>
                  <div ref="plot2" class="plot-container"></div>
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
                  <!-- Analysis results will go here -->
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
import Plotly from 'plotly.js-dist'; // Import Plotly

export default {
  name: 'AnalysisDashboard',
  props: {
    initialQuery: {
      type: String,
      required: true
    },
    uploadedFile: {
      type: Object,
      default: null
    }
  },
  data() {
    return {
      mounted: false,
      userInput: '',
      isChatExpanded: false,
      messages: [],
    }
  },
  mounted() {
    setTimeout(() => {
      this.mounted = true;
      this.initializePlots();
      // Add initial query as first message
      if (this.initialQuery) {
        this.messages.push({
          type: 'user',
          text: this.initialQuery
        });
      }
    }, 100);
  },
  methods: {
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
    initializePlots() {
      // Initialize Plotly plots
      const trace1 = {
        x: [1, 2, 3, 4],
        y: [10, 15, 13, 17],
        type: 'scatter'
      };
      
      const trace2 = {
        values: [19, 26, 55],
        labels: ['A', 'B', 'C'],
        type: 'pie'
      };

      Plotly.newPlot(this.$refs.plot1, [trace1]);
      Plotly.newPlot(this.$refs.plot2, [trace2]);
    }
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
  height: 300px;
  padding: 16px;
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
</style> 