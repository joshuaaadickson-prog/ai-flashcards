/**
 * Local Flashcard Engine
 * A rule-based generator that simulates AI logic locally for offline use.
 */

export function generateLocalCards(text, cardCount = 20) {
    if (!text || text.length < 5) {
        return {
            masterSummary: "No notes provided.",
            cards: [{ question: "Add more notes to generate real cards.", answer: "Okay!", keywords: ["notes"] }]
        };
    }

    // Split into sentences or significant fragments
    const sentences = text.split(/[\.!\?\n]+/).filter(s => {
        const t = s.trim().toLowerCase();
        // Filter out meta-talk and commands
        if (t.length < 15) return false;
        if (t.startsWith("make") || t.startsWith("generate") || t.startsWith("can you")) return false;
        if (t.includes("flashcard") && t.length < 30) return false;
        return true;
    });
    const cards = [];

    sentences.forEach((s) => {
        const trimmed = s.trim();

        // Smarter extraction rules
        const markers = [
            { split: " is ", q: "What is " },
            { split: " are ", q: "What are " },
            { split: " consists of ", q: "What does " },
            { split: " refers to ", q: "Define " },
            { split: " was ", q: "Who/What was " },
            { split: " depends on ", q: "What depends on " },
            { split: " results in ", q: "What " }
        ];

        let found = false;
        for (const m of markers) {
            if (trimmed.toLowerCase().includes(m.split)) {
                const parts = trimmed.split(new RegExp(m.split, 'i'));
                if (parts.length >= 2) {
                    const subject = parts[0].trim();
                    const definition = parts.slice(1).join(m.split).trim();

                    if (cards.length < cardCount) {
                        cards.push({
                            question: `${m.q}${subject}?`,
                            answer: definition,
                            keywords: subject.split(" ").filter(w => w.length > 3)
                        });
                        found = true;
                    }
                    break;
                }
            }
        }

        // Fallback: Keyword extraction
        if (!found && cards.length < cardCount) {
            const words = trimmed.split(" ");
            const target = words.find(w => w.length > 7);
            if (target) {
                cards.push({
                    question: `Explain the concept of "${target}" as mentioned in your notes.`,
                    answer: trimmed,
                    keywords: [target]
                });
            }
        }
    });

    return {
        masterSummary: `Local analysis complete. Extracted ${cards.length} cards from your notes.`,
        cards: cards.length > 0 ? cards.slice(0, cardCount) : [{ question: "General Summary", answer: text.substring(0, 100), keywords: ["notes"] }]
    };
}
