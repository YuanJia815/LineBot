import dotenv from 'dotenv'
import express from 'express'
import line from '@line/bot-sdk'
import mqtt from 'mqtt'

dotenv.config();
const app = express();
//app.use(express.json());
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
  try {
    if (event.type !== 'message' || event.message.type !== 'text') {
      return Promise.resolve(null);
    }
    const msg = event.message.text;

    if (msg.includes('test')) {
      const messages = Array.from({ length: 3 }, (_, i) => ({
        type: 'text',
        text: (i + 1).toString()
      }));
      return lineClient.replyMessage(event.replyToken, messages);
    }

    if (msg.includes('open')) {
      mqttClient.publish('gate/control', 'open');

      return lineClient.replyMessage(event.replyToken, {
        type: 'text',
        text: 'Gate opened!'
      });
    }

    return lineClient.replyMessage(event.replyToken, {
      type: 'text',
      text: msg
    });
  } catch (err) {
    console.error("handleEvent error:", err);
    return Promise.resolve(null); // 避免整個 webhook 爆掉
  }
}

//===================================== Start Server =====================================//
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
