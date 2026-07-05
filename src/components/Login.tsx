import React, { useState } from 'react';
import { User, Lock, Eye, EyeOff, Zap, ShieldAlert, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { User as UserType } from '../types';

interface LoginProps {
  onLogin: (user: UserType) => void;
  usersList: UserType[];
  onOpenMessages: () => void;
}

export default function Login({ onLogin, usersList, onOpenMessages }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('يرجى إدخال اسم المستخدم وكلمة المرور كامليْن');
      return;
    }

    setIsLoading(true);

    // Simulate network delay for a premium feel
    setTimeout(() => {
      const foundUser = usersList.find(
        (u) =>
          u.username.toLowerCase() === username.trim().toLowerCase() &&
          u.password === password
      );

      setIsLoading(false);

      if (foundUser) {
        onLogin(foundUser);
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة، يرجى المحاولة مرة أخرى.');
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background blobs for premium depth */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -z-10 animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-slate-800/80 backdrop-blur-md border border-slate-700/80 rounded-3xl p-8 shadow-2xl space-y-8"
      >
        {/* App Logo & Title */}
        <div className="flex flex-col items-center text-center space-y-4">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: 'easeInOut' }}
            className="p-4 bg-gradient-to-tr from-blue-500 to-indigo-600 text-white rounded-2xl shadow-lg shadow-blue-500/20"
          >
            <Zap className="w-8 h-8" />
          </motion.div>
          <div className="space-y-1.5">
            <h1 className="text-2xl font-black text-white tracking-tight">بوابة تسجيل الدخول</h1>
            <p className="text-sm font-bold text-slate-400">نظام إدارة المشتركين واحتساب تكلفة الكهرباء</p>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 bg-red-500/10 border border-red-500/30 text-red-200 text-xs sm:text-sm font-bold rounded-2xl flex items-center gap-2"
            >
              <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}

          {/* Username Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-300 mr-1">اسم المستخدم</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                <User className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="block w-full text-right pr-11 pl-4 py-3.5 bg-slate-900/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl text-white font-bold placeholder-slate-500 text-sm transition-all focus:outline-none"
                placeholder="أدخل اسم المستخدم"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-black text-slate-300 mr-1">كلمة المرور</label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full text-right pr-11 pl-11 py-3.5 bg-slate-900/60 border border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-2xl text-white font-bold placeholder-slate-500 text-sm transition-all focus:outline-none"
                placeholder="أدخل كلمة المرور"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-4 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black text-sm rounded-2xl hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 transition-all shadow-lg shadow-blue-600/25 cursor-pointer"
          >
            {isLoading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>جاري تسجيل الدخول...</span>
              </div>
            ) : (
              'تسجيل الدخول'
            )}
          </button>
        </form>

      </motion.div>

      {/* Floating Messaging / Live Chat FAB in Bottom Corner */}
      <motion.button
        type="button"
        onClick={onOpenMessages}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-6 right-6 p-4 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full shadow-2xl hover:from-blue-500 hover:to-indigo-500 cursor-pointer flex items-center gap-2.5 group border border-blue-400/30 z-50 transition-all duration-300"
        title="مراسلة مدير النظام مباشرة"
      >
        <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-out text-xs font-black whitespace-nowrap opacity-0 group-hover:opacity-100 mr-1 select-none">
          مراسلة مدير النظام مباشرة
        </span>
        <div className="relative">
          <MessageSquare className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500"></span>
          </span>
        </div>
      </motion.button>
    </div>
  );
}
