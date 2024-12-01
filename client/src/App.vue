<template>
  <div id="app">
    <main>
      <DataTable />
    </main>
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
  overflow: hidden;
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;

}

main {
  max-width: 1200px;
  margin: 0 auto;
}
</style>
