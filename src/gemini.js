import { GoogleGenerativeAI } from "@google/generative-ai";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const safeJsonParse = (text) => {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
};

const buildImplyPrompt = (implyConfig) => {
    if (!implyConfig?.enabled) return "";
    return `\nIMPLY MODE ACTIVATED: Generate scenario-based questions that test application of knowledge, not just rote recall. Frame questions as real-world problems or applications.
Target Audience: Level: ${implyConfig.grade}. Standard: ${implyConfig.location}. Difficulty: ${implyConfig.difficulty}.
CRITICAL RULE: The required answer MUST still be fully derivable from the provided notes. Do NOT require outside facts.`;
};

/**
 * DeepSeek API Handler (OpenAI Compatible)
 */
async function callDeepSeek(apiKey, modelId, systemPrompt, userPrompt, jsonMode = true) {
    if (!apiKey) throw new Error("DeepSeek API Key missing.");
    const url = "https://api.deepseek.com/chat/completions";
    const body = {
        model: modelId,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        stream: false
    };
    if (jsonMode) body.response_format = { type: "json_object" };

    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error?.message || `DeepSeek Error: ${response.status}`);
    }
    const result = await response.json();
    return result.choices[0].message.content;
}

/**
 * Fast Start: Generates the first card AND the master analysis.
 */
export async function generateFirstCardAndSummary(apiKey, modelId, textContext, files, onRetry, cardCount = 20, implyConfig = {}) {
    if (apiKey === 'mock-key' || apiKey === 'offline') {
        await sleep(1000);
        return {
            masterSummary: "Mock Analysis: " + textContext.substring(0, 50),
            cards: Array.from({ length: cardCount }, (_, i) => ({
                question: `Mock Question ${i + 1}?`,
                answer: `Mock Answer ${i + 1}.`,
                keywords: ["mock"]
            }))
        };
    }

    const implyModifier = buildImplyPrompt(implyConfig);
    const strictConstraint = ` CRITICAL RESTRICTION: You MUST ONLY generate questions for topics explicitly covered in the provided text. DO NOT invent or assume any topics outside of the text.`;

    if (modelId?.startsWith("deepseek-")) {
        const system = `You are a strict study architect. ONLY use the provided information. Do NOT use external knowledge. Create exactly ${cardCount} cards. Output ONLY valid JSON: { 'masterSummary': string, 'cards': [{question, answer, keywords}] }. If info is missing, do not hallucinate.${implyModifier}${strictConstraint}`;
        const user = `Context: ${textContext}. Generate the master summary and ${cardCount} unique cards based STRICTLY on this context.`;
        const resp = await callDeepSeek(apiKey, modelId, system, user, true);
        return safeJsonParse(resp);
    }

    if (!apiKey) throw new Error("Gemini Key required");
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelId || "gemini-1.5-flash-latest",
        systemInstruction: `You are a strict study architect. Analyze the provided notes and images. Create a master summary and exactly ${cardCount} cards. ONLY use the provided information. Do NOT use external knowledge or general facts. Stick strictly to the source material. Output JSON: { 'masterSummary': string, 'cards': [{question, answer, keywords}] }.${implyModifier}${strictConstraint}`,
        generationConfig: { responseMimeType: "application/json" }
    });

    let fileParts = [];
    if (files && files.length > 0) {
        fileParts = await Promise.all(files.map(file => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ inlineData: { data: reader.result.split(',')[1], mimeType: file.type } });
            reader.onerror = reject;
            reader.readAsDataURL(file);
        })));
    }

    const prompt = `Text: ${textContext}. Generate the masterSummary and ${cardCount} cards. JSON output.`;
    const result = await model.generateContent([{ text: prompt }, ...fileParts]);
    return safeJsonParse((await result.response).text());
}

/**
 * Rapid Card Generation
 */
