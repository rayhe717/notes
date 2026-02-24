// DeepSeek local-proxy configuration (browser -> local proxy -> DeepSeek).
// This avoids CORS issues and keeps the API key out of the frontend bundle.
const PROXY_URL = "http://127.0.0.1:8787/chat";
const DEEPSEEK_MODEL = "deepseek-chat";

export async function generateWithDeepSeek(systemPrompt, userContent) {
  const body = {
    model: DEEPSEEK_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ],
    stream: false
  };

  let response;
  try {
    response = await fetch(PROXY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
  } catch (err) {
    throw new Error(
      "Failed to reach the local DeepSeek proxy. Start it with `npm run dev:all` (or `npm run proxy`) and ensure it is listening on 127.0.0.1:8787."
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `DeepSeek proxy/API error (${response.status}): ${text || response.statusText}`
    );
  }

  const json = await response.json();
  const choice = json.choices && json.choices[0];
  const content = choice?.message?.content;

  if (!content) {
    throw new Error("DeepSeek API returned an unexpected response format.");
  }

  return content;
}

