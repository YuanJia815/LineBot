import dotenv from 'dotenv';
import express from 'express';
import line from '@line/bot-sdk';
import serverless from 'serverless-http';

dotenv.config();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);
const app = express();

app.use(express.json()); // 確保能解析 JSON

app.post('/callback', line.middleware(config), async (req, res) => {
  try {
    const result = await Promise.all(req.body.events.map(handleEvent));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return null;
  }

  const msg = event.message.text;

  if (msg.includes('test')) {
    const messages = [];
    for (let i = 1; i <= 3; i++) {
      messages.push({ type: 'text', text: i.toString() });
    }
    return client.replyMessage(event.replyToken, messages);
  } else {
    return client.replyMessage(event.replyToken, { type: 'text', text: msg });
  }
}

// ✅ Serverless export
export default serverless(app);