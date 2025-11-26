import React, { useState, useEffect } from 'react';
import { Question, QuizSession } from '../types';
import { Clock, ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';

interface QuizRunnerProps {
  session: QuizSession;
  onComplete: (answers: number[], endTime: number) => void;
}

export const QuizRunner: React.FC<QuizRunnerProps> = ({ session, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>(new Array(session.questions.length).fill(-1));
  const [timeLeft, setTimeLeft] = useState(session.timeLimit); 

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
           {currentQuestion.subject && (
             <div className="mb-4">
                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${getSubjectBadgeColor(currentQuestion.subject)}`}>
                  {currentQuestion.subject}
                </span>
             </div>
           )}

          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 mb-8 leading-relaxed">
            {currentQuestion.text}
          </h2>

          <div className="space-y-4">
            {currentQuestion.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectOption(idx)}
                className={`
                  w-full text-left p-5 rounded-xl border-2 transition-all duration-200 flex items-center group
                  ${answers[currentQuestionIndex] === idx 
                    ? 'border-blue-600 bg-blue-50' 
                    : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}
                `}
              >
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center mr-4 border-2 font-bold text-sm transition-colors flex-shrink-0
                  ${answers[currentQuestionIndex] === idx
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-slate-300 text-slate-500 group-hover:border-blue-400 group-hover:text-blue-500'}
                `}>
                  {String.fromCharCode(65 + idx)}
                </div>
                <span className={`text-lg ${answers[currentQuestionIndex] === idx ? 'text-blue-900 font-medium' : 'text-slate-700'}`}>
                  {option}
                </span>
                
                {answers[currentQuestionIndex] === idx && (
                    <CheckCircle2 className="w-6 h-6 text-blue-600 ml-auto" />
                )}
              </button>
            ))}
          </div>
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
                        className={`w-2 h-2 rounded-full ${idx === currentQuestionIndex ? 'bg-blue-600' : answers[idx] !== -1 ? 'bg-blue-300' : 'bg-slate-300'}`}
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