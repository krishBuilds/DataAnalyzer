<template>
  <div id="app">
    <header>
      <h1>AI Table Analyzer</h1>
    </header>
    <main>
      <DataTable />
    </main>
  </div>
</template>

<script>
import DataTable from './components/DataTable.vue'

export default {
  name: 'App',
  components: {
    DataTable
  }
}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

header {
  background-color: #f8f9fa;
  padding: 0.2rem;
  margin-bottom: 0.5rem;
}

main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 1rem;
}
</style>
