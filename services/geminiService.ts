import { GoogleGenAI, Type, Chat } from "@google/genai";
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
    7. ВАЖЛИВО: Не використовуй LaTeX форматування (знаки $). Пиши формули звичайним текстом (наприклад, x^2, 1/2, корінь з 5).
    
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
              text: { type: Type.STRING, description: "Текст запитання (без LaTeX, звичайний текст)" },
              options: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Масив з 4 варіантів відповідей"
              },
              correctIndex: { type: Type.INTEGER, description: "Індекс правильної відповіді (0-3)" },
              explanation: { type: Type.STRING, description: "Пояснення чому ця відповідь правильна (без LaTeX)" }
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

export const generateTopicQuiz = async (subject: Subject, topic: string): Promise<Question[]> => {
  // 10 questions for a specific topic check
  try {
    const questions = await fetchQuestionsInternal(subject, 10, topic);
    return questions.map((q, index) => ({
      ...q,
      id: index + 1
    }));
  } catch (error) {
    console.error(`Error generating topic quiz for ${topic}:`, error);
    throw error;
  }
};

export const generateStudyNotes = async (subject: string, topic: string): Promise<string> => {
    const prompt = `
      Створи детальний та структурований конспект для підготовки до НМТ 2026 з предмету "${subject}" на тему: "${topic}".
      
      Вимоги до структури та оформлення (використовуй Markdown):
      1. **Вступ**: короткий опис суті теми.
      2. **Ключові дати та події** (для історії) або **Формули та визначення** (для інших предметів).
      3. **Персоналії** (для історії/літератури).
      4. **Основний виклад матеріалу**: тезисно, головні події, причини та наслідки.
      5. **Лайфхаки для НМТ**: на що звернути особливу увагу в тестах.

      ВАЖЛИВО: 
      - Обов'язково виділяй жирним шрифтом (**приклад**) усі дати, імена, терміни.
      - НЕ ВИКОРИСТОВУЙ LaTeX (знаки $). Пиши формули звичайним текстом або Unicode (наприклад: α, β, x^2, √25, 360°).
      
      Стиль викладу: чіткий, без зайвих слів, орієнтований на складання іспиту.
      Мова: українська.
    `;
  
    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: prompt,
      });
  
      return response.text || "Не вдалося згенерувати конспект. Спробуйте ще раз.";
    } catch (error) {
      console.error("Error generating notes:", error);
      throw error;
    }
  };

export const createNMTChat = (): Chat => {
  return ai.chats.create({
    model: modelId,
    config: {
      systemInstruction: `
        Ти — досвідчений репетитор і помічник для підготовки до НМТ (Національний мультипредметний тест) 2026 року.
        Твоя мета — допомагати учням розбиратися в складних темах, пояснювати незрозуміле та структурувати знання.

        Правила:
        1. Відповідай ВИКЛЮЧНО на питання, що стосуються шкільної програми та предметів НМТ (Математика, Українська мова та література, Історія України, Англійська мова, Біологія, Хімія, Фізика, Географія).
        2. Якщо користувач ставить питання, яке не стосується навчання або НМТ, ввічливо відмов.
        
        Вимоги до відповідей:
        - Відповідь має бути повною, розгорнутою та зрозумілою.
        - Для ІСТОРІЇ: вказуй дати, причини, перебіг подій та їх наслідки.
        - Для МАТЕМАТИКИ/ФІЗИКИ/ХІМІЇ: якщо питання про задачу, розпиши розв'язання покроково.
        - СУВОРА ЗАБОРОНА НА LATEX: НЕ використовуй знаки долара ($) для формул. Пиши формули так, щоб вони легко читались текстом (наприклад: "x у квадраті", "x^2", "корінь з 3", "sqrt(3)", "1/2"). Використовуй Unicode символи (°, π, ∆, α).
        - Використовуй Markdown для форматування (жирний шрифт для важливого, списки для переліків).
        - Стиль спілкування: доброзичливий, підтримуючий.
      `
    }
  });
};