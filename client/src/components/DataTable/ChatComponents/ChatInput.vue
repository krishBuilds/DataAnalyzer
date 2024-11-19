<template>
  <div class="chat-input">
    <textarea 
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
      @keyup.enter.exact="$emit('send')"
      placeholder="Ask about your data..."
      class="message-input"
      rows="1"
    ></textarea>
    <button @click="$emit('send')" :disabled="!modelValue?.trim() || loading">
      Send
    </button>
  </div>
</template>

<script>
export default {
  name: 'ChatInput',
  props: {
    modelValue: {
      type: String,
      default: ''
    },
    loading: Boolean
  },
  emits: ['update:modelValue', 'send']
}
</script>

<style scoped>
.chat-input {
  padding: 15px;
  border-top: 1px solid #ddd;
  display: flex;
  gap: 10px;
}

.message-input {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  resize: none;
  height: 38px;
  line-height: 20px;
}

button {
  padding: 8px 15px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>