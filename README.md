# [webpack-oss-replace-cdn](https://github.com/vbigbang/webpack-oss)
> webpack静态资源一键上传阿里云OSS插件，兼容webpack3.x/4.x

# 安装

```
npm i webpack-oss-replace-cdn@1.0.8 --save-dev
```

# 参数
| 选项名          | 类型                 | 是否必填 | 默认值 | 描述                                                                                                                                 |
| :-------------- | :------------------- | :------- | :----- | :----------------------------------------------------------------------------------------------------------------------------------- |
| accessKeyId     | String               | √        |        | 阿里云accessKeyId                                                                                                                    |
| accessKeySecret | String               | √        |        | 阿里云accessKeySecret                                                                                                                |
| region          | String               | √        |        | 阿里云region                                                                                                                         |
| bucket          | String               | √        |        | 阿里云bucket                                                                                                                         |
| prefix          | String               | ×        | ''     | 自定义路径前缀，通常使用项目目录名，文件将存放在alioss的bucket/prefix目录下                                                          |
| format          | Number               | ×        | ''     | 可用时间戳来生成oss目录版本号，每次会保留最近的版本文件做零宕机发布，删除其他版本文件。可以通过插件自身提供的静态方法getFormat()获得 |
| limit           | Number               | ×        | 5      | 最多备份版本数量，会备份最近的版本，最小是3。配置了format才会生效                                                                    |
| deleteAll       | Boolean              | ×        |        | 是否删除bucket/prefix中所有文件。优先匹配format配置                                                                                  |
| local           | Boolean              | ×        | false  | 默认每次上传webpack构建流中文件，设为true可上传打包后webpack output指向目录里的文件                                                  |
| output          | String               | ×        | ''     | 读取本地目录的路径，如果local为true，output为空，默认为读取webpack输出目录                                                           |
| exclude         | ExpReg/Array<ExpReg> | ×        | null   | 可传入正则，或正则组成的数组，来排除上传的文件                                                                                       |
| localUrl        | String               | ×        | ''     | 预渲染的代理地址 通常是publicPath  
| cdnUrl          | String               | ×        | ''     | 用于替换静态资源localUrl的cdn地址 留空不传递该参数时不替换localUrl
# 静态方法
> static getFormat()

&emsp;&emsp;参数又由YYYY|YY|MM|DD|HH|hh|mm|SS|ss组合而成，返回一个纯数字。
                                                        |
```javascript
const WebpackAliOSSPlugin = require('webpack-oss-replace-cdn')

WebpackAliOSSPlugin.getFormat()
WebpackAliOSSPlugin.getFormat('YYYY')
```


# 实例

* 使用webpack构建流文件上传，并删原有所有资源
```javascript
const WebpackAliOSSPlugin = require('webpack-oss-replace-cdn')

new WebpackAliOSSPlugin({
  accessKeyId: '2****************9',
  accessKeySecret: 'z**************=',
  region: 'oss-cn-hangzhou',
  bucket: 'staven',
  prefix: 'nuxt-doc',   // "staven/nuxt-doc/icon_696aaa22.ttf"
  exclude: [/.*\.html$/], // 或者 /.*\.html$/,排除.html文件的上传  
  deleteAll: true	  // 优先匹配format配置项
})
```
* 使用打包后的本地文件上传
```javascript
const WebpackAliOSSPlugin = require('webpack-oss-replace-cdn')
const path = require('path')

new WebpackAliOSSPlugin({
  accessKeyId: '2****************9',
  accessKeySecret: 'z**************=',
  region: 'oss-cn-hangzhou',
  bucket: 'staven',
  prefix: 'nuxt-doc',   // "staven/nuxt-doc/icon_696aaa22.ttf"
  exclude: [/.*\.html$/], // 或者 /.*\.html$/,排除.html文件的上传  
  local: true,
  output: path.resolve(__dirname, './build') // 此项不填，将默认指向webpack/vue-cli等工具输出目录
})
```
* 使用format做版本备份
```javascript
const WebpackAliOSSPlugin = require('webpack-oss-replace-cdn')
const time = WebpackAliOSSPlugin.getFormat('YYMMDD')

new WebpackAliOSSPlugin({
  accessKeyId: '2****************9',
  accessKeySecret: 'z**************=',
  region: 'oss-cn-hangzhou',
  bucket: 'staven',
  prefix: 'nuxt-doc',   // "staven/nuxt-doc/icon_696aaa22.ttf"
  exclude: [/.*\.html$/], // 或者 /.*\.html$/,排除.html文件的上传  
  deleteAll: false,	  // 优先匹配format配置项
  format: time, // 备份最近版本的oss文件，删除其他版本文件
  local: true,   // 上传打包输出目录里的文件
  limit: 10  // 备份版本数量，其余版本被删除
})
```

