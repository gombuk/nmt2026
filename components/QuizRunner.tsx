import React, { useState, useEffect } from 'react';
import { Question, QuizSession } from '../types';
import { Clock, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Lightbulb, AlertCircle } from 'lucide-react';

interface QuizRunnerProps {
  session: QuizSession;
  onComplete: (answers: number[], endTime: number) => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({ session, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(new Array(session.questions.length).fill(-1));
  const [timeLeft, setTimeLeft] = useState(session.timeLimit); 

  // Check if this is a strict simulation (no hints allowed)
  const isSimulation = session.subject.includes("Симуляція");

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinish(); // Auto-submit
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectOption = (optionIndex: number) => {
    // If practicing (not simulation), lock answer after selection
    if (!isSimulation && answers[currentQuestionIndex] !== -1) {
        return; 
    }

    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = optionIndex;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQuestionIndex < session.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleFinish = () => {
    onComplete(answers, Date.now());
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercentage = ((answers.filter(a => a !== -1).length) / session.questions.length) * 100;
  const currentQuestion = session.questions[currentQuestionIndex];
  
  // Logic for feedback state (only for practice mode)
  const isAnswered = answers[currentQuestionIndex] !== -1;
  const isCorrect = isAnswered && answers[currentQuestionIndex] === currentQuestion.correctIndex;

  // Helper to get question subject badge color
  const getSubjectBadgeColor = (subj?: string) => {
    switch (subj) {
      case 'Математика': return 'bg-blue-100 text-blue-700';
      case 'Українська мова': return 'bg-yellow-100 text-yellow-700';
      case 'Історія України': return 'bg-red-100 text-red-700';
      case 'Англійська мова': return 'bg-green-100 text-green-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  // Helper for option styling
  const getOptionStyles = (idx: number) => {
      const isSelected = answers[currentQuestionIndex] === idx;
      
      // Simulation Mode: Simple Blue selection, no validation colors
      if (isSimulation) {
          return isSelected 
            ? 'border-blue-600 bg-blue-50 text-blue-900' 
            : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700';
      }

      // Practice Mode: Immediate Feedback
      if (!isAnswered) {
          return 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700';
      }

      if (idx === currentQuestion.correctIndex) {
          return 'border-green-500 bg-green-50 text-green-800 font-medium ring-1 ring-green-500'; // Always show correct
      }

      if (isSelected && idx !== currentQuestion.correctIndex) {
          return 'border-red-500 bg-red-50 text-red-800 font-medium ring-1 ring-red-500'; // Show error if selected
      }

      return 'border-slate-200 opacity-50 text-slate-400'; // Dim other options
  };

  return (
    <div className="max-w-4xl mx-auto w-full">
      {/* Header with Timer and Progress */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 sticky top-4 z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-2 text-slate-700">
            <span className="font-bold text-lg">Питання {currentQuestionIndex + 1}</span>
            <span className="text-slate-400">/ {session.questions.length}</span>
          </div>
          <div className={`flex items-center space-x-2 font-mono text-xl font-bold ${timeLeft < 300 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
            <Clock className="w-5 h-5" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>
        
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden mb-6">
        <div className="p-8">
           <div className="flex justify-between items-start mb-4">
               {currentQuestion.subject && (
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getSubjectBadgeColor(currentQuestion.subject)}`}>
                    {currentQuestion.subject}
                    </span>
               )}
               {isSimulation && <span className="bg-purple-100 text-purple-700 text-xs px-2 py-1 rounded font-bold">СИМУЛЯЦІЯ</span>}
               {!isSimulation && <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded font-bold">ТРЕНУВАННЯ</span>}
           </div>

          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-8 leading-relaxed">
            {currentQuestion.text}
          </h2>

          <div className="space-y-4">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                disabled={!isSimulation && isAnswered} // Lock answers in practice mode
                className={`
                  w-full text-left p-5 rounded-xl border-2 transition-all duration-200 flex items-center group relative
                  ${getOptionStyles(idx)}
                `}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center mr-4 border-2 font-bold text-sm transition-colors flex-shrink-0
                  ${isSimulation 
                    ? (answers[currentQuestionIndex] === idx ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 text-slate-500')
                    : ( // Practice Logic
                        !isAnswered 
                            ? 'border-slate-300 text-slate-500 group-hover:border-blue-400 group-hover:text-blue-500'
                            : idx === currentQuestion.correctIndex 
                                ? 'bg-green-500 border-green-500 text-white'
                                : answers[currentQuestionIndex] === idx 
                                    ? 'bg-red-500 border-red-500 text-white'
                                    : 'border-slate-200 text-slate-300'
                      )
                  }
                `}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <span className="text-lg flex-grow">
                  {option}
                </span>
                
                {/* Status Icons for Practice Mode */}
                {!isSimulation && isAnswered && idx === currentQuestion.correctIndex && (
                    <CheckCircle2 className="w-6 h-6 text-green-600 ml-2" />
                )}
                {!isSimulation && isAnswered && answers[currentQuestionIndex] === idx && idx !== currentQuestion.correctIndex && (
                    <XCircle className="w-6 h-6 text-red-600 ml-2" />
                )}
                
                {/* Status Icon for Simulation (just selection) */}
                {isSimulation && answers[currentQuestionIndex] === idx && (
                    <CheckCircle2 className="w-6 h-6 text-blue-600 ml-auto" />
                )}
              </button>
            ))}
          </div>

          {/* Explanation Block - Only visible in Practice Mode after answering */}
          {!isSimulation && isAnswered && (
             <div className="mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                 <div className={`rounded-xl p-5 border ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                    <div className="flex items-start">
                        <div className={`p-2 rounded-lg mr-4 flex-shrink-0 ${isCorrect ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            <Lightbulb className="w-6 h-6" />
                        </div>
                        <div>
                            <h4 className={`font-bold text-lg mb-1 ${isCorrect ? 'text-green-900' : 'text-blue-900'}`}>
                                {isCorrect ? 'Чудово! Правильна відповідь.' : 'Пояснення'}
                            </h4>
                            <p className={`${isCorrect ? 'text-green-800' : 'text-blue-800'} leading-relaxed`}>
                                {currentQuestion.explanation}
                            </p>
                        </div>
                    </div>
                 </div>
             </div>
          )}
        </div>
        
        {/* Navigation Footer */}
        <div className="bg-slate-50 p-6 border-t border-slate-100 flex justify-between items-center">
          <button
            onClick={handlePrev}
            disabled={currentQuestionIndex === 0}
            className="flex items-center px-4 py-2 text-slate-600 font-medium hover:text-slate-900 disabled:opacity-30 disabled:hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            Назад
          </button>
          
          <div className="flex space-x-2">
            {/* Pagination Dots (Mobile hidden) */}
            <div className="hidden md:flex space-x-1">
                {session.questions.length <= 10 && session.questions.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`w-2 h-2 rounded-full ${
                             idx === currentQuestionIndex 
                                ? 'bg-slate-800' 
                                : !isSimulation && answers[idx] !== -1 // Practice mode coloring
                                    ? (answers[idx] === session.questions[idx].correctIndex ? 'bg-green-400' : 'bg-red-400')
                                    : answers[idx] !== -1 ? 'bg-blue-400' : 'bg-slate-300'
                        }`}
                    />
                ))}
                 {session.questions.length > 10 && (
                     <div className="text-sm text-slate-400">
                        Всього {session.questions.length} питань
                     </div>
                 )}
            </div>
          </div>

          {currentQuestionIndex === session.questions.length - 1 ? (
             <button
                onClick={handleFinish}
                className="flex items-center px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 hover:shadow-md transition-all active:scale-95"
              >
                Завершити тест
                <CheckCircle2 className="w-5 h-5 ml-2" />
              </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 hover:shadow-md transition-all active:scale-95"
            >
              Далі
              <ChevronRight className="w-5 h-5 ml-2" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
