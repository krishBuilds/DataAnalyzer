<template>
  <div class="analysis-board">
    <div class="upload-screen" :class="{ 'fade-out': isTransitioning }">
      <h1 class="title">What do you want to analyze today?</h1>
      <div class="input-container">
        <input 
          type="text" 
          v-model="userInput"
          @keyup.enter="startAnalysis"
          placeholder="Add a file or start a conversation now and add files later..."
          class="main-input"
        >
        <label class="file-input-label">
          <input type="file" @change="handleFileUpload" class="file-input">
          <i class="fas fa-paperclip"></i>
        </label>
        <button @click="startAnalysis" class="send-button">
          <i class="fas fa-arrow-up"></i>
        </button>
      </div>
      <div v-if="uploadedFile" class="file-display">
        <span class="file-name">
          <i class="fas fa-file"></i>
          {{ uploadedFile.name }}
        </span>
        <button @click="removeFile" class="remove-file">
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ChatAnalysisBoard',
  data() {
    return {
      userInput: '',
      isTransitioning: false,
      uploadedFile: null
    }
  },
  methods: {
    startAnalysis() {
      console.log("Starting analysis with input:", this.userInput);
      if (this.userInput.trim()) {
        this.isTransitioning = true;
        this.$emit('start-analysis', {
          query: this.userInput,
          file: this.uploadedFile
        });
      }
    },
    handleFileUpload(event) {
      const file = event.target.files[0];
      if (file) {
        this.uploadedFile = file;
      }
    },
    removeFile() {
      this.uploadedFile = null;
    }
  }
}
</script>

<style scoped>
.analysis-board {
  height: 100vh;
  background: #1a1a1a;
  color: white;
  display: flex;
  flex-direction: column;
}

.upload-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 20px;
  opacity: 1;
  transform: translateY(0);
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-out {
  opacity: 0;
  transform: translateY(-20px);
}

.title {
  font-size: 2rem;
  margin-bottom: 2rem;
}

.input-container {
  width: 80%;
  max-width: 800px;
  display: flex;
  gap: 10px;
  background: #2a2a2a;
  padding: 10px;
  border-radius: 8px;
}

.main-input, .chat-input {
  flex: 1;
  padding: 12px;
  border: none;
  background: transparent;
  color: white;
  font-size: 1rem;
}

.file-input {
  display: none;
}

.file-input-label, .send-button {
  padding: 8px;
  cursor: pointer;
  background: transparent;
  border: none;
  color: #666;
}

.file-input-label:hover, .send-button:hover {
  color: #fff;
}

.chat-interface {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.chat-input-container {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 10px;
  background: #2a2a2a;
  padding: 20px;
  border-top: 1px solid #333;
}

.file-display {
  margin-top: 10px;
  font-size: 0.85rem;
  color: #888;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2a2a2a;
  padding: 6px 12px;
  border-radius: 4px;
  max-width: 800px;
  width: 80%;
}

.file-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.remove-file {
  background: transparent;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
}

.remove-file:hover {
  color: #ff4444;
  background: #3a3a3a;
}
</style> 