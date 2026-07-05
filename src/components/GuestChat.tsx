import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, ArrowLeft, ShieldAlert, Check, CheckCheck, Smile } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Notification } from '../types';

interface GuestChatProps {
  notifications: Notification[];
  onSendMessage: (text: string) => void;
  onBack: () => void;
}

export default function GuestChat({ notifications, onSendMessage, onBack }: GuestChatProps) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Filter messages between guest and admin
  const chatMessages = notifications
    .filter(
      (n) =>
        (n.senderId === 'guest' && n.receiverId === 'admin') ||
        (n.senderId === 'admin' && n.receiverId === 'guest')
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Auto scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const formatDateLabel = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      if (date.toDateString() === today.toDateString()) {
        return 'اليوم';
      } else if (date.toDateString() === yesterday.toDateString()) {
        return 'أمس';
      } else {
        return date.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch {
      return '';
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center p-0 sm:p-4 z-50 font-sans select-none overflow-hidden" style={{ direction: 'rtl' }}>
      {/* Background glowing decorations */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl -z-10 pointer-events-none" />

      {/* Main chat container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full h-full sm:max-w-xl sm:h-[650px] bg-slate-900/80 backdrop-blur-xl border-0 sm:border border-slate-800 sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Chat Header */}
        <div className="p-4 bg-slate-900 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-900/20">
              م
            </div>
            <div>
              <h3 className="text-sm font-black text-white">المدير العام للنظام</h3>
              <span className="text-[10px] text-emerald-400 font-extrabold flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                الدعم الفني والشكاوى
              </span>
            </div>
          </div>

          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-black text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700/60"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>خروج</span>
          </button>
        </div>

        {/* Warning Badge */}
        <div className="bg-amber-500/10 border-b border-amber-500/15 p-2.5 px-4 text-center shrink-0">
          <p className="text-[10.5px] text-amber-300 font-bold flex items-center justify-center gap-1.5">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-400" />
            <span>مرحباً بك! أنت تتواصل الآن مباشرة مع مدير النظام بصفة زائر، لا تتردد بطرح استفساراتك.</span>
          </p>
        </div>

        {/* Messages List Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/20">
          {chatMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-blue-950/40 border border-blue-800/20 flex items-center justify-center text-blue-400">
                <MessageSquare className="w-8 h-8" />
              </div>
              <p className="text-xs text-slate-400 font-black max-w-[260px] leading-relaxed">
                لا توجد رسائل سابقة. أرسل رسالتك الآن لمدير النظام وسيتم تلقي الرد والردود الإضافية فوراً هنا.
              </p>
            </div>
          ) : (
            chatMessages.map((msg, index) => {
              const isOwn = msg.senderId === 'guest';
              const showDateSeparator =
                index === 0 ||
                new Date(chatMessages[index - 1].date).toDateString() !== new Date(msg.date).toDateString();

              return (
                <React.Fragment key={msg.id}>
                  {showDateSeparator && (
                    <div className="flex justify-center my-2 shrink-0">
                      <span className="bg-slate-800/60 border border-slate-700/55 text-slate-300 text-[10px] font-black px-3 py-0.5 rounded-full shadow-sm">
                        {formatDateLabel(msg.date)}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isOwn ? 'justify-start' : 'justify-end'} animate-fade-in`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-right relative shadow-md ${
                        isOwn
                          ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-700/50 rounded-tl-none'
                      }`}
                    >
                      {/* Sender's Role description above non-own bubble */}
                      {!isOwn && (
                        <div className="text-[9px] text-blue-300 font-black mb-1 select-none">
                          {msg.senderName} ({msg.senderRole === 'admin' ? 'المدير' : 'الإدارة'})
                        </div>
                      )}

                      <div className="text-xs font-medium leading-relaxed break-words whitespace-pre-line select-text">
                        {msg.message}
                      </div>

                      {/* Status bar */}
                      <div className="flex items-center justify-end gap-1.5 mt-1.5 select-none">
                        <span className={`text-[9px] font-mono ${isOwn ? 'text-blue-200' : 'text-slate-400'}`}>
                          {formatTime(msg.date)}
                        </span>
                        {isOwn && (
                          <span className="text-blue-200">
                            {msg.read ? <CheckCheck className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form at bottom */}
        <form onSubmit={handleSubmit} className="p-3 bg-slate-900 border-t border-slate-800/80 flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="اكتب استفسارك أو رسالتك لمدير النظام..."
            className="flex-1 bg-slate-950 border border-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-xs font-black focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-right"
          />

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 shadow-md shadow-blue-900/10 shrink-0"
            title="إرسال الرسالة"
          >
            <Send className="w-4 h-4 rotate-180" />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
