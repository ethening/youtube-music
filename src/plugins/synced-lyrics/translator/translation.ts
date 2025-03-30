interface OpenRouterResponse {
  choices: Array<{
    finish_reason: string | null;
    message: {
      content: string;
      role: string;
    };
  }>;
}

export async function translateBatch(
  openRouterApiKey: string | undefined,
  lines: string[],
): Promise<
  Array<{
    translation: string;
    learningItems: Array<{
      word: string;
      meaning: string;
    }>;
  }>
> {
  if (!openRouterApiKey) {
    throw new Error('OpenRouter API key not configured');
  }

  const prompt = `# 指令

請扮演一個日語翻譯機器。你的任務是處理以下提供的歌詞文本：

1.  **判斷** 每一行文本 是否為日文歌詞。
2.  **對於每一行日文歌詞**：
    *   將其翻譯成 **繁體中文**。翻譯應力求自然流暢，符合歌詞語境。
    *   從中為日語學習者挑選出 **0 到 2 個** 值得學習的 **重點詞彙或短語**（學習點）。
    *   每個學習點應包含：
        *   word: 日文原文，並附上讀音（例如：大声（おおごえ） 或 笑い飛ばそう（わらいとばそう））。
        *   meaning: 該詞彙/短語的繁體中文意思，以及簡要解釋（例如說明其常見用法、語氣、構成或文化意涵）。解釋需精煉且有助於學習。
    *   例：
        *   歌詞：波に乗る この声が 掻き消されていく
        *   翻譯：乘著波浪，這聲音漸漸被抹去
        *   學習點：
            *   word: 波に乗る（なみにのる）
            *   meaning: 乘浪，比喻隨波逐流的感覺。  
        *   學習點：
            *   word: 掻き消されていく（かきけされていく）
            *   meaning: 「被抹去」「漸漸消失」，被動態+進行形，描述聲音消散的過程。
    *   例：
        *   歌詞：いつかこんな日々が ただしくなる
        *   翻譯：總有一天，這樣的日子會變得理所當然  
        *   學習點：
            *   word: ただしくなる
            *   meaning: 變得理所當然，「ただしい」+「なる」的變化。
3.  **如果某行不是日文歌詞**：
    *   該行翻譯 (translation) 欄位應為空字串，學習點 (learningItems) 欄位應為 **空陣列** ([])。

4.  **輸出格式**：請嚴格按照以下 JSON 格式回覆，** 不 ** 要加任何 MARKDOWN 格式符號，每行文本都必須翻譯：
{
  "translations": [
    {
      "translation": "第一行的翻譯",
      "learningItems": [
        {
          "word": "日文詞彙/短語 (含讀音)",
          "meaning": "繁體中文意思與簡要解釋"
        }
      ]
    },
    // ... 其他行的翻譯
  ]
}

待處理歌詞（每行以數字標記）：

${lines.map((line, index) => `${index + 1}. ${line}`).join('\n')}
`;
  const response = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openRouterApiKey}`,
      },
      body: JSON.stringify({
        models: ['google/gemini-2.0-flash-001', 'liquid/lfm-3b'],
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Translation API error: ${response.statusText}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  const content = data.choices[0].message.content;

  try {
    // Remove markdown formatting if present
    const cleanContent = content.replace(/^```(?:json)?\n|\n```$/g, '').trim();
    const parsed = JSON.parse(cleanContent) as {
      translations: Array<{
        translation: string;
        learningItems: Array<{
          word: string;
          meaning: string;
        }>;
      }>;
    };
    return parsed.translations;
  } catch {
    console.warn(
      'Failed to parse translation response, finish_reason:',
      data.choices[0].finish_reason,
      'content:',
      content,
    );
    throw new Error('Failed to parse translation response');
  }
}
