import { GoogleGenAI } from "npm:@google/genai";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  try {
    const { todos, date, weekday, memo, schedule } = await req.json();

    if (!Array.isArray(todos) || todos.length < 2) {
      return json({ error: "정렬할 할 일이 부족해요" }, 400);
    }

    const prompt = `오늘은 ${date} ${weekday}요일입니다.
아래 할 일을 중요도와 순서를 고려해 가장 먼저 해야 할 것부터 정렬하세요.

할 일:
${todos.map((t: any) => `${t.id}: ${t.text}`).join("\n")}

메모: ${memo || "(없음)"}
다가오는 일정: ${
      Array.isArray(schedule) && schedule.length
        ? schedule.map((s: any) => `${s.date} ${s.text}`).join(", ")
        : "(없음)"
    }

JSON만 출력하세요. 설명이나 코드블록 표시 없이.
{"order":[{"id":"...","reason":"한 줄 이유"}]}`;

    const ai = new GoogleGenAI({ apiKey: Deno.env.get("GEMINI_API_KEY")! });
    const res = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const parsed = JSON.parse(res.text ?? "{}");
    if (!Array.isArray(parsed.order)) return json({ error: "형식 오류" }, 502);

    return json({ order: parsed.order });
  } catch (e) {
    console.error(e);
    return json({ error: "우선순위를 가져오지 못했어요" }, 500);
  }
});
