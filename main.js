import dotenv from 'dotenv'
import express from 'express'
import line from '@line/bot-sdk'
import mqtt from 'mqtt'

dotenv.config();
const app = express();

//===================================== MQTT Setup =====================================//
const mqttClient = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  port: 8883,
});
mqttClient.on("connect", () => {
  mqttClient.subscribe('gate/status');
  mqttClient.subscribe('button/status');
  console.log("MQTT connected");
});
mqttClient.on('reconnect', () => { console.log('🔄 reconnecting...'); });
mqttClient.on("error", (err) => { console.log("MQTT error:", err); });

//===================================== MQTT Message Handler =====================================//
mqttClient.on("message", async (topic, message) => {
  const msg = message.toString();

  let data;
  try {
    data = JSON.parse(msg);
  } catch (err) {
    console.error("JSON parse error:", msg);
    return;
  }

  const userId = process.env.USER_ID;// 從環境變數讀取 userId
  if (!userId) return;

  const location = data.location
    .replace(/\n/g, ' ')
    .replace(/\b\d{3,6}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // await lineClient.pushMessage(userId, {
  //   type: 'text',
  //   text: `[ ${topic} ]  Device: ${data.deviceName}\nAction: ${data.action}\n${location}`
  // });
  await lineClient.pushMessage(userId, {
    type: "flex",
    altText: `${data.action}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${data.action}`,
            weight: "bold",
            size: "xl"
          },
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            spacing: "sm",
            contents: [
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Device",
                    color: "#aaaaaa",
                    size: "xs",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${data.deviceName}`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5
                  }
                ]
              },
              {
                type: "box",
                layout: "baseline",
                spacing: "sm",
                contents: [
                  {
                    type: "text",
                    text: "Place",
                    color: "#aaaaaa",
                    size: "xs",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${location}`,
                    wrap: true,
                    color: "#666666",
                    size: "sm",
                    flex: 5
                  }
                ]
              }
            ]
          }
        ]
      },
      styles: {
        body: {
          backgroundColor: "#d5e1e1"
        }
      }
    }
  });

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
    //====================================== 文字訊息處理 =====================================//
    if (event.type === 'message' && event.message.type === 'text') {
      const msg = event.message.text;

      if (msg.includes('test')) {
        const messages = Array.from({ length: 3 }, (_, i) => ({
          type: 'text',
          text: (i + 1).toString()
        }));
        return lineClient.replyMessage(event.replyToken, messages);
      }
      if (msg.includes('open')) {
        const userId = event.source.userId;
        mqttClient.publish('gate/open', '');
        return
      }
      if (msg.includes('close')) {
        const userId = event.source.userId;
        mqttClient.publish('gate/close', '');
        return
      }
      return Promise.resolve(null);
    }

    //====================================== Postback 事件處理 =====================================//
    if (event.type === 'postback') {
      const userId = event.source.userId;
      const data = event.postback.data;
      console.log("postback:", data);

      if (data === "action=open") {
        return  lineClient.pushMessage(userId, { type: 'text', text: data });
      }

      if (data === "action=stop") {
        return  lineClient.pushMessage(userId, { type: 'text', text: data });
      }

      if (data === "action=close") {
        return  lineClient.pushMessage(userId, { type: 'text', text: data });
      }
    }

    return Promise.resolve(null);
  } catch (err) {
    console.error("handleEvent error:", err);
    return Promise.resolve(null); // 避免整個 webhook 爆掉
  }
}

// return lineClient.replyMessage(event.replyToken, {
//   type: 'text',
//   text: msg
// });

// 主動發送
async function pushMessage(userId, text) {
  await lineClient.pushMessage(userId, {
    type: 'text',
    text: text
  });
}
//===================================== Start Server =====================================//
const port = process.env.PORT || 3000;
app.get('/', (req, res) => {
  res.send('oK');
});
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
