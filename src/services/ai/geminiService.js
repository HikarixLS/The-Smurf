/**
 * Gemini AI Service for The Smurf
 * Uses gemini-2.0-flash to parse user requests and extract movie search parameters.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const STREAM_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent';

/** System prompt for movie assistant */
const SYSTEM_PROMPT = `Bạn là trợ lý phim thông minh của The Smurf - một trang web xem phim tiếng Việt.
Nhiệm vụ của bạn là giúp người dùng tìm phim phù hợp từ kho phim OPHIM (chủ yếu phim Châu Á và phim Mỹ có phụ đề tiếng Việt).

Khi người dùng hỏi về phim, bạn PHẢI trả lời theo định dạng JSON sau:
{
  "message": "Câu trả lời thân thiện bằng tiếng Việt (1-2 câu ngắn gọn)",
  "searches": [
    { "keyword": "từ khóa tìm kiếm", "type": "series|single|hoathinh|tvshows|", "category": "slug-thể-loại", "country": "slug-quốc-gia", "year": 2024 }
  ],
  "suggestions": ["gợi ý 1", "gợi ý 2", "gợi ý 3"]
}

Các slug thể loại phổ biến: hanh-dong, tinh-cam, hai-huoc, kinh-di, vien-tuong, hinh-su, bi-an, chính-kich, phieu-luu, hoat-hinh
Các slug quốc gia: han-quoc, trung-quoc, nhat-ban, thai-lan, au-my, viet-nam, dai-loan

Quy tắc:
- Luôn trả về JSON hợp lệ, KHÔNG thêm markdown code block
- "searches" tối đa 2 item, đủ để tìm ra kết quả tốt
- Các trường trong searches là TÙY CHỌN, chỉ thêm nếu người dùng đề cập
- "suggestions" là 3 câu hỏi gợi ý ngắn mà người dùng có thể tiếp tục hỏi
- Nếu người dùng không hỏi về phim (ví dụ chào hỏi), trả về searches rỗng và trả lời thân thiện`;

/**
 * Parse movie search params from Gemini response
 */
const parseAIResponse = (text) => {
    try {
        // Clean markdown code fences if present
        const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
        return JSON.parse(cleaned);
    } catch {
        return { message: text, searches: [], suggestions: [] };
    }
};

/**
 * Get movie recommendations from Gemini
 * @param {Array} messages - Chat history [{role: 'user'|'model', parts: [{text}]}]
 * @returns {Promise<{message, searches, suggestions}>}
 */
export const getMovieRecommendations = async (messages) => {
    if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY_MISSING');
    }

    const contents = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: '{"message":"Xin chào! Tôi sẵn sàng giúp bạn tìm phim.","searches":[],"suggestions":["Gợi ý phim hành động hay","Phim Hàn Quốc lãng mạn","Phim kinh dị Nhật Bản"]}' }] },
        ...messages,
    ];

    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
    });

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return parseAIResponse(text);
};

/**
 * Stream Gemini response token-by-token
 * @param {Array} messages - Chat history
 * @param {Function} onChunk - Called with each text chunk
 * @returns {Promise<string>} - Full response text
 */
export const streamMovieChat = async (messages, onChunk) => {
    if (!API_KEY || API_KEY === 'your_gemini_api_key_here') {
        throw new Error('GEMINI_API_KEY_MISSING');
    }

    const contents = [
        { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
        { role: 'model', parts: [{ text: '{"message":"Xin chào! Tôi sẵn sàng giúp bạn tìm phim.","searches":[],"suggestions":["Gợi ý phim hành động hay","Phim Hàn Quốc lãng mạn","Phim kinh dị Nhật Bản"]}' }] },
        ...messages,
    ];

    const res = await fetch(`${STREAM_URL}?key=${API_KEY}&alt=sse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
        }),
    });

    if (!res.ok) throw new Error(`Gemini API error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
            try {
                const json = JSON.parse(line.slice(6));
                const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text) { full += text; onChunk(text); }
            } catch { /* skip malformed */ }
        }
    }
    return full;
};

export default { getMovieRecommendations, streamMovieChat };
