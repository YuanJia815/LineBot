import dotenv from 'dotenv'
import express from 'express'
import line from '@line/bot-sdk'
import axios from 'axios'

dotenv.config()

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const client = new line.Client(config);

const app = express();

app.post('/callback', line.middleware(config), (req, res) => {
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
    await client.replyMessage(event.replyToken, messages);
  }
  else {
    const echo = { type: 'text', text: msg };
    //return client.replyMessage(event.replyToken, echo);
  }
}

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
