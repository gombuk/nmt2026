import React, { useState } from 'react';
import { Subject, AppState, QuizSession, Question } from './types';
import { SubjectCard } from './components/SubjectCard';
import { QuizRunner } from './components/QuizRunner';
import { ResultsView } from './components/ResultsView';
import { generateNMTQuestions, generateNMTSimulation, generateSubjectSimulation, generateTopicQuiz } from './services/geminiService';
import { GraduationCap, Loader2, Sparkles, AlertCircle, Timer, Layers, X, Check, BookOpen, BrainCircuit, ListTree, Shuffle, NotebookPen } from 'lucide-react';
import { TOPICS } from './data/topics';
import { StudyView } from './components/StudyView';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.MENU);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [session, setSession] = useState<QuizSession | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("Генеруємо варіант тесту...");

  // Simulation Config State
  const [showSimModal, setShowSimModal] = useState(false);
  const [simMode, setSimMode] = useState<'mixed' | 'subject'>('mixed');
  const [simSubject, setSimSubject] = useState<Subject>(Subject.MATH);
  const [simTopicMode, setSimTopicMode] = useState<'random' | 'specific'>('random');
  const [simSelectedTopic, setSimSelectedTopic] = useState<string>("");

  const startQuiz = async (subject: Subject) => {
    setSelectedSubject(subject);
    setAppState(AppState.LOADING);
    setLoadingText(`Генеруємо швидкий тест (5 питань): ${subject}...`);
    setErrorMsg(null);

    try {
      const questions: Question[] = await generateNMTQuestions(subject);
      const newSession: QuizSession = {
        subject: subject,
        questions,
        userAnswers: [],
        startTime: Date.now(),
        timeLimit: 20 * 60 // 20 minutes for subject quiz
      };
      setSession(newSession);
      setAppState(AppState.QUIZ);
    } catch (err) {
      console.error(err);
      setErrorMsg("Не вдалося завантажити питання. Перевірте з'єднання або API ключ.");
      setAppState(AppState.ERROR);
    }
  };

  const startSimulation = async () => {
    setShowSimModal(false);
    setSelectedSubject(null);
    setAppState(AppState.LOADING);
    setErrorMsg(null);

    try {
      let questions: Question[] = [];
      let sessionTitle = "";

      if (simMode === 'mixed') {
        setLoadingText("Генеруємо мультитест НМТ (32 питання)... Це може зайняти хвилину.");
        questions = await generateNMTSimulation();
        sessionTitle = "НМТ Симуляція (Мультитест)";
      } else {
        const topicArg = simTopicMode === 'specific' ? simSelectedTopic : undefined;
        const topicDisplay = topicArg ? `(Тема: ${topicArg})` : "(Весь курс)";
        
        setLoadingText(`Генеруємо повний тест: ${simSubject} ${topicDisplay}...`);
        questions = await generateSubjectSimulation(simSubject, topicArg);
        sessionTitle = `НМТ Симуляція: ${simSubject}`;
      }

      const newSession: QuizSession = {
        subject: sessionTitle,
        questions,
        userAnswers: [],
        startTime: Date.now(),
        timeLimit: 60 * 60 // 60 minutes for simulation
      };
      setSession(newSession);
      setAppState(AppState.QUIZ);
    } catch (err) {
      console.error(err);
      setErrorMsg("Не вдалося створити симуляцію. Спробуйте ще раз.");
      setAppState(AppState.ERROR);
    }
  };

  const startTopicQuiz = async (subject: Subject, topic: string) => {
    setAppState(AppState.LOADING);
    setLoadingText(`Створюємо тест (10 питань): ${topic}...`);
    setErrorMsg(null);

    try {
      const questions = await generateTopicQuiz(subject, topic);
      const newSession: QuizSession = {
        subject: `Тест по темі: ${topic}`,
        questions,
        userAnswers: [],
        startTime: Date.now(),
        timeLimit: 15 * 60 // 15 minutes for 10 questions
      };
      setSession(newSession);
      setAppState(AppState.QUIZ);
    } catch (err) {
      console.error(err);
      setErrorMsg("Не вдалося створити тест по темі. Спробуйте ще раз.");
      setAppState(AppState.ERROR);
    }
  };

  const handleQuizComplete = (answers: number[], endTime: number) => {
    if (session) {
      setSession({ ...session, userAnswers: answers, endTime });
      setAppState(AppState.RESULTS);
    }
  };

  const resetApp = () => {
    setAppState(AppState.MENU);
    setSession(null);
    setSelectedSubject(null);
  };

  const restartQuiz = () => {
      if (session?.subject.includes("Симуляція")) {
          // If it was a simulation, restart with same settings
          startSimulation();
      } else if (session?.subject.includes("Тест по темі")) {
          // It's a bit hard to restart a specific topic quiz without storing the state, 
          // but for now we redirect to menu or could store lastTopic in state.
          // Simplest fallback:
          resetApp();
      } else if (selectedSubject) {
          startQuiz(selectedSubject);
      } else {
          resetApp();
      }
  }

  const handleSimSubjectChange = (subj: Subject) => {
      setSimSubject(subj);
      // Reset topic selection when subject changes
      setSimTopicMode('random');
      setSimSelectedTopic("");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans relative">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div 
            className="flex items-center space-x-2 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={resetApp}
          >
            <div className="bg-blue-600 p-2 rounded-lg text-white">
                <GraduationCap className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
                НМТ 2026
            </span>
          </div>
          {appState !== AppState.MENU && (
             <div className="text-sm font-medium text-slate-500 hidden sm:block">
                Симулятор іспиту
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {appState === AppState.MENU && (
          <div className="space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4 mr-2" />
                Штучний інтелект Gemini
              </div>
              <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 mb-4 tracking-tight">
                Підготуйся до <span className="text-blue-600">НМТ 2026</span> вже сьогодні
              </h1>
              <p className="text-lg text-slate-600">
                Обери предмет для тренування або пройди повну симуляцію іспиту.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Simulation Card */}
                <div 
                  onClick={() => setShowSimModal(true)}
                  className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 text-white shadow-xl transform transition-all hover:scale-[1.01] hover:shadow-2xl cursor-pointer group relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:rotate-12">
                      <Layers className="w-48 h-48" />
                   </div>
                   
                   <div className="relative z-10">
                        <div className="flex items-center space-x-3 mb-4">
                          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border border-white/10 uppercase tracking-wider">
                            Практика
                          </span>
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Симуляція НМТ</h2>
                        <p className="text-indigo-100 text-lg mb-6">
                          Мультитест або 32 питання з профільного предмету. Таймер 60 хв.
                        </p>
                         <button className="px-6 py-3 bg-white text-indigo-700 rounded-xl font-bold shadow-lg hover:bg-indigo-50 transition-colors w-full sm:w-auto">
                           Налаштувати
                         </button>
                   </div>
                </div>

                {/* Study Notes Card */}
                <div 
                  onClick={() => setAppState(AppState.STUDY)}
                  className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-3xl p-8 text-white shadow-xl transform transition-all hover:scale-[1.01] hover:shadow-2xl cursor-pointer group relative overflow-hidden"
                >
                   <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity transform group-hover:rotate-12">
                      <NotebookPen className="w-48 h-48" />
                   </div>
                   
                   <div className="relative z-10">
                        <div className="flex items-center space-x-3 mb-4">
                          <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold backdrop-blur-sm border border-white/10 uppercase tracking-wider">
                            Теорія
                          </span>
                        </div>
                        <h2 className="text-3xl font-bold mb-2">Конспекти</h2>
                        <p className="text-emerald-100 text-lg mb-6">
                           Структуровані матеріали по всіх темах історії України, літератури та математики.
                        </p>
                         <button className="px-6 py-3 bg-white text-emerald-700 rounded-xl font-bold shadow-lg hover:bg-emerald-50 transition-colors w-full sm:w-auto">
                           Відкрити бібліотеку
                         </button>
                   </div>
                </div>
            </div>

            <div className="flex items-center justify-between mt-12 mb-4">
                <h3 className="text-xl font-bold text-slate-800">Швидкі тести (5 питань)</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.values(Subject).map((subj) => (
                <SubjectCard 
                    key={subj} 
                    subject={subj} 
                    onClick={startQuiz} 
                />
              ))}
            </div>
          </div>
        )}

        {appState === AppState.STUDY && (
            <StudyView 
              onBack={resetApp} 
              onStartQuiz={startTopicQuiz}
            />
        )}

        {appState === AppState.LOADING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-200 rounded-full animate-ping opacity-75"></div>
                <Loader2 className="w-16 h-16 text-blue-600 animate-spin relative z-10" />
            </div>
            <h2 className="mt-8 text-2xl font-bold text-slate-800">{loadingText}</h2>
            <p className="text-slate-500 mt-2 text-center max-w-md">ШІ аналізує програму та підбирає актуальні матеріали.</p>
          </div>
        )}

        {appState === AppState.ERROR && (
           <div className="flex flex-col items-center justify-center min-h-[50vh] animate-in fade-in duration-300">
                <div className="bg-red-100 p-4 rounded-full mb-6">
                    <AlertCircle className="w-12 h-12 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">Щось пішло не так</h2>
                <p className="text-slate-600 mb-8 max-w-md text-center">{errorMsg}</p>
                <button 
                    onClick={resetApp}
                    className="px-6 py-3 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors"
                >
                    Спробувати ще раз
                </button>
           </div>
        )}

        {appState === AppState.QUIZ && session && (
          <QuizRunner 
            session={session} 
            onComplete={handleQuizComplete} 
          />
        )}

        {appState === AppState.RESULTS && session && (
          <ResultsView 
            session={session} 
            onRestart={restartQuiz} 
            onHome={resetApp} 
          />
        )}

      </main>

      {/* Simulation Configuration Modal */}
      {showSimModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200 my-8">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-800">Налаштування симуляції</h3>
              <button onClick={() => setShowSimModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Type Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-3">Тип тестування</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setSimMode('mixed')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      simMode === 'mixed' 
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                       <Layers className={`w-5 h-5 mr-2 ${simMode === 'mixed' ? 'text-blue-600' : 'text-slate-500'}`} />
                       <span className={`font-bold ${simMode === 'mixed' ? 'text-blue-700' : 'text-slate-700'}`}>Мультитест</span>
                    </div>
                    <p className="text-xs text-slate-500">Мікс предметів (Укр. мова, Історія, Англ., Матем.)</p>
                  </button>

                  <button
                    onClick={() => setSimMode('subject')}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      simMode === 'subject' 
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' 
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                     <div className="flex items-center mb-2">
                       <BookOpen className={`w-5 h-5 mr-2 ${simMode === 'subject' ? 'text-blue-600' : 'text-slate-500'}`} />
                       <span className={`font-bold ${simMode === 'subject' ? 'text-blue-700' : 'text-slate-700'}`}>Один предмет</span>
                    </div>
                    <p className="text-xs text-slate-500">Поглиблений тест з конкретної теми</p>
                  </button>
                </div>
              </div>

              {/* Subject Selection (Only if Single Subject) */}
              {simMode === 'subject' && (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-200">
                   {/* Subject Grid */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">Оберіть предмет</label>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(Subject).map((subj) => (
                        <button
                            key={subj}
                            onClick={() => handleSimSubjectChange(subj)}
                            className={`px-4 py-3 rounded-lg text-sm font-medium transition-all flex items-center justify-between ${
                            simSubject === subj
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            {subj}
                            {simSubject === subj && <Check className="w-4 h-4 ml-2" />}
                        </button>
                        ))}
                    </div>
                  </div>

                  {/* Topic Selection Toggle */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                     <div className="flex items-center justify-between mb-4">
                         <span className="text-sm font-semibold text-slate-700">Охоплення матеріалу</span>
                         <div className="flex bg-slate-200 rounded-lg p-1">
                             <button
                                onClick={() => setSimTopicMode('random')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${simTopicMode === 'random' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                             >
                                <div className="flex items-center"><Shuffle className="w-3 h-3 mr-1"/>Весь курс</div>
                             </button>
                             <button
                                onClick={() => setSimTopicMode('specific')}
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${simTopicMode === 'specific' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                             >
                                <div className="flex items-center"><ListTree className="w-3 h-3 mr-1"/>Тема</div>
                             </button>
                         </div>
                     </div>

                     {/* Topic Dropdown */}
                     {simTopicMode === 'specific' && (
                         <div className="animate-in fade-in duration-200">
                             {TOPICS[simSubject] ? (
                                <select 
                                    value={simSelectedTopic}
                                    onChange={(e) => setSimSelectedTopic(e.target.value)}
                                    className="w-full p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                >
                                    <option value="" disabled>Оберіть тему...</option>
                                    {TOPICS[simSubject].map((group, idx) => (
                                        <optgroup key={idx} label={group.category}>
                                            {group.topics.map((topic, tIdx) => (
                                                <option key={`${idx}-${tIdx}`} value={topic}>{topic}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                             ) : (
                                 <div className="text-sm text-slate-500 italic p-2 text-center">
                                     Для цього предмету поки немає детального списку тем. Буде згенеровано загальний тест.
                                 </div>
                             )}
                             <p className="text-xs text-slate-500 mt-2">
                                * Тест буде містити 32 питання виключно по обраній темі.
                             </p>
                         </div>
                     )}
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 flex items-start">
                  <BrainCircuit className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <span className="font-bold block mb-1">Параметри сесії:</span>
                    Ви отримаєте <span className="font-bold">32 питання</span>. Час на виконання — <span className="font-bold">60 хвилин</span>.
                    {simMode === 'mixed' && " Питання будуть рівномірно розподілені між основними предметами."}
                    {simMode === 'subject' && simTopicMode === 'random' && ` Питання будуть охоплювати весь курс предмету "${simSubject}".`}
                    {simMode === 'subject' && simTopicMode === 'specific' && ` Питання будуть сфокусовані на темі "${simSelectedTopic || 'Обрана тема'}" предмету "${simSubject}".`}
                  </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowSimModal(false)}
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Скасувати
              </button>
              <button
                onClick={startSimulation}
                disabled={simMode === 'subject' && simTopicMode === 'specific' && !simSelectedTopic}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                Почати тестування
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;