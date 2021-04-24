/*
 * @desc: Deep traversal directory, replace the '//127.0.0.1:8000/' to our CDN path
 */
const AliOssPlugin = require("webpack-oss");
const format = AliOssPlugin.getFormat("YYYYMMDD");
const fs = require("fs");
const path = require("path");
// 获取git信息
const GitRevisionPlugin = require("git-revision-webpack-plugin");
const gitRevision = new GitRevisionPlugin();
// the production path
const relativePath = "/dist";
// our js CDN path
const cdnPath =
  "https://" +
  format +
  "-" +
  gitRevision.version() +
  "/";
// get the full path
const root = path.join(__dirname) + relativePath;
readDirSync(root);

/**
 * Deep traversal directory
 * @param {*} path directory we want traversal
 */
function readDirSync(path) {
  const pa = fs.readdirSync(path);
  // console.log('pa:', pa)
  pa.forEach(function(ele, index) {
    const info = fs.statSync(path + "/" + ele);
    if (info.isDirectory()) {
      console.log("dir: " + ele);
      readDirSync(path + "/" + ele);
    } else {
      const filePath = path + "/" + ele;
      // find all .html, .js file
      const fileNameReg = /\.html$|.js$/gi;
      const shouldFormat = fileNameReg.test(filePath);

      if (shouldFormat) {
        // read the .js and .html file and use regular expression replace the 127.0.0.1 to our CDN path.
        readFile(filePath);
      }
    }
  });
}

// readFile(filename,[options],callback);

/**
 * filename, Required，the full filePath
 * [options],optional
 * callback
 */

function readFile(filename) {
  fs.readFile(filename, { flag: "r+", encoding: "utf8" }, function(err, data) {
    if (err) {
      console.error(err);
    }
    var replacedContent = data.replace(/\/\/127.0.0.1:8000\//g, cdnPath);
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
