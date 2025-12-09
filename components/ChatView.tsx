import React, { useState, useRef, useEffect } from 'react';
import { createNMTChat } from '../services/geminiService';
import { Chat } from "@google/genai";
import { Send, ArrowLeft, Bot, User, Sparkles, Loader2, Eraser, Mic, MicOff, Volume2, VolumeX, StopCircle, Settings, X, AlertTriangle } from 'lucide-react';

interface ChatViewProps {
  onBack: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface VoiceSettings {
  voiceURI: string;
  rate: number;
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
  const [isListening, setIsListening] = useState(false);
  const [isSoundOn, setIsSoundOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceURI: '',
    rate: 1.0
  });
  
  // Use a ref to persist the chat session across renders
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);

  useEffect(() => {
    // Initialize chat session on mount
    chatSessionRef.current = createNMTChat();
    
    // Load saved settings
    const savedSettings = localStorage.getItem('nmt_voice_settings');
    if (savedSettings) {
        try {
            const parsed = JSON.parse(savedSettings);
            setVoiceSettings(parsed);
        } catch (e) {
            console.error("Failed to load voice settings", e);
        }
    }

    // Initialize Speech Synthesis
    if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis;
        
        const loadVoices = () => {
             const voices = window.speechSynthesis.getVoices();
             
             if (voices.length === 0) return; // Wait for voices to load

             // Filter for Ukrainian voices
             const ukVoices = voices.filter(v => 
                v.lang.toLowerCase().includes('uk') || 
                v.lang.toLowerCase().includes('ua')
             );
             
             // Sort to prioritize Google/Premium voices which sound more human
             ukVoices.sort((a, b) => {
                 const isAGoogle = a.name.includes('Google') || a.name.includes('Premium') || a.name.includes('Neural');
                 const isBGoogle = b.name.includes('Google') || b.name.includes('Premium') || b.name.includes('Neural');
                 if (isAGoogle && !isBGoogle) return -1;
                 if (!isAGoogle && isBGoogle) return 1;
                 return 0;
             });

             setAvailableVoices(ukVoices);

             // Set default voice if none selected or selected is invalid
             setVoiceSettings(prev => {
                 // Check if the currently selected voice still exists
                 const isValid = ukVoices.find(v => v.voiceURI === prev.voiceURI);
                 
                 // If not valid or empty, pick the first one, or leave empty (system default)
                 if (!prev.voiceURI || !isValid) {
                     return { ...prev, voiceURI: ukVoices[0]?.voiceURI || '' };
                 }
                 return prev;
             });
        };

        // Try loading immediately
        loadVoices();
        
        // Setup listener for async loading (Chrome/Android)
        window.speechSynthesis.onvoiceschanged = loadVoices;

        // Force a periodic check for the first few seconds (failsafe for some browsers)
        const intervalId = setInterval(() => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                loadVoices();
                // If we found voices, we can stop polling, BUT we keep polling if we specifically haven't found UK voices yet
                // to be safe, we just clear it after we get *any* voices to save resources
                clearInterval(intervalId);
            }
        }, 500);

        // Cleanup after 5 seconds to stop polling anyway
        setTimeout(() => clearInterval(intervalId), 5000);
    }

    // Check for Speech Recognition support
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'uk-UA';

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputValue((prev) => {
                const newValue = prev ? `${prev} ${transcript}` : transcript;
                return newValue;
            });
            setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognitionRef.current.onend = () => {
            setIsListening(false);
        };
    }

    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        if (synthRef.current) {
            synthRef.current.cancel();
        }
        if (window.speechSynthesis) {
             window.speechSynthesis.onvoiceschanged = null;
        }
    }
  }, []);

  // Save settings when changed
  useEffect(() => {
      localStorage.setItem('nmt_voice_settings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const speakText = (text: string) => {
      if (!synthRef.current) return;

      synthRef.current.cancel();

      const cleanText = text
        .replace(/[*#_`]/g, '')
        .replace(/\$/g, '') 
        .replace(/\[.*?\]/g, '')
        .replace(/\n/g, '. ');

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = voiceSettings.rate;
      utterance.pitch = 1.0;
      // CRITICAL: Always set lang to uk-UA as a fallback
      utterance.lang = 'uk-UA';

      // Find the selected voice object
      const voices = synthRef.current.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
      
      if (selectedVoice) {
          utterance.voice = selectedVoice;
      } 
      // If no selectedVoice, the browser will try to use the system default for 'uk-UA'

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = (e) => {
          console.error("Speech synthesis error", e);
          setIsSpeaking(false);
      };

      synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
      if (synthRef.current) {
          synthRef.current.cancel();
          setIsSpeaking(false);
      }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || loading) return;

    const userText = inputValue;
    setInputValue('');
    setLoading(true);
    stopSpeaking();

    setMessages(prev => [...prev, { role: 'user', text: userText }]);

    try {
      if (!chatSessionRef.current) {
         chatSessionRef.current = createNMTChat();
      }

      const response = await chatSessionRef.current.sendMessage({ message: userText });
      
      if (response.text) {
          setMessages(prev => [...prev, { role: 'model', text: response.text }]);
          if (isSoundOn) {
              speakText(response.text);
          }
      } else {
          throw new Error("Empty response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorText = "Вибач, сталася помилка при отриманні відповіді. Спробуй, будь ласка, ще раз.";
      setMessages(prev => [...prev, { role: 'model', text: errorText }]);
      if (isSoundOn) speakText(errorText);
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

  const handleClear = () => {
     chatSessionRef.current = createNMTChat();
     stopSpeaking();
     setMessages([{ 
      role: 'model', 
      text: 'Чат очищено. Я готовий до нових запитань про НМТ!' 
    }]);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
        alert("Ваш браузер не підтримує голосовий ввід.");
        return;
    }

    if (isListening) {
        recognitionRef.current.stop();
    } else {
        stopSpeaking();
        recognitionRef.current.start();
        setIsListening(true);
    }
  };

  const renderMessageContent = (text: string) => {
    return text.split('\n').map((line, index, array) => {
      if (line.trim() === '') return index < array.length - 1 ? <br key={index} /> : null;
      if (line.startsWith('### ')) return <h4 key={index} className="font-bold text-base mt-2 mb-1">{line.replace('### ', '')}</h4>;
      if (line.startsWith('## ')) return <h3 key={index} className="font-bold text-lg mt-3 mb-2">{line.replace('## ', '')}</h3>;
      
      const parseInline = (content: string) => {
        const parts = content.split(/(\*\*.*?\*\*|\$.*?\$)/g);
        return parts.map((part, i) => {
             if (part.startsWith('**') && part.endsWith('**')) {
                 return <strong key={i}>{part.slice(2, -2)}</strong>;
             }
             if (part.startsWith('$') && part.endsWith('$')) {
                 return <span key={i} className="font-mono text-purple-700 bg-purple-50 px-1 rounded mx-0.5">{part.slice(1, -1)}</span>;
             }
             return part;
        });
      };

      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const content = line.replace(/^[-*]\s+/, '');
        return (
          <div key={index} className="flex items-start ml-2 mb-1">
             <div className="w-1.5 h-1.5 rounded-full bg-current mt-2 mr-2 flex-shrink-0 opacity-70"></div>
             <span>{parseInline(content)}</span>
          </div>
        );
      }

      return (
        <p key={index} className="mb-1 leading-relaxed">
           {parseInline(line)}
        </p>
      );
    });
  };

  // Test current voice settings
  const testVoice = () => {
      stopSpeaking();
      const utterance = new SpeechSynthesisUtterance("Це перевірка голосу. Успіхів у підготовці до НМТ!");
      const voice = synthRef.current?.getVoices().find(v => v.voiceURI === voiceSettings.voiceURI);
      if (voice) utterance.voice = voice;
      utterance.lang = 'uk-UA'; // Ensure lang is set
      utterance.rate = voiceSettings.rate;
      synthRef.current?.speak(utterance);
  }

  return (
    <div className="max-w-4xl mx-auto w-full h-[calc(100vh-8rem)] flex flex-col bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-300 relative">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between shrink-0 z-10 relative">
        <div className="flex items-center">
            <button 
                onClick={() => { stopSpeaking(); onBack(); }}
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
        
        <div className="flex items-center space-x-1">
            <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-slate-100 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-50'}`}
                title="Налаштування голосу"
            >
                <Settings className="w-5 h-5" />
            </button>
            
            <button
                onClick={() => {
                    if (isSpeaking) {
                        stopSpeaking();
                    } else {
                        setIsSoundOn(!isSoundOn);
                    }
                }}
                className={`p-2 rounded-lg transition-colors ${isSpeaking ? 'text-red-500 hover:bg-red-50' : (isSoundOn ? 'text-blue-600 hover:bg-blue-50' : 'text-slate-400 hover:bg-slate-50')}`}
                title={isSpeaking ? "Зупинити озвучення" : (isSoundOn ? "Вимкнути звук" : "Увімкнути звук")}
            >
                {isSpeaking ? <StopCircle className="w-5 h-5 animate-pulse" /> : (isSoundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />)}
            </button>
            <button 
                onClick={handleClear}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Очистити чат"
            >
                <Eraser className="w-5 h-5" />
            </button>
        </div>

        {/* Settings Popover */}
        {showSettings && (
            <div className="absolute top-16 right-4 w-72 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-800 text-sm">Налаштування озвучки</h3>
                    <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Голос</label>
                        <select 
                            value={voiceSettings.voiceURI}
                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, voiceURI: e.target.value }))}
                            className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="">Системний голос (Автоматично)</option>
                            {availableVoices.map((voice) => (
                                <option key={voice.voiceURI} value={voice.voiceURI}>
                                    {voice.name}
                                </option>
                            ))}
                        </select>
                        {availableVoices.length === 0 && (
                            <div className="flex items-start mt-2 p-2 bg-yellow-50 rounded text-[10px] text-yellow-700">
                                <AlertTriangle className="w-3 h-3 mr-1 mt-0.5 flex-shrink-0" />
                                <span>
                                    Браузер не знайшов українських голосів. Спробуйте оновити сторінку або перевірте, чи встановлено мовний пакет "Українська" в налаштуваннях вашої системи.
                                </span>
                            </div>
                        )}
                    </div>

                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-500">Швидкість</label>
                            <span className="text-xs font-mono text-slate-700">{voiceSettings.rate}x</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.5" 
                            max="2" 
                            step="0.1" 
                            value={voiceSettings.rate}
                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                         <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>Повільно</span>
                            <span>Швидко</span>
                        </div>
                    </div>

                    <button 
                        onClick={testVoice}
                        className="w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-100 transition-colors"
                    >
                        Тест голосу
                    </button>
                </div>
            </div>
        )}
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
             <div className="flex flex-col items-start max-w-[85%] sm:max-w-[75%]">
                 <div className={`
                    px-5 py-3.5 rounded-2xl shadow-sm text-sm sm:text-base w-full
                    ${msg.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}
                 `}>
                    {renderMessageContent(msg.text)}
                 </div>
                 
                 {/* Replay Button for AI messages */}
                 {msg.role === 'model' && (
                     <button 
                        onClick={() => speakText(msg.text)}
                        className="mt-1 ml-2 text-slate-400 hover:text-purple-600 p-1 rounded-full hover:bg-purple-50 transition-colors"
                        title="Прослухати"
                     >
                         <Volume2 className="w-4 h-4" />
                     </button>
                 )}
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
             <button
                onClick={toggleListening}
                className={`
                    flex-shrink-0 p-3 rounded-xl transition-all duration-300 mb-[2px]
                    ${isListening 
                        ? 'bg-red-50 text-red-600 animate-pulse ring-2 ring-red-200' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}
                `}
                title={isListening ? "Зупинити запис" : "Голосовий ввід"}
             >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
             </button>

             <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Слухаю..." : "Наприклад: Коли почалася Друга світова війна?"}
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