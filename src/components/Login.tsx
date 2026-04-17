import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, LayoutDashboard } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';

interface LoginProps {
  onLogin: () => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err: any) {
      console.error('Auth error:', err);
      let friendlyMessage = 'Erro na autenticação. Tente novamente.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        friendlyMessage = 'E-mail ou senha incorretos.';
      }
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, insira seu e-mail.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      alert('E-mail de redefinição enviado!');
    } catch (err: any) {
      setError('Erro ao enviar e-mail de redefinição.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-[#F9FAFB] font-sans">
      {/* Left Side: Corporate Branding */}
      <div className="relative hidden w-1/2 flex-col justify-between p-16 lg:flex overflow-hidden bg-slate-900">
        <div className="absolute inset-0">
          <img 
            src="https://lh3.googleusercontent.com/d/1z3jxIAcevbaAb3C3G21m5tPmiafcXcG8" 
            alt="Corporate" 
            className="h-full w-full object-cover opacity-40 grayscale"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/60 to-transparent" />
        </div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden">
            <img 
              src="https://lh3.googleusercontent.com/d/13IU9FF0E6phDCZnfsBP4pu6WLa58nemC" 
              alt="Logo" 
              className="h-full w-full object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
          <span className="text-3xl font-light tracking-[0.3em] text-white uppercase">KAPY</span>
        </div>

        <div className="relative z-10 space-y-8">
          <motion.h1 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="text-5xl font-light leading-[1.1] text-white tracking-tight"
          >
            Gestão de <span className="text-slate-400">Excelência</span> e Resultados.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
            className="max-w-md text-sm font-light text-slate-400 leading-relaxed uppercase tracking-[0.1em]"
          >
            A plataforma definitiva para monitoramento de KPIs, consolidação de metas e gestão de performance corporativa.
          </motion.p>
        </div>

        <div className="relative z-10 flex items-center gap-6 border-t border-white/5 pt-10">
          <div className="flex -space-x-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 w-9 rounded-lg border border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden shadow-sm">
                <img 
                  src={`https://picsum.photos/seed/user${i}/64/64?grayscale`} 
                  alt="User" 
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover opacity-80"
                />
              </div>
            ))}
          </div>
          <p className="text-[10px] font-light text-slate-500 uppercase tracking-[0.2em]">
            Utilizado por <span className="text-white font-normal">500+</span> colaboradores.
          </p>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex w-full flex-col items-center justify-center p-8 lg:w-1/2 bg-white min-h-screen">
        <div className="w-full max-w-sm space-y-12">
          <div className="text-center lg:text-left">
            <div className="mb-10 flex justify-center lg:hidden">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden">
                <img 
                  src="https://lh3.googleusercontent.com/d/13IU9FF0E6phDCZnfsBP4pu6WLa58nemC" 
                  alt="Logo" 
                  className="h-full w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <h2 className="text-2xl font-normal tracking-wide text-slate-800 uppercase">
              Acesso ao Portal
            </h2>
            <p className="mt-3 text-[11px] font-light text-slate-400 uppercase tracking-widest leading-relaxed">
              Acesse sua conta para gerenciar seus indicadores e resultados.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="rounded-lg bg-[#F9F4F2] p-4 text-[10px] text-[#C57B67] border border-[#EFE2DE] uppercase tracking-widest leading-relaxed">
                {error}
              </div>
            )}
            <div className="space-y-6">
              <div className="relative">
                <Mail className="absolute left-4 top-[43px] h-3.5 w-3.5 text-slate-300 z-10" />
                <Input
                  label="E-mail Corporativo"
                  type="email"
                  placeholder="seu.nome@empresa.com"
                  className="!pl-11 !h-12 !rounded-xl !text-[10px] !font-medium !uppercase !tracking-widest !bg-slate-50/30 focus:!bg-white transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-4 top-[43px] h-3.5 w-3.5 text-slate-300 z-10" />
                <Input
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="!pl-11 !pr-11 !h-12 !rounded-xl !text-[10px] !font-medium !uppercase !tracking-widest !bg-slate-50/30 focus:!bg-white transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-[43px] text-slate-300 hover:text-slate-500 transition-colors z-10"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button 
                type="button"
                onClick={handleForgotPassword}
                className="text-[10px] font-medium text-slate-400 hover:text-slate-600 uppercase tracking-widest transition-colors"
              >
                Esqueci minha senha
              </button>
            </div>

            <Button 
              type="submit" 
              className="w-full !h-12 !rounded-lg bg-slate-800 hover:bg-slate-900 text-white shadow-sm text-[10px] uppercase tracking-[0.2em] transition-all"
              disabled={isLoading}
            >
              {isLoading ? 'Autenticando...' : 'Entrar'}
            </Button>
          </form>

          <p className="text-center text-[9px] text-slate-300 mt-10 uppercase tracking-[0.1em] leading-relaxed">
            Ao entrar, você concorda com nossos <a href="#" className="underline hover:text-slate-400">Termos</a> e <a href="#" className="underline hover:text-slate-400">Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  );
};
