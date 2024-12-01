module.exports = {
  configureWebpack: {
    devtool: 'source-map',
    output: {
      devtoolModuleFilenameTemplate: info => {
        const resourcePath = info.resourcePath.replace(/\\/g, '/');
        return `webpack:///${resourcePath}?${info.hash}`;
      }
    }
  }
}