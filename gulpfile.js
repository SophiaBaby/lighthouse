const gulp = require("gulp")
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const printer = require('lighthouse/lighthouse-cli/printer');
const Reporter = require('lighthouse/lighthouse-core/report/report-generator');
const fs = require('fs-extra');
const del = require("del")
const taskList = require('./taskList');
let chrome

gulp.task("start",async function(cb){
  let timestamp = Date.now();
  let spent = [];
  console.log(`共 ${taskList.length} 个任务`)

  for (let i = 0; i < taskList.length; i++) {
    console.log(`当前第 ${i+1} 个任务`)
    spent.push(await run(taskList[i], timestamp, i));
  }

  // 替换模板中的内容
  let template = await fs.readFileSync('./summary/template/template.html', 'utf-8');
  let summary = Reporter.replaceStrings(template, [{
    search: '%%TIME_SPENT%%',
    replacement: JSON.stringify(spent)
  }, {
    search: '%%TIMESTAMP%%',
    replacement: timestamp
  }]);
  await write(`./summary/report/summary@${timestamp}.html`, summary)

  cb()
})

async function launchChrome() {
  try {
      chrome = await chromeLauncher.launch({
          chromeFlags: [
              "--disable-gpu",
              "--no-sandbox",
              "--headless"
          ],
          enableExtensions: true,
          logLevel: "error"
      });
      return {
          port: chrome.port,
          chromeFlags: [
              "--headless"
          ],
          logLevel: "error"
      }
  } catch (e) {
      console.log("ENOW lighthouse error: launching Chrome ", e);
  }
}

async function lighthouseRunner(url, opt, config={extends: 'lighthouse:default'}) {
  try {
      return await lighthouse(url, opt, config);
  } catch (e) {
      console.log("ENOW lighthouse error: running lighthouse");
  }
}

// 生成当前页面的报告
function genReport(result) {
  return Reporter.generateReport(result.lhr, 'html');
}

// 生成总页面的报告
async function write(file, report) {
  try {
      await fs.outputFile(file, report);
      return true
  } catch (e) {
      console.log("error while writing report ", e);
  }
}

// 清理数据
gulp.task('clean:report', function (cb) {
  del([
      'cases/**/*',
      'summary/report/**/*',
  ], cb);
  cb()
});

// 每个页面的测试入口
async function run(url, timestamp, num, config) {
  let chromeOpt = await launchChrome();
  let result = await lighthouseRunner(url, chromeOpt, config);
  let report = genReport(result);
  // 保存报告
  await printer.write(report, 'html', `./cases/lighthouse-report@${timestamp}-${num}.html`);
  result.lhr.audits['first-contentful-paint'].rawValue;

  let res = {
    audits:{
        "first-contentful-paint":result.lhr.audits['first-contentful-paint']
    },
    categories:result.lhr.categories,
    lighthouseVersion:result.lhr.lighthouseVersion,
    requestedUrl:result.lhr.requestedUrl
  }

   // 关闭chrome
   await chrome.kill();
   return res;//result.lhr
}
