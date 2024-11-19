<template>
  <div class="message-content">
    <!-- Plot display -->
    <div v-if="message.plot" class="plot-container">
      <img 
        :src="`data:image/png;base64,${message.plot}`" 
        alt="Data Visualization" 
        class="visualization-plot"
        @click="$emit('select-plot', message.plot)"
      />
    </div>
    
    <!-- Code display -->
    <div v-if="message.code" class="code-block-container">
      <div class="code-header">
        <span class="code-label">Generated Code</span>
      </div>
      <div class="code-block-wrapper">
        <pre class="code-block"><code>{{ message.code }}</code></pre>
      </div>
    </div>
    
    <!-- Error display -->
    <div v-if="message.error" class="error-block">
      <div class="error-title">
        <span class="error-icon">❌</span>
        <span>Error</span>
        <span v-if="message.error.line" class="error-location">at line {{ message.error.line }}</span>
      </div>
      <pre class="error-content">{{ message.error.message || message.error }}</pre>
    </div>
  </div>
</template>

<script>
export default {
  name: 'MessageContent',
  props: {
    message: {
      type: Object,
      required: true
    }
  },
  emits: ['select-plot']
}
</script>

<style scoped>
.plot-container {
  margin: 12px 0;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.visualization-plot {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  cursor: pointer;
  transition: transform 0.2s;
}

.visualization-plot:hover {
  transform: scale(1.02);
}

/* Reuse the existing styles from the original component for code and error blocks */
</style> 