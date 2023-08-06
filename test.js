import puppeteer from 'puppeteer'
import fs from 'fs'
import axios from 'axios'

async function takeScreenshot() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://www.cwb.gov.tw/V8/C/W/Town/Town.html?TID=6800900'); // 前往指定網頁
  const elementHandle = await page.$('#TableId3hr'); // 使用 CSS 選擇器選取指定元素
  const boundingBox = await elementHandle.boundingBox();
  const screenshotOptions = {
    clip: {
      x: boundingBox.x = 650,
      y: boundingBox.y = 854,
      width: boundingBox.width = 528,
      height: boundingBox.height = 245,
    },
  };

  await elementHandle.screenshot({ path: 'element.jpg', ...screenshotOptions });
  fs.copyFileSync('element.jpg', './element.jpg');


  await browser.close();
  return 'success'
}

function A() {
    const res = new Promise(async (resolve) => {
        const result = await takeScreenshot();
        resolve(result);
      });
    
    res.then((result) => {
        console.log(result);
    })
  }

A()



//const containsSubstring = str.includes(weather_keyword);
//console.log(str.substring(str.indexOf(c), str.indexOf(c)+c.length))

//const date = new Date()
//const hour = date.getHours()
//console.log()

//Client ID:c7aaa7e205bedf3
//Client secret:53d2e9eb35abc961cc5efe357ace9c419f4eef6c