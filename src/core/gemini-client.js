// Direct browser client for the Gemini API. The app has no backend, so every user brings
// their own API key (stored through ai-settings.js) and requests go straight to Google.

export const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class AiNotConfiguredError extends Error {
    constructor() {
        super('Add your Gemini API key in Preferences > AI to use this feature.');
        this.name = 'AiNotConfiguredError';
    }
}

const describeHttpError = (status, apiMessage) => {
    if (status === 400 && /api key/i.test(apiMessage)) return 'The Gemini API key is not valid.';
    if (status === 401 || status === 403) return 'The Gemini API key was rejected. Check the key in Preferences > AI.';
    if (status === 404) return 'The Gemini model was not found. Check the model name in Preferences > AI.';
    if (status === 429) return 'Gemini rate limit or quota reached. Try again later.';
    return apiMessage || `Gemini request failed (${status}).`;
};

const generateContent = async ({ apiKey, model, parts, json = false, tools = null, fetchImpl = fetch }) => {
    const key = `${apiKey || ''}`.trim();
    if (!key) throw new AiNotConfiguredError();
    const modelId = `${model || ''}`.trim() || DEFAULT_GEMINI_MODEL;

    const body = { contents: [{ role: 'user', parts }] };
    if (json) body.generationConfig = { responseMimeType: 'application/json' };
    if (Array.isArray(tools) && tools.length) body.tools = tools;

    const response = await fetchImpl(`${GEMINI_API_BASE}/models/${encodeURIComponent(modelId)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify(body)
    });

    let payload = null;
    try {
        payload = await response.json();
    } catch (_) {
        payload = null;
    }
    if (!response.ok) {
        throw new Error(describeHttpError(response.status, payload?.error?.message || ''));
    }

    const text = (payload?.candidates?.[0]?.content?.parts || [])
        .map((part) => part?.text || '')
        .join('')
        .trim();
    if (!text) {
        const reason = payload?.promptFeedback?.blockReason || payload?.candidates?.[0]?.finishReason || '';
        throw new Error(reason ? `Gemini returned no text (${reason}).` : 'Gemini returned no text.');
    }
    return text;
};

const BAG_FIELDS = ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType', 'tasteNotes'];
const TASTE_NOTES_RULE = 'tasteNotes is the flavour or tasting notes the roaster gives (for example "violet, honeysuckle, bergamot, white peach"), as a short comma-separated list in the language of the source.';
const BAG_PROMPT = [
    'You are a coffee expert.',
    'Look at this image of a coffee bag and extract the following information.',
    `Return ONLY a JSON object with these keys: ${BAG_FIELDS.join(', ')}.`,
    "For roastType, choose only from: 'Ultralight', 'Light', 'Medium', 'Medium-Dark', 'Dark' (Ultralight for very light, Nordic-style or 'ultra light' roasts).",
    TASTE_NOTES_RULE,
    'If a field is not found, use an empty string.'
].join(' ');

export const analyzeCoffeeBag = async ({ apiKey, model, base64Image, mimeType = 'image/jpeg', fetchImpl }) => {
    if (!base64Image) throw new Error('No image provided.');
    const text = await generateContent({
        apiKey,
        model,
        json: true,
        fetchImpl,
        parts: [{ text: BAG_PROMPT }, { inlineData: { mimeType, data: base64Image } }]
    });
    return parseBagFields(text, 'Gemini returned an unreadable answer for this bag. Try another photo.');
};

// Reads the JSON object with the bag fields out of Gemini's answer (also when it is
// wrapped in a code block or surrounded by other text).
const parseBagFields = (text, unreadableMessage, fields = BAG_FIELDS) => {
    const cleaned = `${text || ''}`.replace(/```json|```/g, '').trim();
    let parsed = null;
    try {
        parsed = JSON.parse(cleaned);
    } catch (_) {
        const match = cleaned.match(/\{[\s\S]*\}/);
        try {
            parsed = match ? JSON.parse(match[0]) : null;
        } catch (__) {
            parsed = null;
        }
    }
    if (!parsed) throw new Error(unreadableMessage);
    if (Array.isArray(parsed)) parsed = parsed[0];
    const source = parsed && typeof parsed === 'object' ? parsed : {};
    const result = {};
    fields.forEach((field) => {
        result[field] = typeof source[field] === 'string' ? source[field].trim() : '';
    });
    return result;
};

const URL_PROMPT = [
    'You are a coffee expert.',
    'Read the web page at the URL below (for example a roaster\'s shop page for one coffee)',
    'and extract the information about that coffee.',
    `Return ONLY a JSON object with these keys: ${[...BAG_FIELDS, 'imageUrl'].join(', ')}.`,
    'roaster is the roasting company, farmer is the farm, producer, washing station or blend name.',
    "For roastType, choose only from: 'Ultralight', 'Light', 'Medium', 'Medium-Dark', 'Dark' (Ultralight for very light, Nordic-style or 'ultra light' roasts).",
    TASTE_NOTES_RULE,
    'imageUrl is the full address of the main product photo of this coffee on the page (for example its og:image).',
    'If a field is not found, use an empty string.'
].join(' ');

// The browser cannot fetch other sites (CORS), so Gemini reads the page itself with its
// URL context tool. That tool cannot be combined with JSON mode, so the JSON is parsed from text.
export const analyzeCoffeeBagUrl = async ({ apiKey, model, url, fetchImpl }) => {
    const pageUrl = `${url || ''}`.trim();
    if (!/^https?:\/\//i.test(pageUrl)) throw new Error('Enter a web address that starts with http:// or https://.');
    const text = await generateContent({
        apiKey,
        model,
        fetchImpl,
        tools: [{ url_context: {} }],
        parts: [{ text: `${URL_PROMPT}\n\nURL: ${pageUrl}` }]
    });
    return parseBagFields(text, 'Gemini could not read coffee details from this page. Try another URL.', [...BAG_FIELDS, 'imageUrl']);
};

export const analyzeBrewProfile = async ({ apiKey, model, brewData, userName, fetchImpl }) => {
    if (!brewData) throw new Error('No brew data provided.');
    const prompt = [
        `You are a world-class coffee sommelier for ${userName || 'Home Brewer'}.`,
        'Analyze the following coffee brew history.',
        '',
        'The data includes Roaster, Origin, Farmer, Processing method,',
        'Roast level, Brewing Method, Drink type, Rating, and Tasting Notes.',
        '',
        'Write a brief personality profile about their coffee habits.',
        "1. Identify their 'vibe' based on preferred methods, drinks, and roast levels.",
        '2. Mention specific flavor patterns from high-rated brews.',
        '3. Mention one or two top rated coffees with interesting details,',
        'such as processing and how they experienced it in notes.',
        '',
        'Keep the tone encouraging, professional, and concise.',
        '',
        'DATA:',
        brewData
    ].join('\n');
    return generateContent({ apiKey, model, fetchImpl, parts: [{ text: prompt }] });
};

export const testGeminiConnection = async ({ apiKey, model, fetchImpl }) => {
    await generateContent({ apiKey, model, fetchImpl, parts: [{ text: 'Reply with the single word OK.' }] });
    return true;
};
