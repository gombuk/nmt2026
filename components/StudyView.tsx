import React, { useState } from 'react';
import { Subject } from '../types';
import { TOPICS } from '../data/topics';
import { generateStudyNotes } from '../services/geminiService';
import { ChevronRight, ArrowLeft, Book, Loader2, ScrollText, GraduationCap, CheckCircle } from 'lucide-react';

interface StudyViewProps {
  onBack: () => void;
  onStartQuiz: (subject: Subject, topic: string) => void;
}

export const StudyView: React.FC<StudyViewProps> = ({ onBack, onStartQuiz }) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTopicSelect = async (subject: Subject, topic: string) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic);
    setLoading(true);
    
    try {
      const content = await generateStudyNotes(subject, topic);
      setNotes(content);
    } catch (error) {
      console.error(error);
      setNotes("Вибачте, сталася помилка при генерації конспекту. Спробуйте пізніше.");
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setSelectedTopic(null);
    setNotes(null);
  };

  // Simple Markdown-like parser for display
  const renderContent = (text: string) => {
    return text.split('\n').map((line, index) => {
      // Headers
      if (line.startsWith('### ')) return <h3 key={index} className="text-lg font-bold text-slate-800 mt-4 mb-2">{line.replace('### ', '')}</h3>;
      if (line.startsWith('## ')) return <h2 key={index} className="text-xl font-bold text-blue-700 mt-6 mb-3 border-b pb-1">{line.replace('## ', '')}</h2>;
      if (line.startsWith('# ')) return <h1 key={index} className="text-2xl font-bold text-slate-900 mt-8 mb-4">{line.replace('# ', '')}</h1>;
      
      const parseInline = (content: string) => {
        // Split by bold (**...**) AND LaTeX math ($...$)
        const parts = content.split(/(\*\*.*?\*\*|\$.*?\$)/g);
        return parts.map((part, i) => {
             if (part.startsWith('**') && part.endsWith('**')) {
                 return <strong key={i} className="text-slate-900">{part.slice(2, -2)}</strong>;
             }
             if (part.startsWith('$') && part.endsWith('$')) {
                 // Render math-like text cleanly without dollar signs
                 return <span key={i} className="font-mono text-blue-700 bg-blue-50 px-1 rounded mx-0.5">{part.slice(1, -1)}</span>;
             }
             return part;
        });
      };
      
      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.replace(/^[-*]\s+/, '');
        return (
          <li key={index} className="ml-5 mb-1 text-slate-700 list-disc">
             {parseInline(content)}
          </li>
        );
      }
      
      // Normal Paragraphs
      if (line.trim().length > 0) {
        return (
            <p key={index} className="mb-2 text-slate-700 leading-relaxed">
                {parseInline(line)}
            </p>
        );
      }
      return <br key={index} />;
    });
  };

  // If a topic is selected and notes are loaded (or loading)
  if (selectedTopic && selectedSubject) {
    return (
      <div className="max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-right duration-300 relative pb-12">
        <button 
          onClick={clearSelection}
          className="flex items-center text-slate-500 hover:text-blue-600 mb-6 transition-colors group"
        >
          <ArrowLeft className="w-5 h-5 mr-1 group-hover:-translate-x-1 transition-transform" />
          Назад до списку тем
        </button>

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden min-h-[60vh]">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-96">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h3 className="text-xl font-semibold text-slate-800">ШІ пише конспект...</h3>
                <p className="text-slate-500">Аналізуємо історичні джерела та структуруємо дані.</p>
             </div>
           ) : (
             <div className="p-8 sm:p-12">
                <div className="flex flex-col sm:flex-row items-start justify-between mb-8 border-b border-slate-100 pb-6">
                   <div className="flex-1">
                       <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wide mb-2">
                           {selectedSubject}
                       </span>
                       <h1 className="text-3xl font-bold text-slate-900">{selectedTopic}</h1>
                   </div>
                   
                   <div className="flex items-center space-x-2 mt-4 sm:mt-0 bg-slate-50 p-2 rounded-xl border border-slate-100">
                      <div className="bg-blue-50 p-2 rounded-lg hidden sm:block ml-2">
                         <ScrollText className="w-6 h-6 text-blue-600" />
                      </div>
                   </div>
                </div>
                
                <div className="prose prose-slate max-w-none mb-12">
                    {notes && renderContent(notes)}
                </div>

                <div className="p-8 bg-blue-50 rounded-2xl border border-blue-100">
                    <h3 className="text-xl font-bold text-slate-900 mb-2">Закріплення матеріалу</h3>
                    <p className="text-slate-600 mb-6">
                        Перевірте, як добре ви засвоїли тему "{selectedTopic}". Пройдіть короткий тест із 10 питань.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                        <button 
                            onClick={() => onStartQuiz(selectedSubject, selectedTopic)}
                            className="flex-1 flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all hover:-translate-y-0.5"
                        >
                            <CheckCircle className="w-5 h-5 mr-2" />
                            Пройти тест (10 питань)
                        </button>
                        <button 
                            onClick={clearSelection}
                            className="flex-1 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Вибрати іншу тему
                        </button>
                    </div>
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  // Topic Selection View
  return (
    <div className="max-w-4xl mx-auto w-full animate-in fade-in duration-500">
      <div className="mb-8 flex items-center">
        <button 
            onClick={onBack}
            className="mr-4 p-2 rounded-full hover:bg-slate-200 transition-colors"
        >
            <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
            <h2 className="text-3xl font-bold text-slate-900">Теоретичні матеріали</h2>
            <p className="text-slate-500">Оберіть тему для отримання структурованого конспекту</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* We prioritize History as requested, but logic supports others if added to TOPICS */}
        {[Subject.HISTORY, Subject.UKRAINIAN, Subject.MATH].map((subject) => {
           if (!TOPICS[subject]) return null;

           return (
             <div key={subject} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center">
                   <div className="p-2 bg-white rounded-lg border border-slate-200 mr-3">
                     {subject === Subject.HISTORY ? <ScrollText className="w-5 h-5 text-red-500"/> : 
                      subject === Subject.MATH ? <GraduationCap className="w-5 h-5 text-blue-500"/> :
                      <Book className="w-5 h-5 text-yellow-500"/>}
                   </div>
                   <h3 className="text-lg font-bold text-slate-800">{subject}</h3>
                </div>
                
                <div className="divide-y divide-slate-100">
                   {TOPICS[subject].map((group, gIdx) => (
                       <div key={gIdx} className="p-4">
                           <h4 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 ml-2">
                               {group.category}
                           </h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                               {group.topics.map((topic, tIdx) => (
                                   <button
                                      key={tIdx}
                                      onClick={() => handleTopicSelect(subject, topic)}
                                      className="flex items-center justify-between p-3 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors text-left group border border-transparent hover:border-blue-100"
                                   >
                                      <span className="text-sm font-medium text-slate-700 group-hover:text-blue-700 truncate mr-2">
                                          {topic}
                                      </span>
                                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 flex-shrink-0" />
                                   </button>
                               ))}
                           </div>
                       </div>
                   ))}
                </div>
             </div>
           )
        })}
      </div>
    </div>
  );
};