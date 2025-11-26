export enum Subject {
  MATH = 'Математика',
  UKRAINIAN = 'Українська мова',
  HISTORY = 'Історія України',
  ENGLISH = 'Англійська мова',
  PHYSICS = 'Фізика',
  BIOLOGY = 'Біологія',
  CHEMISTRY = 'Хімія'
}

export enum AppState {
  MENU = 'MENU',
  LOADING = 'LOADING',
  QUIZ = 'QUIZ',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

export interface Question {
  id: number;
  text: string;
  options: string[];
  correctIndex: number; // 0-based index
  explanation: string;
  subject?: string; // Optional field to track subject in mixed tests
}

export interface QuizSession {
  subject: string; // Changed to string to support "Simulation" title
  questions: Question[];
  userAnswers: number[]; // Array of selected indices, -1 if unanswered
  startTime: number;
  endTime?: number;
  timeLimit: number; // Time limit in seconds
}