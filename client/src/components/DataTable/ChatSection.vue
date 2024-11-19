<template>
  <div class="chat-section">
    <div class="chat-container">
      <h3>AI Assistant</h3>
      <div class="chat-messages" ref="chatMessages">
        <div v-for="(message, index) in chatMessages" 
             :key="index" 
             :class="['message', message.type]">
          <div class="message-text">{{ message.text }}</div>
          
          <MessageContent 
            :message="message" 
            @select-plot="$emit('select-plot', $event)"
          />
        </div>
      </div>
      
      <ChatInput 
        :loading="loading"
        @send="$emit('send-message', $event)"
      />
    </div>

    <PlotModal 
      v-if="selectedPlot"
      :plot="selectedPlot"
      @close="$emit('select-plot', null)"
    />
  </div>
</template>

<script>
import MessageContent from './ChatComponents/MessageContent.vue';
import ChatInput from './ChatComponents/ChatInput.vue';
import PlotModal from './ChatComponents/PlotModal.vue';

export default {
  name: 'ChatSection',
  components: {
    MessageContent,
    ChatInput,
    PlotModal
  },
  props: {
    chatMessages: Array,
    loading: Boolean,
    selectedPlot: String
  },
  emits: ['send-message', 'select-plot']
}
</script>

<style scoped>
/* Move all chat-related styles here */
</style> 