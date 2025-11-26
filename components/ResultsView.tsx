import React, { useMemo } from 'react';
import { QuizSession } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CheckCircle, XCircle, RefreshCcw, ArrowRight, BookOpen } from 'lucide-react';

interface ResultsViewProps {
  session: QuizSession;
  onRestart: () => void;
  onHome: () => void;
}

// Define interface for subject statistics to ensure type safety
interface SubjectStat {
    total: number;
    correct: number;
}

export const ResultsView: React.FC<ResultsViewProps> = ({ session, onRestart, onHome }) => {
  const { correctCount, incorrectCount, score, subjectBreakdown } = useMemo(() => {
    let correct = 0;
    const breakdown: Record<string, SubjectStat> = {};

    session.questions.forEach((q, idx) => {
      const isCorrect = session.userAnswers[idx] === q.correctIndex;
      if (isCorrect) correct++;
      
      const subj = q.subject || 'Загальні';
      if (!breakdown[subj]) {
        breakdown[subj] = { total: 0, correct: 0 };
      }
      breakdown[subj].total++;
      if (isCorrect) breakdown[subj].correct++;
    });

    return {
      correctCount: correct,
      incorrectCount: session.questions.length - correct,
      score: Math.round((correct / session.questions.length) * 200),
      subjectBreakdown: breakdown
    };
  }, [session]);

  const data = [
    { name: 'Правильно', value: correctCount, color: '#22c55e' },
    { name: 'Помилки', value: incorrectCount, color: '#ef4444' },
  ];

  const hasMultipleSubjects = Object.keys(subjectBreakdown).length > 1;

  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
        <div className="bg-slate-900 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-500 to-transparent"></div>
            <h2 className="text-3xl font-bold mb-2 relative z-10">Результати тестування</h2>
            <p className="text-slate-400 relative z-10">{session.subject} • Програма 2026</p>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Chart Section */}
          <div className="h-64 relative">
             <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} 
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="text-4xl font-bold text-slate-800">{score}</div>
              <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Балів</div>
            </div>
          </div>

          {/* Text Summary */}
          <div className="space-y-6">
             <div className="flex items-center p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="bg-green-100 p-2 rounded-lg mr-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
                <div>
                    <div className="text-sm text-green-800 font-medium">Правильних відповідей</div>
                    <div className="text-2xl font-bold text-green-700">{correctCount} <span className="text-sm font-normal text-green-600">/ {session.questions.length}</span></div>
                </div>
             </div>
             
             <div className="flex items-center p-4 bg-red-50 rounded-xl border border-red-100">
                <div className="bg-red-100 p-2 rounded-lg mr-4">
                    <XCircle className="w-6 h-6 text-red-600" />
                </div>
                <div>
                    <div className="text-sm text-red-800 font-medium">Помилок</div>
                    <div className="text-2xl font-bold text-red-700">{incorrectCount}</div>
                </div>
             </div>
          </div>
        </div>

        {/* Subject Breakdown for Simulation Mode */}
        {hasMultipleSubjects && (
           <div className="bg-slate-50 border-t border-slate-200 p-6">
             <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <BookOpen className="w-5 h-5 mr-2 text-slate-500"/> 
                Результати за предметами
             </h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {Object.entries(subjectBreakdown).map(([subject, statsRaw]) => {
                 const stats = statsRaw as SubjectStat;
                 const percent = Math.round((stats.correct / stats.total) * 100);
                 return (
                   <div key={subject} className="bg-white p-4 rounded-xl border border-slate-200">
                     <div className="flex justify-between items-center mb-2">
                       <span className="font-semibold text-slate-700">{subject}</span>
                       <span className={`text-sm font-bold ${percent >= 70 ? 'text-green-600' : percent >= 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                         {percent}%
                       </span>
                     </div>
                     <div className="w-full bg-slate-100 rounded-full h-1.5">
                       <div 
                         className={`h-1.5 rounded-full ${percent >= 70 ? 'bg-green-500' : percent >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                         style={{ width: `${percent}%` }}
                       />
                     </div>
                     <div className="mt-2 text-xs text-slate-500 text-right">
                       {stats.correct} з {stats.total}
                     </div>
                   </div>
                 );
               })}
             </div>
           </div>
        )}

        {/* Detailed Breakdown */}
        <div className="bg-white border-t border-slate-200">
             <div className="p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">Детальний розбір</h3>
                <div className="space-y-6">
                    {session.questions.map((q, idx) => {
                        const isCorrect = session.userAnswers[idx] === q.correctIndex;
                        const userAnswerLetter = session.userAnswers[idx] !== -1 ? String.fromCharCode(65 + session.userAnswers[idx]) : '-';
                        const correctAnswerLetter = String.fromCharCode(65 + q.correctIndex);

                        return (
                            <div key={q.id} className={`p-5 rounded-xl border ${isCorrect ? 'border-green-200 bg-white' : 'border-red-200 bg-white'}`}>
                                <div className="flex items-start mb-3">
                                    <div className={`
                                        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white mr-3
                                        ${isCorrect ? 'bg-green-500' : 'bg-red-500'}
                                    `}>
                                        {idx + 1}
                                    </div>
                                    <div className="w-full">
                                        <div className="flex justify-between items-start">
                                            <p className="text-slate-900 font-medium mb-2">{q.text}</p>
                                            {q.subject && (
                                                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded ml-2 whitespace-nowrap hidden sm:block">
                                                    {q.subject}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 text-sm mb-3">
                                            <span className={`px-2 py-1 rounded border ${isCorrect ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                                Ви обрали: <span className="font-bold">{userAnswerLetter}</span>
                                            </span>
                                            {!isCorrect && (
                                                 <span className="px-2 py-1 rounded border bg-green-50 border-green-200 text-green-700">
                                                    Правильно: <span className="font-bold">{correctAnswerLetter}</span>
                                                 </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="ml-11 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                    <span className="font-semibold text-slate-800">Пояснення: </span>
                                    {q.explanation}
                                </div>
                            </div>
                        )
                    })}
                </div>
             </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row gap-4 justify-center">
            <button 
                onClick={onHome}
                className="flex items-center justify-center px-6 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors"
            >
                На головну
            </button>
            <button 
                onClick={onRestart}
                className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5"
            >
                <RefreshCcw className="w-5 h-5 mr-2" />
                Пройти ще раз
                <ArrowRight className="w-5 h-5 ml-2" />
            </button>
        </div>
      </div>
    </div>
  );
};