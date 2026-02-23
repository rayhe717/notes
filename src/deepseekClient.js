// DeepSeek direct API configuration (browser -> DeepSeek)
// NOTE: For personal/local use only. This keeps your key in the frontend bundle.
// Some environments may still block this with CORS; if that happens,
// you'll need a small proxy (server.js) or to host one elsewhere.

export const DEEPSEEK_API_KEY = "sk-0a383d9dc86d490ea0a38c0409a0057e";

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions";
const DEEPSEEK_MODEL = "deepseek-chat";

export async function generateWithDeepSeek(systemPrompt, userContent) {
  if (!DEEPSEEK_API_KEY || DEEPSEEK_API_KEY === "PASTE_YOUR_API_KEY_HERE") {
    throw new Error("Missing DeepSeek API key. Please set DEEPSEEK_API_KEY in src/deepseekClient.js.");
  }

  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    stream: false
  };

  const response = await fetch(DEEPSEEK_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`DeepSeek API error (${response.status}): ${text || response.statusText}`);
  }

  const json = await response.json();
  const choice = json.choices && json.choices[0];
  const content = choice?.message?.content;

  if (!content) {
    throw new Error("DeepSeek API returned an unexpected response format.");
  }

  return content;
}

