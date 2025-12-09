import React, { useState, useRef, useEffect } from 'react';
import { Subject } from '../types';
import { TOPICS } from '../data/topics';
import { generateStudyNotes, generateSpeech } from '../services/geminiService';
import { ChevronRight, ArrowLeft, Book, Loader2, ScrollText, GraduationCap, CheckCircle, Volume2, StopCircle, Settings, X, HelpCircle, Monitor, Smartphone, Pause, Play, Square } from 'lucide-react';

interface StudyViewProps {
  onBack: () => void;
  onStartQuiz: (subject: Subject, topic: string) => void;
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

export const StudyView: React.FC<StudyViewProps> = ({ onBack, onStartQuiz }) => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Audio State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [availableSystemVoices, setAvailableSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({
      voiceURI: 'Kore',
      type: 'cloud',
      rate: 1.0
  });

  // Audio Refs
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
      // Load settings
      const savedSettings = localStorage.getItem('nmt_voice_settings');
      if (savedSettings) {
          try {
              setVoiceSettings(JSON.parse(savedSettings));
          } catch (e) { console.error(e); }
      }

      // Init Audio Context
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      if (AudioContextClass) {
          audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
      }

      // Init System Speech
      if ('speechSynthesis' in window) {
          synthRef.current = window.speechSynthesis;
          const loadVoices = () => {
              const voices = window.speechSynthesis.getVoices();
              if (voices.length === 0) return;
              const ukVoices = voices.filter(v => v.lang.toLowerCase().includes('uk') || v.lang.toLowerCase().includes('ua'));
              ukVoices.sort((a, b) => (a.name.includes('Google') ? -1 : 1));
              setAvailableSystemVoices(ukVoices);
          };
          loadVoices();
          window.speechSynthesis.onvoiceschanged = loadVoices;
          setTimeout(loadVoices, 1000); // Retry
      }

      return () => {
          stopSpeaking();
          if (audioContextRef.current) audioContextRef.current.close();
      }
  }, []);

  useEffect(() => {
    localStorage.setItem('nmt_voice_settings', JSON.stringify(voiceSettings));
  }, [voiceSettings]);


  // --- AUDIO LOGIC (Duplicated from ChatView for isolation) ---
  const base64ToArrayBuffer = (base64: string) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  };

  const decodeAudioData = async (arrayBuffer: ArrayBuffer): Promise<AudioBuffer> => {
      if (!audioContextRef.current) throw new Error("AudioContext not initialized");
      const dataView = new DataView(arrayBuffer);
      const numChannels = 1;
      const sampleRate = 24000;
      const pcmData = new Int16Array(arrayBuffer);
      const frameCount = pcmData.length;
      const audioBuffer = audioContextRef.current.createBuffer(numChannels, frameCount, sampleRate);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) channelData[i] = pcmData[i] / 32768.0;
      return audioBuffer;
  };

  const playPcmAudio = async (base64String: string) => {
      if (!audioContextRef.current) return;
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();

      try {
          const arrayBuffer = base64ToArrayBuffer(base64String);
          const audioBuffer = await decodeAudioData(arrayBuffer);
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          source.onended = () => { setIsSpeaking(false); setIsPaused(false); currentSourceRef.current = null; };
          currentSourceRef.current = source;
          setIsSpeaking(true);
          setIsPaused(false);
          source.start();
      } catch (e) {
          console.error("Error playing PCM", e);
          setIsSpeaking(false);
      }
  };

  const speakText = async () => {
      if (!notes) return;
      stopSpeaking();

      // Robust Markdown Cleaning for Speech
      const cleanText = notes
        // Remove headers markers at start of lines (e.g. "### Title" -> "Title")
        .replace(/^#+\s*/gm, '') 
        // Remove bold/italic markers (**text** -> text)
        .replace(/[\*_]{1,3}(.*?)[\*_]{1,3}/g, '$1') 
        // Remove any remaining markdown symbols just in case
        .replace(/[*#_`]/g, '')
        // Remove LaTeX delimiters
        .replace(/\$/g, '') 
        // Remove citations/links
        .replace(/\[.*?\]/g, '')
        // Normalize newlines to pauses
        .replace(/\n+/g, '. ');

      if (voiceSettings.type === 'cloud') {
          setAudioLoading(true);
          try {
              // Note: Gemini has limit, so we might only read the first part if extremely long
              const base64Audio = await generateSpeech(cleanText, voiceSettings.voiceURI);
              await playPcmAudio(base64Audio);
          } catch (e) {
              console.error("Cloud TTS failed", e);
              speakSystemText(cleanText); // Fallback
          } finally {
              setAudioLoading(false);
          }
      } else {
          speakSystemText(cleanText);
      }
  };

  const speakSystemText = (text: string) => {
      if (!synthRef.current) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = voiceSettings.rate;
      utterance.lang = 'uk-UA';
      const selectedVoice = synthRef.current.getVoices().find(v => v.voiceURI === voiceSettings.voiceURI);
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); };
      utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
      utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
      synthRef.current.speak(utterance);
  };

  const stopSpeaking = () => {
      if (synthRef.current) synthRef.current.cancel();
      if (currentSourceRef.current) {
          currentSourceRef.current.stop();
          currentSourceRef.current = null;
      }
      setIsSpeaking(false);
      setIsPaused(false);
      setAudioLoading(false);
  };

  const togglePause = () => {
      if (voiceSettings.type === 'cloud') {
          if (!audioContextRef.current) return;
          if (audioContextRef.current.state === 'running') {
              audioContextRef.current.suspend();
              setIsPaused(true);
          } else if (audioContextRef.current.state === 'suspended') {
              audioContextRef.current.resume();
              setIsPaused(false);
          }
      } else {
          if (!synthRef.current) return;
          if (synthRef.current.paused) {
              synthRef.current.resume();
              setIsPaused(false);
          } else if (synthRef.current.speaking) {
              synthRef.current.pause();
              setIsPaused(true);
          }
      }
  };

  const handleTopicSelect = async (subject: Subject, topic: string) => {
    setSelectedSubject(subject);
    setSelectedTopic(topic);
    setLoading(true);
    setNotes(null); // Clear previous
    stopSpeaking(); // Stop any audio
    
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
    stopSpeaking();
    setSelectedTopic(null);
    setNotes(null);
  };

  // Improved Markdown parser for display
  const renderContent = (text: string) => {
    return text.split('\n').map((line, index) => {
      // Robust Header Detection (Handles "### Title" and "###Title")
      if (line.trim().startsWith('#')) {
          const match = line.match(/^(#{1,6})\s*(.+)$/);
          if (match) {
              const level = match[1].length;
              const content = match[2];
              
              if (level === 1) return <h1 key={index} className="text-2xl font-bold text-slate-900 mt-8 mb-4">{content}</h1>;
              if (level === 2) return <h2 key={index} className="text-xl font-bold text-blue-700 mt-6 mb-3 border-b pb-1">{content}</h2>;
              return <h3 key={index} className="text-lg font-bold text-slate-800 mt-4 mb-2">{content}</h3>;
          }
      }
      
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

        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-visible min-h-[60vh] relative">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-96">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <h3 className="text-xl font-semibold text-slate-800">ШІ пише конспект...</h3>
                <p className="text-slate-500">Аналізуємо історичні джерела та структуруємо дані.</p>
             </div>
           ) : (
             <div className="p-8 sm:p-12">
                <div className="flex flex-col md:flex-row items-start justify-between mb-8 border-b border-slate-100 pb-6 relative">
                   <div className="flex-1">
                       <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wide mb-2">
                           {selectedSubject}
                       </span>
                       <h1 className="text-3xl font-bold text-slate-900">{selectedTopic}</h1>
                   </div>
                   
                   <div className="flex items-center space-x-2 mt-4 md:mt-0 bg-slate-50 p-2 rounded-xl border border-slate-100 relative">
                        {isSpeaking && (
                            <button
                                onClick={stopSpeaking}
                                className="p-2 rounded-lg transition-colors text-red-500 hover:bg-red-50"
                                title="Стоп"
                            >
                                <Square className="w-5 h-5 fill-current" />
                            </button>
                        )}

                        <button
                            onClick={() => {
                                if (isSpeaking) togglePause();
                                else speakText();
                            }}
                            disabled={!notes}
                            className={`flex items-center px-3 py-2 rounded-lg transition-colors font-medium text-sm ${
                                isSpeaking 
                                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                            }`}
                        >
                            {audioLoading ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2"/>
                            ) : isSpeaking ? (
                                isPaused ? <Play className="w-4 h-4 mr-2" /> : <Pause className="w-4 h-4 mr-2" />
                            ) : (
                                <Volume2 className="w-4 h-4 mr-2" />
                            )}
                            
                            {isSpeaking 
                                ? (isPaused ? 'Продовжити' : 'Пауза')
                                : 'Слухати'
                            }
                        </button>

                        <button
                            onClick={() => { setShowSettings(!showSettings); setShowVoiceHelp(false); }}
                            className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-slate-200 text-blue-600' : 'text-slate-400 hover:text-blue-600 hover:bg-slate-200'}`}
                        >
                            <Settings className="w-5 h-5" />
                        </button>

                         {/* Settings Popover (Absolute position relative to this container) */}
                         {showSettings && (
                            <div className="absolute top-14 right-0 w-72 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
                                {!showVoiceHelp ? (
                                <div className="p-4 space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wide">Налаштування голосу</h3>
                                        <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                    </div>
                                    <div>
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
                                            className="w-full text-sm p-2 bg-slate-50 border border-slate-200 rounded-lg outline-none"
                                        >
                                            <optgroup label="AI Голоси (Gemini)">
                                                {CLOUD_VOICES.map((v) => (
                                                    <option key={v.id} value={v.id}>✨ {v.name}</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Системні">
                                                {availableSystemVoices.map((voice) => (
                                                    <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name}</option>
                                                ))}
                                                {availableSystemVoices.length === 0 && <option value="" disabled>Немає голосів</option>}
                                            </optgroup>
                                        </select>
                                        <button onClick={() => setShowVoiceHelp(true)} className="flex items-center mt-2 text-[10px] text-blue-600 hover:underline">
                                           <HelpCircle className="w-3 h-3 mr-1" /> Немає українського голосу?
                                        </button>
                                    </div>
                                    <div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs font-semibold text-slate-500">Швидкість</span>
                                            <span className="text-xs font-mono text-slate-700">{voiceSettings.rate}x</span>
                                        </div>
                                        <input 
                                            type="range" min="0.5" max="2" step="0.1" 
                                            value={voiceSettings.rate}
                                            disabled={voiceSettings.type === 'cloud'}
                                            onChange={(e) => setVoiceSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                                            className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                    </div>
                                </div>
                                ) : (
                                    <div className="p-0">
                                        <div className="p-3 border-b border-slate-100 flex items-center bg-slate-50">
                                            <button onClick={() => setShowVoiceHelp(false)} className="mr-2 p-1 hover:bg-slate-200 rounded-full"><ArrowLeft className="w-4 h-4 text-slate-600"/></button>
                                            <h3 className="font-bold text-slate-800 text-xs">Інструкція</h3>
                                        </div>
                                        <div className="p-4 space-y-3 text-xs text-slate-600">
                                            <p><strong>Windows:</strong> Налаштування → Час і мова → Голос → Додати голос → Ukrainian.</p>
                                            <p><strong>Android:</strong> Налаштування → Система → Мова та ввід → Синтез мови → Google → Встановити голосові дані.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
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