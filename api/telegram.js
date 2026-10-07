export default async function handler(req, res) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return res.status(500).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is missing"
    });
  }

  // 1. Setup Telegram webhook
  if (req.method === "GET" && req.query?.setup === "1") {
    const host = req.headers.host;
    const protocol = host?.includes("localhost") ? "http" : "https";
    const webhookUrl = `${protocol}://${host}/api/telegram`;

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: webhookUrl
        })
      }
    );

    const result = await response.json();

    return res.status(200).json({
      webhookUrl,
      telegram: result
    });
  }

  // 2. Normal health check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Hospital Telegram Bot is running 🏥"
    });
  }

  // 3. Telegram sends messages here
  if (req.method === "POST") {
    const message = req.body?.message;

    if (!message?.chat?.id) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text || "";

    let reply;

    if (text === "/start") {
      reply =
        "🏥 Welcome to Millat Nursing Home!\n\n" +
        "How can I help you today?\n\n" +
        "You can ask me about doctors, departments, timings and appointments.";
    } else {
      reply =
        `🏥 Millat Nursing Home\n\n` +
        `You asked: ${text}\n\n` +
        `I'm currently being set up. Soon I will be able to help you with doctor timings and appointments.`;
    }

    await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: reply
        })
      }
    );

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({
    ok: false,
    error: "Method not allowed"
  });
}
