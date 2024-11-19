<template>
  <div class="modal" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <img 
        :src="`data:image/png;base64,${plot}`" 
        alt="Data Visualization" 
        class="modal-image"
      >
    </div>
  </div>
</template>

<script>
export default {
  name: 'PlotModal',
  props: {
    plot: {
      type: String,
      required: true
    }
  },
  emits: ['close']
}
</script>

<style scoped>
.modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  cursor: pointer;
}

.modal-content {
  background: transparent;
  cursor: default;
  padding: 20px;
  max-width: 95vw;
  max-height: 95vh;
}

.modal-image {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 90vh;
  object-fit: contain;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}
</style> 