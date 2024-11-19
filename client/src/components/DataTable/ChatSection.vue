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
        v-model="localUserMessage"
        :loading="loading"
        @send="handleSend"
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
    userMessage: String,
    selectedPlot: String
  },
  emits: ['send-message', 'select-plot', 'update:userMessage'],
  computed: {
    localUserMessage: {
      get() {
        return this.userMessage
      },
      set(value) {
        this.$emit('update:userMessage', value)
      }
    }
  },
  methods: {
    handleSend() {
      if (this.localUserMessage?.trim()) {
        this.$emit('send-message', this.localUserMessage);
        this.$emit('update:userMessage', '');
      }
    }
  }
}
</script>

<style scoped>
.chat-section {
  flex: 1;
  min-width: 300px;
  max-width: 500px;
  display: flex;
  flex-direction: column;
}

.chat-container {
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h3 {
  margin: 0;
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.message {
  padding: 10px;
  border-radius: 8px;
  max-width: 75%;
}

.message.bot {
  background: #e9ecef;
  color: #212529;
  align-self: flex-start;
}

.message.user {
  background: #007bff;
  color: white;
  align-self: flex-end;
}
</style> 