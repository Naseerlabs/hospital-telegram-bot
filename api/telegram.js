export default async function handler(req, res) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;

  // --------------------------------------------------
  // Check environment variables
  // --------------------------------------------------

  if (!botToken || !supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      ok: false,
      error: "Missing environment variables"
    });
  }

  // --------------------------------------------------
  // GET = health check
  // --------------------------------------------------

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Hospital bot is running"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  // --------------------------------------------------
  // Get Telegram message
  // --------------------------------------------------

  const message = req.body?.message;

  if (!message?.chat?.id) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = String(message.text || "").trim();

  // --------------------------------------------------
  // Telegram send message helper
  // --------------------------------------------------

  async function sendMessage(reply) {
    const response = await fetch(
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

    return response.json();
  }

  // --------------------------------------------------
  // /start
  // --------------------------------------------------

  if (text === "/start") {
    await sendMessage(
      "🏥 Welcome to Millat Nursing Home!\n\n" +
      "I can help you with:\n\n" +
      "👨‍⚕️ Doctor information\n" +
      "🕐 Doctor timings\n" +
      "🏥 Departments\n" +
      "📅 Appointment information\n\n" +
      "Try asking:\n" +
      "• Dr. Imran Hafizi\n" +
      "• Dr. Imran Hafizi timing\n" +
      "• Cardiology doctors\n" +
      "• Doctor timings"
    );

    return res.status(200).json({ ok: true });
  }

  // --------------------------------------------------
  // Clean search text
  // --------------------------------------------------

  const searchText = text
    .replace(/\bdoctor\b/gi, "")
    .replace(/\bdoctors\b/gi, "")
    .replace(/\bdr\.\b/gi, "")
    .replace(/\bdr\b/gi, "")
    .replace(/\btiming\b/gi, "")
    .replace(/\btimings\b/gi, "")
    .replace(/\btime\b/gi, "")
    .trim();

  // --------------------------------------------------
  // If nothing remains
  // --------------------------------------------------

  if (!searchText) {
    await sendMessage(
      "Please tell me the doctor's name.\n\n" +
      "For example:\n" +
      "Dr. Imran Hafizi"
    );

    return res.status(200).json({ ok: true });
  }

  // --------------------------------------------------
  // Supabase helper
  // --------------------------------------------------

  async function supabaseFetch(path) {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/${path}`,
      {
        method: "GET",
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: "application/json"
        }
      }
    );

    const data = await response.json();

    return {
      ok: response.ok,
      status: response.status,
      data
    };
  }

  // --------------------------------------------------
  // Search doctors
  // --------------------------------------------------

  const doctorQuery =
    `doctors?select=id,name,qualification,department_id` +
    `&name=ilike.*${encodeURIComponent(searchText)}*` +
    `&limit=10`;

  const doctorResult = await supabaseFetch(doctorQuery);

  // --------------------------------------------------
  // Supabase doctor query error
  // --------------------------------------------------

  if (!doctorResult.ok) {
    console.error("SUPABASE DOCTOR ERROR:", doctorResult);

    await sendMessage(
      "⚠️ I couldn't access the doctor database right now.\n\n" +
      "Please try again in a moment."
    );

    return res.status(200).json({
      ok: false,
      error: "Doctor database query failed",
      supabaseStatus: doctorResult.status
    });
  }

  const doctors = Array.isArray(doctorResult.data)
    ? doctorResult.data
    : [];

  // --------------------------------------------------
  // No doctor found
  // --------------------------------------------------

  if (doctors.length === 0) {
    await sendMessage(
      `🔎 I couldn't find a doctor matching "${searchText}".\n\n` +
      "Please try the full name.\n\n" +
      "Example:\n" +
      "Dr. Imran Hafizi"
    );

    return res.status(200).json({ ok: true });
  }

  // --------------------------------------------------
  // Build response
  // --------------------------------------------------

  let reply = "🏥 Millat Nursing Home\n\n";

  for (const doctor of doctors) {
    reply += `👨‍⚕️ ${doctor.name}\n`;

    if (doctor.qualification) {
      reply += `🎓 ${doctor.qualification}\n`;
    }

    // ----------------------------------------------
    // Get department
    // ----------------------------------------------

    if (doctor.department_id) {
      const departmentResult = await supabaseFetch(
        `departments?select=id,name&id=eq.${doctor.department_id}&limit=1`
      );

      if (
        departmentResult.ok &&
        Array.isArray(departmentResult.data) &&
        departmentResult.data.length > 0
      ) {
        reply += `🏥 Department: ${departmentResult.data[0].name}\n`;
      }
    }

    reply += "\n";

    // ----------------------------------------------
    // Get doctor schedule
    // ----------------------------------------------

    const scheduleResult = await supabaseFetch(
      'doctor_schedules?select=day_of_week,start_time,visit_type,notes' +
      `&doctor_id=eq.${doctor.id}` +
      `&order=id.asc`
    );

    if (
      scheduleResult.ok &&
      Array.isArray(scheduleResult.data) &&
      scheduleResult.data.length > 0
    ) {
      reply += "🕐 Timings:\n";

      for (const schedule of scheduleResult.data) {
        let timing = `• ${schedule.day_of_week}`;

        if (schedule.start_time) {
          timing += ` — ${schedule.start_time}`;
        }

        if (schedule.end_time) {
          timing += ` to ${schedule.end_time}`;
        }

        reply += `${timing}\n`;

        if (schedule.notes) {
          reply += `  📝 ${schedule.notes}\n`;
        }
      }
    } else {
      reply += "🕐 Timing information is not available yet.\n";
    }

    reply += "\n";
  }

  // --------------------------------------------------
  // Send final response
  // --------------------------------------------------

  await sendMessage(reply);

  return res.status(200).json({
    ok: true
  });
}
