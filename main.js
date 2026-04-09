import dotenv from 'dotenv'
import express from 'express'
import line from '@line/bot-sdk'
import mqtt from 'mqtt'
import axios from 'axios'
/*

 */
dotenv.config();
const app = express();

//========================= MQTT connection =====================//
const mqttClient = mqtt.connect(process.env.MQTT_URL, {
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  port: 8883,
});

mqttClient.on("connect", () => {
  console.log("✅ MQTT connected");
  mqttClient.subscribe('gate/status');
  mqttClient.subscribe('button/status');
});

mqttClient.on("error", (err) => {
  console.error("❌ MQTT error:", err);
});

//===================================== Message Queue =====================================//
const messageQueue = [];
let isSending = false;

function enqueueMessage(userId, message) {
  messageQueue.push({ userId, message });
  processQueue();
}

async function processQueue() {
  if (isSending) return;
  isSending = true;

  while (messageQueue.length > 0) {
    const { userId, message } = messageQueue.shift();

    try {
      await lineClient.pushMessage(userId, message);
      await new Promise(r => setTimeout(r, 200)); // ⬅️ 限速
    } catch (err) {
      console.error("pushMessage error:", err.message);
    }
  }
  isSending = false;
}
//======================== MQTT 接收 =====================//
mqttClient.on("message", async (topic, message) => {
  const msg = message.toString();
  console.log("📩 MQTT:", topic, msg);

  let data;
  try {
    data = JSON.parse(msg);
  } catch {
    console.error("JSON parse error");
    return;
  }

  const userId = process.env.USER_ID;
  if (!userId) return;

  try {
    if (data?.isLineUser) {
      // 來自 LINE 使用者
      if (data.userId !== userId) {
        enqueueMessage(userId, flexMessage(safe(data.action), "Name", safe(data.displayName), "Time", safe(data.time)));
      }

      enqueueMessage(userId, flexMessage(safe(data.action), "Name", safe(data.displayName), "UserId", safe(data.userId)));

    } else {
      // 來自 Shortcut
      const location = (data.location || "")
        .replace(/\n/g, ' ')
        .replace(/\b\d{3,6}\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      await lineClient.pushMessage(userId,
        flexMessage(safe(data.action), "Device", safe(data.deviceName), "Place", safe(location))
      );
    }
  } catch (err) {
    console.error("pushMessage error:", err);
  }
});
const safe = (v) => v ? String(v) : "-";
//================ LINE BOT =================//
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const lineClient = new line.Client(config);

app.post('/callback', line.middleware(config), async (req, res) => {
  try {
    await Promise.all(req.body.events.map(handleEvent));
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

//================ 處理事件 =================//
const userCooldown = new Map();
const COOLDOWN_TIME = 2000; // 2 秒

async function handleEvent(event) {
  const userId = event.source.userId;
  const now = Date.now();

  if (userCooldown.has(userId)) {// 如果有紀錄，檢查時間
    const lastTime = userCooldown.get(userId);

    if (now - lastTime < COOLDOWN_TIME) {
      console.log("⚠️ 點太快，忽略");
      return;
    }
  }
  userCooldown.set(userId, now); // 更新時間

  //========== 訊息事件 ==========
  if (event.type === 'message' && event.message.type === 'text') {
    const msg = event.message.text.toLowerCase();
    const userId = event.source.userId;

    if (msg.includes('test')) {
      const messages = Array.from({ length: 3 }, (_, i) => ({
        type: 'text',
        text: (i + 1).toString()
      }));
      return lineClient.replyMessage(event.replyToken, messages);
    }

    return Promise.resolve(null);
  }

  //========== Postback ==========
  if (event.type === 'postback') {
    const userId = event.source.userId;
    const data = event.postback.data;

    const actionMap = {
      "action=open": "開 鐵門",
      "action=close": "關 鐵門",
      "action=stop": "暫停 鐵門"
    };

    const actionKey = data.split("=")[1];

    const userInfo = {
      isLineUser: true,
      action: actionMap[data] || "未知",
      userId,
      displayName: await getUserProfileName(userId),
      time: await getNowTime()
    };

    // ✅ 正確 publish
    mqttClient.publish(`gate/${actionKey}`, JSON.stringify(userInfo));
  }
}

//================ Server =================//
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK'));

app.listen(port, () => {
  console.log(`🚀 Server running on ${port}`);
});

//================ 工具 =================//
async function getUserProfileName(userId) {
  try {
    const res = await axios.get(
      `https://api.line.me/v2/bot/profile/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CHANNEL_ACCESS_TOKEN}`
        }
      }
    );
    return res.data.displayName;
  } catch {
    return "Unknown";
  }
}
//===================================== Rich Menu Setup =====================================//
function flexMessage(title, item1, info1, item2, info2) {
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
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Taipei" }));
  return `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}