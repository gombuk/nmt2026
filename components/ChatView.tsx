import React, { useState, useRef, useEffect } from 'react';
import { createNMTChat, generateSpeech } from '../services/geminiService';
import { Chat } from "@google/genai";
import { Send, ArrowLeft, Bot, User, Sparkles, Loader2, Eraser, Mic, MicOff, Volume2, VolumeX, StopCircle, Settings, X, HelpCircle, Smartphone, Monitor, Apple, Cloud } from 'lucide-react';

interface ChatViewProps {
  onBack: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

interface VoiceSettings {
  voiceURI: string;
  type: 'system' | 'cloud';
  rate: number;
}

const CLOUD_VOICES = [
  { name: 'Kore (Жіночий, спокійний)', id: 'Kore' },
  { name: 'Puck (Чоловічий, енергійний)', id: 'Puck' },
  { name: 'Charon (Чоловічий, глибокий)', id: 'Charon' },
  { name: 'Fenrir (Чоловічий, швидкий)', id: 'Fenrir' },
  { name: 'Zephyr (Жіночий, м\'який)', id: 'Zephyr' },
];

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
  const [audioLoading, setAudioLoading] = useState(false);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [availableSystemVoices, setAvailableSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
    voiceURI: 'Kore', // Default to Cloud voice
    type: 'cloud',
    rate: 1.0
  });
  
  // Refs
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

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

    // Initialize Audio Context for Cloud TTS
    const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
    if (AudioContextClass) {
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }

    // Initialize System Speech Synthesis
    if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis;
        
        const loadVoices = () => {
             const voices = window.speechSynthesis.getVoices();
             
             if (voices.length === 0) return; 

             const ukVoices = voices.filter(v => 
                v.lang.toLowerCase().includes('uk') || 
                v.lang.toLowerCase().includes('ua')
             );
             
             ukVoices.sort((a, b) => {
                 const isAGoogle = a.name.includes('Google') || a.name.includes('Premium');
                 const isBGoogle = b.name.includes('Google') || b.name.includes('Premium');
                 if (isAGoogle && !isBGoogle) return -1;
                 if (!isAGoogle && isBGoogle) return 1;
                 return 0;
             });

             setAvailableSystemVoices(ukVoices);
        };

        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;

        // Failsafe polling for system voices
        const intervalId = setInterval(() => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
                loadVoices();
                clearInterval(intervalId);
            }
        }, 500);

        setTimeout(() => clearInterval(intervalId), 5000);
    }

    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'uk-UA';

        recognitionRef.current.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            setInputValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
            setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
        };

        recognitionRef.current.onend = () => setIsListening(false);
    }

    return () => {
        if (recognitionRef.current) recognitionRef.current.stop();
        stopSpeaking();
        if (audioContextRef.current) audioContextRef.current.close();
    }
  }, []);

  // Save settings when changed
  useEffect(() => {
      localStorage.setItem('nmt_voice_settings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // --- AUDIO DECODING HELPERS ---
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const decodeAudioData = async (arrayBuffer: ArrayBuffer): Promise<AudioBuffer> => {
      if (!audioContextRef.current) throw new Error("AudioContext not initialized");
      
      // Since it's raw PCM (int16), we need to manually decode it if standard decodeAudioData fails 
      // or if the API returns raw bytes without header.
      // The instructions imply raw PCM 24kHz.
      
      const dataView = new DataView(arrayBuffer);
      const numChannels = 1;
      const sampleRate = 24000;
      const pcmData = new Int16Array(arrayBuffer);
      const frameCount = pcmData.length;
      
      const audioBuffer = audioContextRef.current.createBuffer(numChannels, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      
      for (let i = 0; i < frameCount; i++) {
          // Convert int16 to float32 (-1.0 to 1.0)
          channelData[i] = pcmData[i] / 32768.0;
      }

      return audioBuffer;
  };

  const playPcmAudio = async (base64String: string) => {
      if (!audioContextRef.current) return;
      
      // Resume context if suspended (browser policy)
      if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
      }

      try {
          const arrayBuffer = base64ToArrayBuffer(base64String);
          const audioBuffer = await decodeAudioData(arrayBuffer);
          
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          
          source.onended = () => {
              setIsSpeaking(false);
              currentSourceRef.current = null;
          };

          currentSourceRef.current = source;
          setIsSpeaking(true);
          source.start();

      } catch (e) {
          console.error("Error playing PCM audio", e);
          setIsSpeaking(false);
      }
  };

  // --- MAIN SPEAK FUNCTION ---
  const speakText = async (text: string) => {
      stopSpeaking();

      // Clean text
      const cleanText = text
        .replace(/[*#_`]/g, '')
        .replace(/\$/g, '') 
        .replace(/\[.*?\]/g, '')
        .replace(/\n/g, '. ');

      // 1. CLOUD TTS
      if (voiceSettings.type === 'cloud') {
          setAudioLoading(true);
          try {
              const base64Audio = await generateSpeech(cleanText, voiceSettings.voiceURI);
              await playPcmAudio(base64Audio);
          } catch (e) {
              console.error("Cloud TTS failed, falling back to system", e);
              // Fallback to system if cloud fails
              speakSystemText(cleanText);
          } finally {
              setAudioLoading(false);
          }
      } 
      // 2. SYSTEM TTS
      else {
          speakSystemText(cleanText);
      }
  };

  const speakSystemText = (text: string) => {
      if (!synthRef.current) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = voiceSettings.rate;
      utterance.lang = 'uk-UA';

      const voices = synthRef.current.getVoices();
      const selectedVoice = voices.find(v => v.voiceURI === voiceSettings.voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
      // Stop System TTS
      if (synthRef.current) {
          synthRef.current.cancel();
      }
      // Stop Cloud Audio
      if (currentSourceRef.current) {
          currentSourceRef.current.stop();
          currentSourceRef.current = null;
      }
      setIsSpeaking(false);
      setAudioLoading(false);
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
      return <p key={index} className="mb-1 leading-relaxed">{parseInline(line)}</p>;
    });
  };

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
                onClick={() => {
                  setShowSettings(!showSettings);
                  setShowVoiceHelp(false);
                }}
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
                {audioLoading ? <Loader2 className="w-5 h-5 animate-spin"/> : (isSpeaking ? <StopCircle className="w-5 h-5 animate-pulse" /> : (isSoundOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />))}
            </button>
            <button onClick={handleClear} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Eraser className="w-5 h-5" /></button>
        </div>

        {/* Settings Popover */}
        {showSettings && (
            <div className="absolute top-16 right-4 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {!showVoiceHelp ? (
                  <div className="p-4 space-y-4">
                    <div className="flex justify-between items-center mb-1">
                        <h3 className="font-bold text-slate-800 text-sm">Налаштування озвучки</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1">Голос</label>
                        <select 
                            value={voiceSettings.voiceURI}
                            onChange={(e) => {
                                const isCloud = CLOUD_VOICES.some(v => v.id === e.target.value);
                                setVoiceSettings(prev => ({ 
                                    ...prev, 
                                    voiceURI: e.target.value,
                                    type: isCloud ? 'cloud' : 'system'
                                }));
                            }}
                            className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <optgroup label="AI Голоси (Висока якість, Інтернет)">
                                {CLOUD_VOICES.map((v) => (
                                    <option key={v.id} value={v.id}>✨ {v.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Системні голоси (Офлайн)">
                                {availableSystemVoices.map((voice) => (
                                    <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>
                                ))}
                                {availableSystemVoices.length === 0 && <option value="" disabled>Голоси не знайдено</option>}
                            </optgroup>
                        </select>
                        
                        <button onClick={() => setShowVoiceHelp(true)} className="flex items-center mt-2 text-[11px] text-blue-600 hover:underline cursor-pointer">
                          <HelpCircle className="w-3 h-3 mr-1" /> Як встановити системний голос?
                        </button>
                    </div>

                    <div>
                        <div className="flex justify-between mb-1">
                            <label className="text-xs font-semibold text-slate-500">Швидкість (лише системні)</label>
                            <span className="text-xs font-mono text-slate-700">{voiceSettings.rate}x</span>
                        </div>
                        <input 
                            type="range" min="0.5" max="2" step="0.1" 
                            value={voiceSettings.rate}
                            disabled={voiceSettings.type === 'cloud'}
                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 disabled:opacity-50"
                        />
                    </div>
                  </div>
                ) : (
                  <div className="p-0">
                    <div className="p-3 border-b border-slate-100 flex items-center bg-slate-50">
                       <button onClick={() => setShowVoiceHelp(false)} className="mr-2 p-1 hover:bg-slate-200 rounded-full"><ArrowLeft className="w-4 h-4 text-slate-600"/></button>
                       <h3 className="font-bold text-slate-800 text-sm">Інструкція (Системні голоси)</h3>
                    </div>
                    <div className="p-4 space-y-4 max-h-96 overflow-y-auto text-xs text-slate-600">
                       <p>Якщо ви обрали "AI Голос", встановлювати нічого не потрібно. Для системних голосів:</p>
                       <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="flex items-center font-bold text-slate-800 mb-1"><Monitor className="w-3 h-3 mr-1" /> Windows</div>
                          <ol className="list-decimal list-inside space-y-1"><li>Налаштування → Час і мова → Голос.</li><li>Додати голос → <strong>Ukrainian</strong>.</li></ol>
                       </div>
                       <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div className="flex items-center font-bold text-slate-800 mb-1"><Smartphone className="w-3 h-3 mr-1" /> Android</div>
                          <ol className="list-decimal list-inside space-y-1"><li>Налаштування → Система → Мова та ввід.</li><li>Синтез мови → Шестерня → Встановити голосові дані → <strong>Українська</strong>.</li></ol>
                       </div>
                    </div>
                  </div>
                )}
            </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-grow overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50/50">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
             <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
             </div>
             <div className="flex flex-col items-start max-w-[85%] sm:max-w-[75%]">
                 <div className={`px-5 py-3.5 rounded-2xl shadow-sm text-sm sm:text-base w-full ${msg.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}`}>
                    {renderMessageContent(msg.text)}
                 </div>
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
        {(loading || audioLoading) && (
             <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center flex-shrink-0"><Bot className="w-5 h-5" /></div>
                 <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                    <span className="text-sm text-slate-500 font-medium">{audioLoading ? 'Завантажую озвучку...' : 'Думаю над відповіддю...'}</span>
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
                className={`flex-shrink-0 p-3 rounded-xl transition-all duration-300 mb-[2px] ${isListening ? 'bg-red-50 text-red-600 animate-pulse ring-2 ring-red-200' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
             >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
             </button>
             <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isListening ? "Слухаю..." : "Наприклад: Коли почалася Друга світова війна?"}
                className="w-full bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-2xl px-4 py-3 pr-12 resize-none text-slate-800 placeholder:text-slate-400 transition-all min-h-[52px]"
                rows={1}
                style={{ height: 'auto', minHeight: '52px' }}
                onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
                }}
             />
             <button onClick={handleSend} disabled={!inputValue.trim() || loading} className="absolute right-2 bottom-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"><Send className="w-5 h-5" /></button>
         </div>
         <p className="text-xs text-center text-slate-400 mt-2">ШІ може робити помилки. Перевіряйте важливу інформацію.</p>
      </div>
    </div>
  );
};