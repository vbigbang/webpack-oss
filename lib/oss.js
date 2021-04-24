const fs = require("fs");
const path = require("path");

const OSS = require("ali-oss");
const colors = require("ansi-colors");
const log = require("fancy-log");
// 获取git信息
const GitRevisionPlugin = require("git-revision-webpack-plugin");

const gitRevision = new GitRevisionPlugin();

const utils = require("./utils");

const { regexp } = utils;

/**
 * Deep traversal directory
 * @param {*} path directory we want traversal
 * @param localUrl
 * @param cdnUrl
 */
function readDirSync(path, localUrl, cdnUrl) {
  const pa = fs.readdirSync(path);
  // console.log('pa:', pa)
  pa.forEach(function(ele, index) {
    const info = fs.statSync(path + "/" + ele);
    if (info.isDirectory()) {
      console.log("dir: " + ele);
      readDirSync(path + "/" + ele, localUrl, cdnUrl);
    } else {
      const filePath = path + "/" + ele;
      // find all .html, .js file
      const fileNameReg = /\.html$|.js$/gi;
      const shouldFormat = fileNameReg.test(filePath);

      if (shouldFormat) {
        // read the .js and .html file and use regular expression replace the 127.0.0.1 to our CDN path.
        readFile(filePath, localUrl, cdnUrl);
      }
    }
  });
}

/**
 * filename, Required，the full filePath
 * [options],optional
 * callback
 */

function readFile(filename, localUrl, cdnUrl) {
  fs.readFile(filename, { flag: "r+", encoding: "utf8" }, function(err, data) {
    if (err) {
      console.error(err);
    }
    var replacedContent = data.replace(new RegExp(localUrl,'g'), cdnUrl);
    // write file
    writeFile(filename, replacedContent);
  });
}

/**
 * filename, Required，filePath
 * str
 * [options],flag,mode w(write), encoding
 * callback
 */

function writeFile(filename, str) {
  var wData = Buffer.from(str);
  fs.writeFile(filename, wData, { flag: "w" }, function(err) {
    if (err) {
      console.error(err);
    } else {
      console.log(logFileName(filename) + "...write success...");
    }
  });
}

/**
 * @param {Sting} fullPath
 *  return the file's short name
 */
function logFileName(fullPath) {
  var posArr = [];
  var pos = fullPath.indexOf("/");
  while (pos !== -1) {
    posArr.push(pos);
    pos = fullPath.indexOf("/", pos + 1);
  }
  // console.log(posArr)
  var len = posArr.length;
  var subIndex = len - 3 >= 0 ? len - 3 : 0;
  // substr： /dist/pc/index.html
  return fullPath.substr(posArr[subIndex]);
}


class AliOSS {
  constructor(options) {
    if (Object.prototype.toString.call(options) !== "[object Object]") {
      throw new Error(`配置信息应该是Object`);
    }

    this.config = Object.assign(
      {
        prefix: "",
        exclude: null,
        format: null,
        deleteAll: false,
        output: "",
        local: false,
        limit: 5,
        cdnUrl: "",
        localUrl: ""
      },
      options
    );

    if (
      ["accessKeyId", "accessKeySecret", "bucket", "region"].some(
        key => !options[key]
      )
    ) {
      throw new Error(`请填写正确的accessKeyId、accessKeySecret和bucket`);
    }

    if (this.config.format && !/[0-9]+/.test(this.config.format)) {
      throw new Error(`format应该是纯数字`);
    }

    this.client = new OSS(this.config);
  }

  static getFormat(format = "YYYYMMDDhhmm") {
    if (!regexp.test(format)) {
      throw new Error(
        `参数格式由纯数字或YYYY、YY、MM、DD、HH、hh、mm、SS、ss组成`
      );
    }
    return utils.formatDate(new Date(), format);
  }

  upload() {
    if (this.config.format) {
      this.delCacheAssets();
    } else if (this.config.deleteAll) {
      this.delAllAssets();
    } else {
      this.uploadAssets();
    }
  }

  async delFilterAssets(prefix) {
    try {
      const list = [];
      list.push(prefix);
      let result = await this.client.list({
        prefix,
        "max-keys": 1000
      });
      if (result.objects) {
        result.objects.forEach(file => {
          list.push(file.name);
        });
      }
      if (Array.isArray(list)) {
        result = await this.client.deleteMulti(list, {
          quiet: true
        });
      }
    } catch (error) {
      log(colors.red(`删除缓存文件失败!`));
    }
  }

  async delCacheAssets() {
    const { prefix } = this.config;
    const list = [];
    try {
      const dirList = await this.client.list({
        prefix: `${prefix}/`,
        delimiter: "/"
      });

      if (dirList.prefixes) {
        dirList.prefixes.forEach(subDir => {
          list.push(+subDir.slice(prefix.length + 1, -1));
        });
      }

      if (list.length > 1) {
        const limit = this.config.limit > 3 ? this.config.limit - 1 : 2;
        const array = list
          .slice()
          .sort((a, b) => b - a)
          .slice(limit);
        await this.asyncForEach(array, async (item, index) => {
          await this.delFilterAssets(`${prefix}/${item}`);
        });
      }

      this.uploadAssets();
    } catch (error) {
      this.uploadAssets();
    }
  }

  async asyncForEach(arr, cb) {
    for (let i = 0; i < arr.length; i++) {
      await cb(arr[i], i);
    }
  }

  async delAllAssets() {
    try {
      const { prefix } = this.config;
      let result = await this.client.list({
        prefix,
        "max-keys": 1000
      });
      if (result.objects) {
        result = result.objects.map(file => file.name);
      }
      if (Array.isArray(result)) {
        result = await this.client.deleteMulti(result, { quiet: true });
      }
      this.uploadAssets();
    } catch (error) {
      this.uploadAssets();
    }
  }

  async uploadAssets() {
    if (this.config.local) {
      // 修改cdn
      if (this.config.cdnUrl !== '') {
        await readDirSync(this.config.output, this.config.localUrl, this.config.cdnUrl);
      }
      await this.uploadLocale(this.config.output);
    } else {
      await this.asyncForEach(Object.keys(this.assets), async (name, index) => {
        if (this.filterFile(name)) {
          await this.update(
            name,
            Buffer.from(this.assets[name].source(), "utf8")
          );
        }
      });
    }
  }

  filterFile(name) {
    const { exclude } = this.config;
    return (
      !exclude ||
      (Array.isArray(exclude) && !exclude.some(item => item.test(name))) ||
      (!Array.isArray(exclude) && !exclude.test(name))
    );
  }

  getFileName(name) {
    const { config } = this;
    const prefix = config.format
      ? path.join(config.prefix, config.format.toString())
      : config.prefix;
    return path.join(prefix, name).replace(/\\/g, "/");
  }

  async update(name, content) {
    const fileName = this.getFileName(name);
    try {
      const result = await this.client.put(fileName, content);
      if (+result.res.statusCode === 200) {
        log(colors.green(`${fileName}上传成功!`));
      } else {
        log(colors.red(`${fileName}上传失败!`));
      }
    } catch (error) {
      log(colors.red(`${fileName}上传失败!`));
    }
  }

  async uploadLocale(dir) {
    const result = fs.readdirSync(dir);
    await this.asyncForEach(result, async file => {
      const filePath = path.join(dir, file);
      if (this.filterFile(filePath)) {
        if (fs.lstatSync(filePath).isDirectory()) {
          await this.uploadLocale(filePath);
        } else {
          const fileName = filePath.slice(this.config.output.length);
          await this.update(fileName, filePath);
        }
      }
    });
  }
}

module.exports = AliOSS;
