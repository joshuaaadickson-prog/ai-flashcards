# AI Flashcards Studio 🧠⚡️

An advanced, AI-powered flashcard generation and study platform. This tool allows students to paste their notes, select their preferred AI model, and instantly generate a customized study deck. It features real-time, intelligent grading that understands semantic meaning and synonyms, rather than strictly matching exact words.

## ✨ Key Features

- **Pure-Context Generation**: The AI forms questions **ONLY** from the information provided in your notes. No hallucinations, no outside noise.
- **Strict & Fair Grading**: When you answer a card, the AI grades your response strictly based on the original notes. It's smart enough to recognize synonyms but disciplined enough to never penalize you for not knowing facts you didn't supply.
- **🌟 Imply Mode (Apply Knowledge)**: Instead of rote memorization, Imply Mode generates real-world scenarios to test how well you apply the concepts. You can customize the generation by:
  - **Grade / Level** (e.g., Grade 9, University)
  - **Difficulty** (Easy, Medium, Hard)
  - **Location / Standard** (e.g., California NGSS, Ontario Science Curriculum)
- **Bonus Points**: Provides exceptional feedback and awards bonus points (+2) for answers that are highly detailed and go above and beyond expectations.
- **Hybrid & Offline AI Support**:
  - **Cloud Models**: Integrates seamlessly with Google Gemini (Flash/Pro) and DeepSeek API.
  - **On-Sight AI**: Uses Chrome's built-in Gemini Nano for rapid, zero-latency, and 100% private offline generation and grading.

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- A valid API Key for [Google Gemini](https://aistudio.google.com/) or [DeepSeek](https://platform.deepseek.com/).

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ai-flashcards.git
   cd ai-flashcards
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:5174/`.

## 🛠️ Built With

- **Vite**: Next-generation frontend tooling.
- **Google Generative AI SDK**: For powerful cloud-based AI processing.
- **Vanilla JS & Glassmorphism UI**: A completely custom, lightweight frontend designed for focus and aesthetics.

## 🤖 100% AI Authored (Human Guided)

From the glassmorphism UI to the underlying neural routing logic, this platform was built through a collaborative dialogue between a human visionary and Antigravity AI. It's like "farm-to-table" code—high-quality ingredients, thoughtfully assembled for a premium educational result.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
