import { ref } from 'vue';
import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: 'http://localhost:3000',
  timeout: 300000,
  maxContentLength: 100 * 1024 * 1024,
});

export function useChatHandling(tableData, onTableUpdate) {
  const chatMessages = ref([
    { type: 'bot', text: 'Hello! Upload a file and I can help you analyze it.' }
  ]);
  const isRetrying = ref(false);
  const loading = ref(false);

  const executeAnalysis = async (question) => {
    return await axiosInstance.post('/api/analyze', {
      question: question,
      data: tableData.value
    });
  };

  const handleSuccessResponse = (response) => {
    if (response.data.data && response.data.data.length > 0) {
      onTableUpdate(response.data.data);
    }

    const botMessage = {
      type: 'bot',
      text: response.data.analysis,
      code: response.data.code
    };

    if (response.data.plot) {
      botMessage.plot = response.data.plot;
    }

    chatMessages.value.push(botMessage);
  };

  const displayError = (error) => {
    let errorMessage = error.response?.data?.error || 'An error occurred';
    if (error.request) {
      errorMessage = 'Server not responding. Please try again.';
    } else if (!error.response) {
      errorMessage = 'Failed to send request: ' + error.message;
    }

    chatMessages.value.push({ 
      type: 'bot', 
      text: errorMessage,
      error: {
        message: errorMessage,
        details: error.response?.data?.details || error.message,
        code: error.response?.data?.code
      }
    });
  };

  const sendMessage = async (message) => {
    if (!message || !message.trim() || !tableData.value.length) return;
    
    loading.value = true;
    chatMessages.value.push({ type: 'user', text: message });
    
    try {
      const response = await executeAnalysis(message);
      handleSuccessResponse(response);
    } catch (error) {
      displayError(error);

      if (!isRetrying.value && error.response?.data?.error) {
        isRetrying.value = true;
        try {
          const modifiedQuestion = `${message} Please keep in mind the following error: "${error.response.data.error}"`;
          const retryResponse = await executeAnalysis(modifiedQuestion);
          handleSuccessResponse(retryResponse);
        } catch (retryError) {
          console.log('Retry attempt failed:', retryError);
        }
      }
    } finally {
      loading.value = false;
      isRetrying.value = false;
    }
  };

  return {
    chatMessages,
    sendMessage,
    executeAnalysis,
    handleSuccessResponse,
    displayError,
    loading
  };
} 