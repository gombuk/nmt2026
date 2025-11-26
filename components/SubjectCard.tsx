import React from 'react';
import { Subject } from '../types';
import { BookOpen, Calculator, FlaskConical, Globe, GraduationCap, Microscope, Hourglass } from 'lucide-react';

interface SubjectCardProps {
  subject: Subject;
  onClick: (subject: Subject) => void;
  disabled?: boolean;
}

const getIcon = (subject: Subject) => {
  switch (subject) {
    case Subject.MATH: return <Calculator className="w-8 h-8 text-blue-500" />;
    case Subject.UKRAINIAN: return <BookOpen className="w-8 h-8 text-yellow-500" />;
    case Subject.HISTORY: return <Hourglass className="w-8 h-8 text-red-500" />;
    case Subject.ENGLISH: return <Globe className="w-8 h-8 text-green-500" />;
    case Subject.PHYSICS: return <FlaskConical className="w-8 h-8 text-purple-500" />; // Fallback icon
    case Subject.CHEMISTRY: return <FlaskConical className="w-8 h-8 text-teal-500" />;
    case Subject.BIOLOGY: return <Microscope className="w-8 h-8 text-lime-500" />;
    default: return <GraduationCap className="w-8 h-8 text-gray-500" />;
  }
};

const getDescription = (subject: Subject) => {
    switch(subject) {
        case Subject.MATH: return "Алгебра та геометрія. Логіка та обчислення.";
        case Subject.UKRAINIAN: return "Граматика, синтаксис та література.";
        case Subject.HISTORY: return "Ключові дати та події становлення держави.";
        case Subject.ENGLISH: return "Reading comprehension and usage of English.";
        default: return "Тестові завдання за програмою 2026.";
    }
}

export const SubjectCard: React.FC<SubjectCardProps> = ({ subject, onClick, disabled }) => {
  return (
    <button
      onClick={() => onClick(subject)}
      disabled={disabled}
      className={`
        relative group flex flex-col items-start p-6 bg-white rounded-2xl shadow-sm border border-slate-200
        transition-all duration-300 hover:shadow-lg hover:border-blue-400 hover:-translate-y-1
        disabled:opacity-50 disabled:cursor-not-allowed text-left w-full
      `}
    >
      <div className="p-3 bg-slate-50 rounded-xl mb-4 group-hover:bg-blue-50 transition-colors">
        {getIcon(subject)}
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-1">{subject}</h3>
      <p className="text-sm text-slate-500">{getDescription(subject)}</p>
      
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded">Старт</div>
      </div>
    </button>
  );
};
