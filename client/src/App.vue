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
          <div 
            class="nav-item" 
            :class="{ active: currentPage === 'dashboard-generator' }"
            @click="currentPage = 'dashboard-generator'"
          >
            <i class="fas fa-sliders"></i>
          </div>
        </div>
      </div>

      <!-- Main Content Area -->
      <div class="main-content">
        <keep-alive>
          <ChatAnalysisBoard 
            v-if="currentPage === 'analysis-board' && !showAnalysisDashboard"
            @start-analysis="handleAnalysisStart"
            @file-uploaded="handleFileUpload"
          />
        </keep-alive>
        <keep-alive>
          <AnalysisDashboard 
            v-if="currentPage === 'analysis-board' && showAnalysisDashboard"
            :initialQuery="analysisQuery"
            :uploadedFile="analysisFile"
            ref="dashboard"
          />
        </keep-alive>
        <DataTable 
          v-if="currentPage === 'data-table'" 
          ref="dataTable"
          @beforeDestroy="handleDataTableDestroy"
        />
        <DashboardGenerator
          v-if="currentPage === 'dashboard-generator'"
          @generate-dashboard="handleDashboardGeneration"
        />
      </div>
    </div>
  </div>
</template>

<script>
import DataTable from './components/TableChat.vue'
import ChatAnalysisBoard from './components/ChatAnalysisBoard.vue'
import AnalysisDashboard from './components/AnalysisDashboard.vue'
import DashboardGenerator from './components/DashboardGenerator.vue'

export default {
  name: 'App',
  components: {
    DataTable,
    ChatAnalysisBoard,
    AnalysisDashboard,
    DashboardGenerator,
  },
  data() {
    return {
      currentPage: 'analysis-board',
      showAnalysisDashboard: false,
      analysisQuery: '',
      analysisFile: null,
      dashboardConfig: null
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
    },
    handleDataTableDestroy() {
      if (this.$refs.dataTable) {
        this.$refs.dataTable.cleanup();
      }
    },
    handleDashboardGeneration(config) {
      this.dashboardConfig = config;
      this.currentPage = 'analysis-board';
      this.showAnalysisDashboard = true;
      // You can pass this config to AnalysisDashboard component as needed
    }
  },
  watch: {
    async currentPage(newPage, oldPage) {
      if (oldPage === 'data-table') {
        try {
          await this.$nextTick();
          if (this.$refs.dataTable) {
            await new Promise(resolve => {
              this.$refs.dataTable.cleanup();
              resolve();
            });
          }
        } catch (error) {
          console.warn('Error during DataTable cleanup:', error);
        }
      }
      
      if (newPage === 'data-table') {
        // Recover state if coming back from analysis board
        const savedState = sessionStorage.getItem('tableState');
        if (savedState) {
          const state = JSON.parse(savedState);
          await this.$nextTick();
          if (this.$refs.dataTable) {
            this.$refs.dataTable.updateTableData(state.data);
          }
          sessionStorage.removeItem('tableState');
        }
      }
    }
  }
}
</script>

<style>
/* Reset default styles */
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  width: 100%;
  overflow: hidden !important;
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

/* Global scrollbar styles */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 10px;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 10px;
  border: 2px solid #f1f1f1;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

/* Handsontable specific scrollbar styles */
:deep(.handsontable) {
  .wtHolder::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  .wtHolder::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }

  .wtHolder::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
    border: 2px solid #f1f1f1;
  }

  .wtHolder::-webkit-scrollbar-thumb:hover {
    background: #555;
  }

  /* Firefox scrollbar styles */
  .wtHolder {
    scrollbar-width: thin;
    scrollbar-color: #888 #f1f1f1;
  }
}

.app-container {
  display: flex;
  height: 100%;
  width: 100%;
  overflow: hidden;
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
  overflow: hidden;
  position: relative;
}

/* Add specific styles for components that should have scrollbars */
.scrollable-content {
  overflow: auto;
  height: 100%;
  
  &::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  &::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 10px;
  }

  &::-webkit-scrollbar-thumb {
    background: #888;
    border-radius: 10px;
    border: 2px solid #f1f1f1;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #555;
  }
}
</style>