export async function generateSingleCard(apiKey, modelId, masterText, history = [], onRetry) {
    if (apiKey === 'mock-key') return { question: "Mock Turbo Q?", answer: "Mock A.", keywords: ["turbo"] };

    if (modelId?.startsWith("deepseek-")) {
        const system = "Output ONLY JSON {question, answer, keywords}. ONLY use the provided context. Do NOT use external facts.";
        const user = `Context: ${masterText.substring(0, 2000)}. Avoid: ${history.join(', ')}. Create 1 card strictly based on this.`;
        const resp = await callDeepSeek(apiKey, modelId, system, user, true);
        return safeJsonParse(resp);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelId || "gemini-1.5-flash-latest",
        systemInstruction: "Rapid quiz generator. ONLY use the provided info. No external knowledge. Output ONLY JSON {question, answer, keywords}.",
        generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(masterText.substring(0, 5000));
    return safeJsonParse((await result.response).text());
}

/**
 * Evaluation
 */
export async function evaluateAnswer(apiKey, modelId, originalQuestion, correctAnswer, userAnswer, onRetry) {
    if (apiKey === 'mock-key') return { isCorrect: userAnswer.length > 3, bonusPoints: false, feedback: "Mock check." };

    if (modelId?.startsWith("deepseek-")) {
        const system = "You are an intelligent, lenient grader. Use broad knowledge to understand synonyms. Mark correct if the user understands the concept. NEVER penalize for missing advanced facts. If the user provides an exceptionally detailed, highly insightful answer that goes above and beyond, set 'bonusPoints': true. Output ONLY JSON {'isCorrect': boolean, 'bonusPoints': boolean, 'feedback': string}.";
        const user = `Q: ${originalQuestion}, Correct: ${correctAnswer}, User: ${userAnswer}. Grade the user.`;
        const resp = await callDeepSeek(apiKey, modelId, system, user, true);
        return safeJsonParse(resp);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: modelId || "gemini-1.5-flash-latest",
        systemInstruction: "Intelligent, lenient grader. Match semantics. If User's Answer matches Provided Answer, mark Correct. Do NOT penalize for missing advanced details. If the user provides an exceptionally detailed, highly insightful answer that goes above and beyond the expected answer, set 'bonusPoints': true. Output ONLY JSON {'isCorrect': boolean, 'bonusPoints': boolean, 'feedback': string}.",
        generationConfig: { responseMimeType: "application/json" }
    });
    const result = await model.generateContent(`Match? Q: ${originalQuestion}, Correct: ${correctAnswer}, User: ${userAnswer}`);
    return safeJsonParse((await result.response).text());
}

/**
 * Summary Generation
 */
export async function generateSummary(apiKey, modelId, score, total) {
    if (apiKey === 'mock-key') return "Great job!";

    if (modelId?.startsWith("deepseek-")) {
        const system = "Generate 1 concise, motivating sentence based on the score.";
        const user = `Score: ${score}/${total}`;
        const resp = await callDeepSeek(apiKey, modelId, system, user, false); // No JSON needed here
        return resp.trim();
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: modelId || "gemini-1.5-flash-latest" });
    const result = await model.generateContent(`Motivate me. Score: ${score}/${total}`);
    return (await result.response).text().trim();
}

/**
 * On-Sight Handlers (Reference Only)
 */
export async function generateWithOnSightModel(text, implyConfig = {}) {
    if (!window.ai || !window.ai.languageModel) throw new Error("Nano missing");
    const implyModifier = buildImplyPrompt(implyConfig);
    const session = await window.ai.languageModel.create({ systemPrompt: `Strict Flashcard generator. ONLY use provided context. JSON output.${implyModifier}` });
    return safeJsonParse(await session.prompt(text));
}

export async function gradeWithOnSightModel(q, a, u) {
    if (!window.ai || !window.ai.languageModel) throw new Error("Nano missing");
    const session = await window.ai.languageModel.create({ systemPrompt: "Intelligent Grader. Use world knowledge for synonyms, but only require info present in the provided answer. If the assigned answer is exceptionally detailed and goes above and beyond, set 'bonusPoints': true. Output ONLY valid JSON: {'isCorrect': boolean, 'bonusPoints': boolean, 'feedback': string}." });
    return safeJsonParse(await session.prompt(`Q: ${q}, A: ${a}, U: ${u}`));
}
