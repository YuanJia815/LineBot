import express from 'express'
import line from '@line/bot-sdk'
import { reply } from './line.js';

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
  res.sendStatus(200);
});

app.post('/callback', async (req, res) => {
  const events = req.body.events || [];
  const replies = events
    .filter(({ type }) => type === 'message')
    .map(({ replyToken, message }) => reply({
      replyToken,
      messages: [
        {
          type: 'text',
          text: message.text,
        },
      ],
    }));
  await Promise.all(replies);
  res.sendStatus(200);
});

export default app;

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

