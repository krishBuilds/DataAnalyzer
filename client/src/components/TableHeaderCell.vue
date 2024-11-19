<template>
    <th>
      <table-cell
        :value="header"
        :is-header="true"
        row-index="header"
        :column-index="index"
        @edit-start="$emit('edit-start', $event)"
        @edit-complete="$emit('edit-complete', $event)"
        @edit-cancel="$emit('edit-cancel')"
      />
    </th>
  </template>
  
  <script>
  import TableCell from './TableCell.vue'
  
  export default {
    name: 'TableHeaderCell',
    components: {
      TableCell
    },
    props: {
      header: {
        type: String,
        required: true
      },
      index: {
        type: Number,
        required: true
      }
    },
    emits: ['edit-start', 'edit-complete', 'edit-cancel']
  }
  </script>
  
  <style scoped>
  th {
    height: 32px;
    font-size: 1em;
    background: #f8f9fa;
    font-weight: normal;
    text-align: center;
    position: relative;
    padding: 0;
    min-width: 100px;
    box-sizing: border-box;
    border: 1px solid #ddd;
  }
  </style>