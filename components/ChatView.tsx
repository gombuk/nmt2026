import React, { useState, useRef, useEffect } from 'react';
import { createNMTChat } from '../services/geminiService';
import { Chat } from "@google/genai";
import { Send, ArrowLeft, Bot, User, Sparkles, Loader2, Eraser } from 'lucide-react';

interface ChatViewProps {
  onBack: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

export const ChatView: React.FC<ChatViewProps> = ({ onBack }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'model', 
      text: 'Привіт! Я твій помічник у підготовці до НМТ. \n\nЗапитуй про будь-що зі шкільної програми: дати з історії, правила з мови, розв\'язання рівнянь з математики. Я спробую пояснити все максимально детально!' 
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Use a ref to persist the chat session across renders
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize chat session on mount
    chatSessionRef.current = createNMTChat();
  }, []);

  useEffect(() => {
    // Scroll to bottom whenever messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userText = inputValue;
    setInputValue('');
    setLoading(true);

    // Add user message to UI immediately
    setMessages(prev => [...prev, { role: 'user', text: userText }]);

    try {
      if (!chatSessionRef.current) {
         chatSessionRef.current = createNMTChat();
      }

      // Send to Gemini
      const response = await chatSessionRef.current.sendMessage({ message: userText });
      
      // Add model response to UI
      if (response.text) {
          setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      } else {
          throw new Error("Empty response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Вибач, сталася помилка при отриманні відповіді. Спробуй, будь ласка, ще раз." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to clear chat
  const handleClear = () => {
     chatSessionRef.current = createNMTChat();
     setMessages([{ 
      role: 'model', 
      text: 'Чат очищено. Я готовий до нових запитань про НМТ!' 
    }]);
  };

  // Simple Markdown renderer with support for bold (**text**) and basic LaTeX cleanup ($text$)
  const renderMessageContent = (text: string) => {
    return text.split('\n').map((line, index, array) => {
      // Empty lines
      if (line.trim() === '') {
          // Only render a break if it's not the last line
          return index < array.length - 1 ? <br key={index} /> : null;
      }
      
      // Headers
      if (line.startsWith('### ')) return <h4 key={index} className="font-bold text-base mt-2 mb-1">{line.replace('### ', '')}</h4>;
      if (line.startsWith('## ')) return <h3 key={index} className="font-bold text-lg mt-3 mb-2">{line.replace('## ', '')}</h3>;
      
      // Helper for inline styles
      const parseInline = (content: string) => {
        // Split by bold (**...**) AND LaTeX math ($...$)
        const parts = content.split(/(\*\*.*?\*\*|\$.*?\$)/g);
        return parts.map((part, i) => {
             if (part.startsWith('**') && part.endsWith('**')) {
                 return <strong key={i}>{part.slice(2, -2)}</strong>;
             }
             if (part.startsWith('$') && part.endsWith('$')) {
                 // Render math-like text cleanly without dollar signs
                 return <span key={i} className="font-mono text-purple-700 bg-purple-50 px-1 rounded mx-0.5">{part.slice(1, -1)}</span>;
             }
             return part;
        });
      };

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.replace(/^[-*]\s+/, '');
        return (
          <div key={index} className="flex items-start ml-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-current mt-2 mr-2 flex-shrink-0 opacity-70"></div>
             <span>{parseInline(content)}</span>
          </div>
        );
      }

      // Regular paragraphs
      return (
        <p key={index} className="mb-1 leading-relaxed">
           {parseInline(line)}
        </p>
      );
    });
  };

  return (
    <div className="max-w-4xl mx-auto w-full h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-300">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center">
            <button 
                onClick={onBack}
                className="mr-3 p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                    <Sparkles className="w-4 h-4 text-purple-500 mr-2" />
                    AI Помічник
                </h2>
                <p className="text-xs text-slate-500">Запитуй про будь-яку тему НМТ</p>
            </div>
        </div>
        <button 
            onClick={handleClear}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Очистити чат"
        >
            <Eraser className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
             {/* Avatar */}
             <div className={`
                w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm
                ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}
             `}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
             </div>

             {/* Bubble */}
             <div className={`
                max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-2xl shadow-sm text-sm sm:text-base
                ${msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}
             `}>
                {renderMessageContent(msg.text)}
             </div>
          </div>
        ))}
        
        {loading && (
             <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5" />
                 </div>
                 <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-sm text-slate-500 font-medium">Думаю над відповіддю...</span>
                 </div>
             </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t border-slate-100 shrink-0">
         <div className="flex items-end gap-2 max-w-4xl mx-auto relative">
             <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Наприклад: Коли почалася Друга світова війна?"
                className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-2xl px-4 py-3 pr-12 resize-none text-slate-800 placeholder:text-slate-400 transition-all max-h-32 min-h-[52px]"
                rows={1}
                style={{ height: 'auto', minHeight: '52px' }}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
             />
             <button
                onClick={handleSend}
                disabled={!inputValue.trim() || loading}
                className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
             >
                <Send className="w-5 h-5" />
             </button>
         </div>
         <p className="text-xs text-center text-slate-400 mt-2">
             ШІ може робити помилки. Перевіряйте важливу інформацію.
         </p>
      </div>
    </div>
  );
};