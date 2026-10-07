export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, message: "Hospital bot is running" });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const message = req.body?.message;

  if (!botToken || !message?.chat?.id) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text || "";

  const reply = `🏥 Millat Nursing Home\n\nYou said: ${text}`;

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: chatId,
      text: reply
    })
  });

  return res.status(200).json({ ok: true });
}
