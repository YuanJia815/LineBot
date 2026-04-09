import dotenv from 'dotenv'
import express from 'express'
import line from '@line/bot-sdk'
import mqtt from 'mqtt'
import axios from 'axios'

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

  if (data?.isLineUser || false) {//==================== 來自 Line User 的動作
    if (data.userId != userId) {
      await lineClient.pushMessage(data.userId, flexMessage(data.action, "Name", data.displayName, "Time", data.time));
    }
    await lineClient.pushMessage(userId, flexMessage(data.action, "Name", data.displayName, "UserId", data.userId));
  }
  else {//=================================== 來自apple shortcuts的動作
    const location = data.location
      .replace(/\n/g, ' ').replace(/\b\d{3,6}\b/g, '')
      .replace(/\s+/g, ' ').trim();

    await lineClient.pushMessage(userId, flexMessage(data.action, "Device", data.deviceName, "Place", location));
  }

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
      const actions = {
        "action=open": "開 鐵門",
        "action=close": "關 鐵門",
        "action=stop": "鐵門 暫停"
      }

      const userInfo = {
        isLineUser: true,
        action: actions[data] || "未知動作",
        userId: userId,
        displayName: await getUserProfileName(userId),
        time: await getNowTime()
      }
      switch (data) {
        case "action=open":
          client.publish("gate/open", userInfo)
          break
        case "action=close":
          client.publish("gate/close", userInfo)
          break
        case "action=stop":
          client.publish("gate/stop", userInfo)
          break
        default:
          throw new Error("Invalid action")
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
// await lineClient.pushMessage(userId, {
//   type: 'text',
//   text: `[ ${topic} ]  Device: ${data.deviceName}\nAction: ${data.action}\n${location}`
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

//===================================== Get User Profile =====================================//
async function getUserProfileName(userId) {
  const res = await axios.get(
    `https://api.line.me/v2/bot/profile/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  return res.data.displayName;
}
//===================================== Rich Menu Setup =====================================//
async function flexMessage(title, item1, info1, item2, info2) {
  return {
    type: "flex",
    altText: `${title}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: `${title}`,
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
                    text: `${item1}`,// 固定文字
                    color: "#aaaaaa",
                    size: "xs",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${info1}`,
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
                    text: `${item2}`,// 固定文字
                    color: "#aaaaaa",
                    size: "xs",
                    flex: 1
                  },
                  {
                    type: "text",
                    text: `${info2}`,
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
  };
}

//===================================== Get Now Time =====================================//
async function getNowTime() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" })
  );

  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')
    }/${String(now.getDate()).padStart(2, '0')
    }  ${String(now.getHours()).padStart(2, '0')
    }:${String(now.getMinutes()).padStart(2, '0')
    }`;
}