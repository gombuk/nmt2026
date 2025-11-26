import { GoogleGenAI, Type } from "@google/genai";
import { Subject, Question } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const modelId = "gemini-2.5-flash";

async function fetchQuestionsInternal(subject: string, count: number, topic?: string): Promise<Question[]> {
  const topicContext = topic 
    ? `Питання мають стосуватися ВИКЛЮЧНО теми: "${topic}".` 
    : '';

  const prompt = `
    Створи ${count} тестових питань у форматі НМТ (Національний мультипредметний тест) для предмета: "${subject}".
    ${topicContext}
    Питання мають бути актуальними для програми підготовки 2026 року.
    Рівень складності: відповідає реальному ЗНО/НМТ (середній та високий).
    
    Вимоги:
    1. Питання мають бути українською мовою.
    2. 4 варіанти відповіді (або формат відповідності, поданий як варіанти А, Б, В, Г).
    3. Тільки одна правильна відповідь.
    4. Надай пояснення до правильної відповіді.
    5. Для математики включи завдання на обчислення (подані як тести).
    ${topic ? `6. Оскільки тема вузька ("${topic}"), намагайся зробити питання різноманітними, охоплюючи різні аспекти цієї теми.` : ''}
    
    Поверни відповідь виключно у форматі JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.INTEGER },
              text: { type: Type.STRING, description: "Текст запитання" },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Масив з 4 варіантів відповідей"
              },
              correctIndex: { type: Type.INTEGER, description: "Індекс правильної відповіді (0-3)" },
              explanation: { type: Type.STRING, description: "Пояснення чому ця відповідь правильна" }
            },
            required: ["id", "text", "options", "correctIndex", "explanation"]
          }
        }
      }
    });

    if (response.text) {
        const rawQuestions = JSON.parse(response.text) as Question[];
        // Tag questions with subject
        return rawQuestions.map(q => ({ ...q, subject }));
    }
    throw new Error("No data returned from Gemini");

  } catch (error) {
    console.error(`Error generating questions for ${subject}:`, error);
    throw error;
  }
}

export const generateNMTQuestions = async (subject: Subject): Promise<Question[]> => {
  return fetchQuestionsInternal(subject, 5);
};

export const generateNMTSimulation = async (): Promise<Question[]> => {
  // Real NMT simulation: 4 blocks. We will generate 8 questions for each core subject.
  // Subjects: Ukrainian, History, English, Math.
  const subjectsToFetch = [
    { name: Subject.UKRAINIAN, count: 8 },
    { name: Subject.HISTORY, count: 8 },
    { name: Subject.ENGLISH, count: 8 },
    { name: Subject.MATH, count: 8 }
  ];

  try {
    // Execute all requests in parallel
    const results = await Promise.all(
      subjectsToFetch.map(item => fetchQuestionsInternal(item.name, item.count))
    );

    // Flatten and re-index
    const allQuestions = results.flat();
    
    return allQuestions.map((q, index) => ({
      ...q,
      id: index + 1 // Re-index for the combined test
    }));

  } catch (error) {
    console.error("Error generating simulation:", error);
    throw error;
  }
};

export const generateSubjectSimulation = async (subject: Subject, topic?: string): Promise<Question[]> => {
  // For a full subject simulation (32 questions), we split into batches to avoid timeout/token limits
  // 4 batches of 8 questions = 32 questions
  const batchSize = 8;
  const totalBatches = 4;
  const promises = [];

  for (let i = 0; i < totalBatches; i++) {
    promises.push(fetchQuestionsInternal(subject, batchSize, topic));
  }

  try {
    const results = await Promise.all(promises);
    const allQuestions = results.flat();

    return allQuestions.map((q, index) => ({
      ...q,
      id: index + 1,
      subject: subject
    }));
  } catch (error) {
    console.error(`Error generating subject simulation for ${subject} (Topic: ${topic}):`, error);
    throw error;
  }
};