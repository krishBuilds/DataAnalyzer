import { ref } from 'vue';
import { axiosInstance } from '../utils/axios';

export function useChatHandling(tableData, headers) {
  const chatMessages = ref([
    { type: 'bot', text: 'Hello! Upload a file and I can help you analyze it.' }
  ]);

  const sendMessage = async (message) => {
    if (!message.trim() || !tableData.value.length) return;

    chatMessages.value.push({ type: 'user', text: message });

    try {
      const response = await axiosInstance.post('/api/analyze', {
        question: message,
        data: tableData.value
      });

      const botMessage = {
        type: 'bot',
        text: response.data.analysis,
        code: response.data.code
      };

      if (response.data.plot) {
        botMessage.plot = response.data.plot;
      }

      chatMessages.value.push(botMessage);

    } catch (error) {
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
    }
  };

  return {
    chatMessages,
    sendMessage
  };
} 