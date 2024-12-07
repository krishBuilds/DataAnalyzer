const { defineConfig } = require('@vue/cli-service')
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

module.exports = defineConfig({
  publicPath: process.env.NODE_ENV === 'production' ? './' : '/',
  configureWebpack: {
    devtool: 'source-map',
    output: {
      devtoolModuleFilenameTemplate: info => {
        const resourcePath = info.resourcePath.replace(/^\.\//, '')
        return `webpack:///${resourcePath}`
      }
    },
    plugins: [
      new MonacoWebpackPlugin({
        languages: ['python', 'javascript', 'json'],
        features: ['!gotoSymbol']
      })
    ]
  },
  chainWebpack: config => {
    config.plugin('html').tap(args => {
      args[0].title = 'Data Analyzer'
      return args
    })
  }
})