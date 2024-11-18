import { createStore } from 'vuex'

export default createStore({
  state: {
    tableData: [],
    analysis: null
  },
  mutations: {
    SET_TABLE_DATA(state, data) {
      state.tableData = data
    },
    SET_ANALYSIS(state, analysis) {
      state.analysis = analysis
    }
  },
  actions: {
    updateTableData({ commit }, data) {
      commit('SET_TABLE_DATA', data)
    },
    updateAnalysis({ commit }, analysis) {
      commit('SET_ANALYSIS', analysis)
    }
  },
  getters: {
    getTableData: state => state.tableData,
    getAnalysis: state => state.analysis
  }
}) 