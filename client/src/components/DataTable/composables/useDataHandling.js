import { ref } from 'vue';
import * as XLSX from 'xlsx';
import { fileHandlers } from '../utils/fileHandlers';
import axios from 'axios';

export function useDataHandling() {
  const tableData = ref([]);
  const headers = ref([]);
  const changedRows = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const history = ref([]);
  const currentHistoryIndex = ref(-1);

  const addToHistory = (state) => {
    if (currentHistoryIndex.value < history.value.length - 1) {
      history.value = history.value.slice(0, currentHistoryIndex.value + 1);
    }
    
    const newState = {
      data: JSON.parse(JSON.stringify(state.data)),
      headers: [...state.headers]
    };
    
    history.value.push(newState);
    currentHistoryIndex.value++;
  };

  const updateTableData = (newData) => {
    if (newData && newData.length > 0) {
      addToHistory({
        data: tableData.value,
        headers: headers.value
      });
      
      tableData.value = newData;
      headers.value = Object.keys(newData[0] || {});
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    loading.value = true;
    error.value = null;
    tableData.value = [];
    headers.value = [];
    changedRows.value = [];

    try {
      const data = await fileHandlers.readFile(file);
      tableData.value = data;
      headers.value = Object.keys(data[0] || {});
      
      // Initialize history
      history.value = [{
        data: JSON.parse(JSON.stringify(data)),
        headers: [...headers.value]
      }];
      currentHistoryIndex.value = 0;
      
      // Upload data to server
      await axios.post('/api/upload', { data });
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  const undo = () => {
    if (currentHistoryIndex.value > 0) {
      currentHistoryIndex.value--;
      const state = history.value[currentHistoryIndex.value];
      tableData.value = JSON.parse(JSON.stringify(state.data));
      headers.value = [...state.headers];
      changedRows.value = [];
    }
  };

  const redo = () => {
    if (currentHistoryIndex.value < history.value.length - 1) {
      currentHistoryIndex.value++;
      const state = history.value[currentHistoryIndex.value];
      tableData.value = JSON.parse(JSON.stringify(state.data));
      headers.value = [...state.headers];
      changedRows.value = [];
    }
  };

  const cleanData = async () => {
    loading.value = true;
    const cleaningMessage = "Clean this dataset by: 1. Remove unnecessary columns 2. Rename headers to be more readable 3. Format data consistently";
    
    try {
      const response = await axios.post('/api/analyze', {
        data: tableData.value,
        question: cleaningMessage
      });
      
      if (response.data.data) {
        addToHistory({
          data: tableData.value,
          headers: headers.value
        });
        
        tableData.value = response.data.data;
        headers.value = Object.keys(response.data.data[0] || {});
        changedRows.value = response.data.changedRows || [];
      }
    } catch (err) {
      error.value = err.response?.data?.error || 'An error occurred while cleaning data';
    } finally {
      loading.value = false;
    }
  };

  const exportData = (format) => {
    if (format === 'csv') {
      const csvContent = headers.value.join(',') + '\n' + 
        tableData.value.map(row => 
          headers.value.map(header => row[header]).join(',')
        ).join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data_export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(tableData.value);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Data');
      XLSX.writeFile(wb, 'data_export.xlsx');
    }
  };

  return {
    tableData,
    headers,
    changedRows,
    loading,
    error,
    history,
    currentHistoryIndex,
    handleFileUpload,
    cleanData,
    undo,
    redo,
    exportData,
    updateTableData,
    addToHistory
  };
} 