const fs = require("fs")
const path  = require("path");
const packageJson = fs.readFileSync("./package.json")
const version = JSON.parse(packageJson).version || 0
process.env.VUE_APP_VERSION = version;
const webpack = require("webpack");

module.exports = {
  lintOnSave: true,
  css: {
    loaderOptions: {
      sass: {
        prependData: `
            @import "@/assets/colors.scss";
            @import "@/uikit/styles/uikit.scss";
          `
      }
    }
  },
  devServer: {
    // host: "fatty.net",
    disableHostCheck: true
  },
  // publicPath: '/opennote/',
  parallel: true,
  chainWebpack: config => {
    config.module.rule("eslint").use("eslint-loader").options({
      fix: true
    })

    // config.module.rule('ts').exclude.add(/\.worker.ts$/);

    config.module
      .rule("worker")
      .post()
      .test(/\.worker\.ts$/)
      .use("worker-loader")
      .loader("worker-loader")
      .end();

    config.module
      .rule('svg')
      .exclude.add(path.resolve(__dirname, "src", "assets", "icons"))
      .end();

    config.module
      .rule("svg-icon")
      .test(/\.svg$/)
      .include.add(path.resolve(__dirname, "src", "assets", "icons"))
      .end()
      .use("svg-sprite-loader")
      .loader("svg-sprite-loader")
      .options({
        symbolId: 'icon-[name]'
      })
      .end();
  },
  configureWebpack: {
    plugins: [
      new webpack.ProvidePlugin({
        $: "jquery",
        jquery: "jquery",
        "window.jQuery": "jquery",
        jQuery: "jquery"
      })
    ]
  },
};