export default async function handler(req, res) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  if (!botToken || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: "Missing environment variables"
    });
  }

  // Health check
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Hospital bot is running"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const message = req.body?.message;

  if (!message?.chat?.id) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = (message.text || "").trim();

  // Telegram reply helper
  async function sendMessage(reply) {
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
  }

  // /start
  if (text === "/start") {
    await sendMessage(
      "🏥 Welcome to Millat Nursing Home!\n\n" +
      "I can help you with:\n\n" +
      "👨‍⚕️ Doctor information\n" +
      "🕐 Doctor timings\n" +
      "📅 Appointment information\n" +
      "🏥 Departments\n\n" +
      "Try asking:\n" +
      "\"Dr. Imran Hafizi timing\""
    );

    return res.status(200).json({ ok: true });
  }

  // Search doctors
  const searchText = text
    .replace(/doctor/gi, "")
    .replace(/dr\./gi, "")
    .replace(/dr/gi, "")
    .replace(/timing/gi, "")
    .replace(/timings/gi, "")
    .trim();

  const doctorUrl =
    `${supabaseUrl}/rest/v1/doctors` +
    `?select=id,name,qualification,department_id` +
    `&name=ilike.*${encodeURIComponent(searchText)}*` +
    `&limit=5`;

  const doctorResponse = await fetch(doctorUrl, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`
    }
  });

  const doctors = await doctorResponse.json();

  if (!Array.isArray(doctors) || doctors.length === 0) {
    await sendMessage(
      "Sorry, I couldn't find that doctor. 😕\n\n" +
      "Try the doctor's name, for example:\n" +
      "\"Dr. Imran Hafizi\""
    );

    return res.status(200).json({ ok: true });
  }

  let reply = "🏥 Doctor Information\n\n";

  for (const doctor of doctors) {
    const scheduleUrl =
      `${supabaseUrl}/rest/v1/doctor_schedules` +
      `?select=day_of_week,start_time,visit_type` +
      `&doctor_id=eq.${doctor.id}` +
      `&order=id.asc`;

    const scheduleResponse = await fetch(scheduleUrl, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`
      }
    });

    const schedules = await scheduleResponse.json();

    reply += `👨‍⚕️ ${doctor.name}\n`;

    if (doctor.qualification) {
      reply += `🎓 ${doctor.qualification}\n`;
    }

    reply += "\n";

    if (Array.isArray(schedules) && schedules.length > 0) {
      reply += "🕐 Timings:\n";

      for (const s of schedules) {
        reply += `• ${s.day_of_week} — ${s.start_time} — ${s.visit_type}\n`;
      }
    } else {
      reply += "Timing information not available.\n";
    }

    reply += "\n";
  }

  await sendMessage(reply);

  return res.status(200).json({ ok: true });
}
