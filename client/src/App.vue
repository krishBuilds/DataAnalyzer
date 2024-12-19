<template>
  <div id="app">
    <div class="app-container">
      <!-- Left Navigation Pane -->
      <div class="nav-pane">
        <div class="nav-header">
          <h3></h3>
        </div>
        <div class="nav-items">
          <div 
            class="nav-item" 
            :class="{ active: currentPage === 'data-table' }"
            @click="currentPage = 'data-table'"
          >
            <i class="fas fa-table"></i>
          </div>
          <div 
            class="nav-item" 
            :class="{ active: currentPage === 'analysis-board' }"
            @click="currentPage = 'analysis-board'"
          >
            <i class="fas fa-chart-line"></i>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-content">
        <ChatAnalysisBoard 
          v-if="currentPage === 'analysis-board' && !showAnalysisDashboard"
          @start-analysis="handleAnalysisStart"
          @file-uploaded="handleFileUpload"
        />
        <AnalysisDashboard 
          v-if="currentPage === 'analysis-board' && showAnalysisDashboard"
          :initialQuery="analysisQuery"
          :uploadedFile="analysisFile"
          ref="dashboard"
        />
        <DataTable v-if="currentPage === 'data-table'" />
      </div>
    </div>
  </div>
</template>

<script>
import DataTable from './components/ChatClient.vue'
import ChatAnalysisBoard from './components/ChatAnalysisBoard.vue'
import AnalysisDashboard from './components/AnalysisDashboard.vue'

export default {
  name: 'App',
  components: {
    DataTable,
    ChatAnalysisBoard,
    AnalysisDashboard
  },
  data() {
    return {
      currentPage: 'analysis-board',
      showAnalysisDashboard: false,
      analysisQuery: '',
      analysisFile: null
    }
  },
  methods: {
    handleAnalysisStart(data) {
      this.analysisQuery = data.query;
      this.analysisFile = data.file;
      this.showAnalysisDashboard = true;
    },
    
    handleFileUpload(fileInfo) {
      // Only handle file upload if dashboard is visible
      if (this.showAnalysisDashboard && this.$refs.dashboard) {
        this.$refs.dashboard.handleFileData(fileInfo);
      } else {
        // Store file info for when dashboard becomes visible
        this.analysisFile = fileInfo;
        this.showAnalysisDashboard = true;
      }
    }
  }
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100vh;
  overflow: hidden;
}

#app {
  height: 100vh;
  display: flex;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  flex-direction: column;
  overflow: hidden;
}

/* Hide all scrollbars */
::-webkit-scrollbar {
  display: none;
}

* {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.app-container {
  display: flex;
  height: 100%;
  width: 100%;
}

.nav-pane {
  width: 50px;
  background: #f8f9fa;
  border-right: 1px solid #dee2e6;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.nav-header {
  padding: 16px;
  border-bottom: 1px solid #dee2e6;
}

.nav-header h3 {
  margin: 0;
  color: #2c3e50;
}

.nav-items {
  padding: 16px 0;
}

.nav-item {
  padding: 12px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #495057;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #e9ecef;
}

.nav-item.active {
  background: #e9ecef;
  color: #007bff;
  font-weight: 500;
}

.nav-item i {
  width: 20px;
}

.main-content {
  flex: 1;
  height: 100%;
  overflow: hidden;
}
</style>
