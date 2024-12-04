<template>
  <div id="app">
    <DataTable />
  </div>
</template>

<script>
import DataTable from './components/ChatClient.vue'

export default {
  name: 'App',
  components: {
    DataTable
  }
}
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}

#app {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
}
</style>
