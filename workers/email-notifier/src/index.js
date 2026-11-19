const RECIPIENT = "hoodfarmer202@gmail.com";
const SENDER = "website@notify.dahoodfarmer.com";

const SUBJECTS = {
  contact: "New website contact inquiry",
  booking: "New website booking request",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function cleanFields(type, fields) {
  const allowed = type === "contact"
    ? ["name", "email", "subject", "message"]
    : ["name", "email", "organization", "inquiry_type", "preferred_date", "details"];
  if (!fields || typeof fields !== "object" || Array.isArray(fields)) return null;
  const clean = {};
  for (const key of allowed) {
    if (fields[key] !== undefined && fields[key] !== null) {
      if (typeof fields[key] !== "string") return null;
      clean[key] = fields[key].trim().slice(0, key === "message" || key === "details" ? 5000 : 254);
    }
  }
  if (!clean.name || !clean.email) return null;
  return clean;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "POST") return json({ sent: false, error: "Method not allowed" }, 405);
    if (url.pathname !== "/notify") return json({ sent: false, error: "Not found" }, 404);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ sent: false, error: "Invalid JSON" }, 400);
    }

    const type = payload && payload.type;
    if (!Object.prototype.hasOwnProperty.call(SUBJECTS, type)) {
      return json({ sent: false, error: "Unsupported notification type" }, 400);
    }

    const fields = cleanFields(type, payload.fields);
    if (!fields) return json({ sent: false, error: "Invalid notification fields" }, 422);

    const replyTo = typeof payload.replyTo === "string" &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.replyTo) &&
      payload.replyTo.length <= 254
      ? payload.replyTo
      : undefined;

    const rows = Object.entries(fields).map(([key, value]) =>
      "<tr><th align=\"left\" style=\"padding:8px;border-bottom:1px solid #ddd\">" +
      escapeHtml(key.replace(/_/g, " ")) +
      "</th><td style=\"padding:8px;border-bottom:1px solid #ddd\">" +
      escapeHtml(value) + "</td></tr>"
    ).join("");

    const textBody = Object.entries(fields)
      .map(([key, value]) => key.replace(/_/g, " ") + ": " + value)
      .join("\n");

    try {
      const result = await env.EMAIL.send({
        from: SENDER,
        to: RECIPIENT,
        replyTo,
        subject: SUBJECTS[type],
        text: SUBJECTS[type] + "\n\n" + textBody,
        html: "<div style=\"font-family:Arial,sans-serif\"><h2>" +
          escapeHtml(SUBJECTS[type]) +
          "</h2><table style=\"border-collapse:collapse;width:100%\">" +
          rows + "</table></div>",
      });
      return json({ sent: true, messageId: result.messageId });
    } catch (error) {
      // Do not log submitted names, email addresses, message text, or IP addresses.
      console.error("Email notification delivery failed:", error && error.code ? error.code : "unknown");
      return json({ sent: false, error: "Notification delivery unavailable" }, 503);
    }
  },
};
