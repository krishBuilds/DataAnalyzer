<template>
    <div 
      class="table-cell"
      :class="{
        'is-editing': isEditing,
        'is-selected': isSelected,
        'is-header': isHeader
      }"
      @click="handleClick"
    >
      <template v-if="isEditing">
        <input
          ref="input"
          v-model="editValue"
          class="cell-input"
          @blur="handleBlur"
          @keyup.enter="commitEdit"
          @keyup.esc="cancelEdit"
          @click.stop
        />
      </template>
      <template v-else>
        <div class="cell-content">{{ value }}</div>
      </template>
    </div>
  </template>
  
  <script>
  export default {
    name: 'TableCell',
    props: {
      value: {
        type: [String, Number],
        required: true
      },
      isHeader: {
        type: Boolean,
        default: false
      },
      rowIndex: {
        type: [Number, String],
        required: true
      },
      columnIndex: {
        type: [Number, String],
        required: true
      }
    },
    data() {
      return {
        isEditing: false,
        isSelected: false,
        editValue: this.value
      }
    },
    methods: {
      handleClick() {
        this.startEdit();
      },
      startEdit() {
        this.isEditing = true;
        this.editValue = this.value;
        this.$emit('edit-start', {
          rowIndex: this.rowIndex,
          columnIndex: this.columnIndex
        });
        this.$nextTick(() => {
          if (this.$refs.input) {
            this.$refs.input.focus();
          }
        });
      },
      commitEdit() {
        this.isEditing = false;
        this.$emit('edit-complete', {
          rowIndex: this.rowIndex,
          columnIndex: this.columnIndex,
          value: this.editValue
        });
      },
      cancelEdit() {
        this.isEditing = false;
        this.editValue = this.value;
        this.$emit('edit-cancel');
      },
      handleBlur() {
        this.commitEdit();
      }
    }
  }
  </script>
  
  <style scoped>
  .table-cell {
    position: relative;
    width: 100%;
    height: 100%;
    transition: all 0.2s ease;
  }
  
  .cell-content {
    padding: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 18px;
    display: flex;
    align-items: center;
    height: 100%;
  }
  
  /* Update header cell specific styles */
  .is-header .cell-content {
    padding: 8px;
    line-height: 32px;
    justify-content: center;
    height: 100%;
    width: 100%;
  }
  
  .cell-input {
    width: 100%;
    height: 100%;
    padding: 4px;
    border: none;
    background: transparent;
    font-size: inherit;
    font-family: inherit;
    outline: none;
  }
  
  .is-editing {
    z-index: 1;
  }
  
  .is-editing::after {
    content: '';
    position: absolute;
    inset: -1px;
    border: 2px solid #444;
    pointer-events: none;
    z-index: 1;
    box-sizing: border-box;
    animation: pop-in 0.1s ease-out;
  }
  
  .is-editing.is-header::after {
    border-width: 3px;
  }
  
  @keyframes pop-in {
    0% {
      transform: scale(0.8);
      opacity: 0.9;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }
  </style>