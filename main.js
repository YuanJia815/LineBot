import dotenv from 'dotenv'
import express from 'express'
import line from '@line/bot-sdk'
import mqtt from 'mqtt'

dotenv.config();
const app = express();
app.use(express.json());
//===================================== MQTT Setup =====================================//
const mqttClient = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  port: 8883,
});
mqttClient.on("connect", () => {
  console.log("MQTT connected");
  mqttClient.publish("gate/control", "open");
});
mqttClient.on('reconnect', () => {
  console.log('🔄 reconnecting...');
});
mqttClient.on("error", (err) => {
  console.log("MQTT error:", err);
});
//===================================== HTTP API Setup =====================================//
app.get('/test', (req, res) => {
  res.send('人生就像泡麵三分鐘熱度然後後悔又開始懷疑');
});

app.post('/gate/control', (req, res) => {
  const { action } = req.body;

  if (!mqttClient.connected) {
    return res.status(500).send('MQTT not connected');
  }

  if (!["open", "close", "stop"].includes(action)) {
    return res.status(400).send('Invalid action');
  }

  mqttClient.publish('gate/control', action);

  res.send(`
    <h1 style="font-size:50px;">Gate ${action}</h1>
  `);
});
//===================================== Line Bot =====================================//
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const lineClient = new line.Client(config);

app.post('/callback', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});
//--------------------------------- event handler
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
    await lineClient.replyMessage(event.replyToken, messages);
  }
  else if (msg.includes('open')) {
    mqttClient.publish('gate/control', 'open');
    const echo = { type: 'text', text: 'Gate opened!' };
    await lineClient.replyMessage(event.replyToken, echo);
  }
  else {
    const echo = { type: 'text', text: msg };
    //return lineClient.replyMessage(event.replyToken, echo);
  }
}

//===================================== Start Server =====================================//
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
