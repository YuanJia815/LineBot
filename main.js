import dotenv from 'dotenv'
import express from 'express'
import line from '@line/bot-sdk'

dotenv.config()

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

// 注意這裡的路由，如果在 Vercel 放在 api 資料夾下，通常會改成 /api/callback
app.post('/api/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null)
  }
  const msg = event.message.text
  
  if (msg.includes('test')) {
    const messages = [];
    for (let i = 1; i <= 3; i++) {
      messages.push({
        type: 'text',
        text: i.toString()
      });
    }
    // Vercel Serverless 環境建議確保 await 執行完畢
    await client.replyMessage(event.replyToken, messages);
  } else {
    const echo = { type: 'text', text: msg };
    // 【修改點】把註解拿掉，這樣傳送一般訊息才會回聲
    await client.replyMessage(event.replyToken, echo);
  }
}

// 【修改點】註解或刪除原本的 app.listen
// const port = process.env.PORT || 3000;
// app.listen(port, () => {
//   console.log(`listening on ${port}`);
// });

// 【修改點】將 app 匯出，這是 Vercel 運行 Express 的必備條件
export default app;