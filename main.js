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

  if (msg.includes('天氣')) {
    const weather = { type: 'text', text: 'https://www.cwb.gov.tw/V8/C/W/Town/Town.html?TID=6800900' };
    return client.replyMessage(event.replyToken, weather);
  }
  if (msg.includes('test')) {
    for (let i = 1; i <= 3; i++) {
      const m = { type: 'text', text: i.toString() }
      await client.replyMessage(event.replyToken, m);
    }
  }
  else if ( msg.length>1 && (msg.includes('?') || msg.includes('嗎'))) {
    const bubble = {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `${msg} ?`,
            margin: 'md',
          },
          {
            type: 'spacer',
          },
        ]
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'Yes',
              text: '是的',
            },
            height: 'sm',
          },
          {
            type: 'button',
            action: {
              type: 'message',
              label: 'No',
              text: '不',
            },
            height: 'sm',
          },
        ],
        flex: 0,
      },
      styles: {
        footer: {
          separator: true,
        },
      },
    };

    return client.replyMessage(event.replyToken, {
      type: 'flex',
      altText: 'Confirmation',
      contents: bubble,
    });
  }
  else{
    const echo = { type: 'text', text: msg };
    return client.replyMessage(event.replyToken, echo);
  }
}


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
