import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, LayoutDashboard, ArrowRight, User as UserIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { auth, db } from '../firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { User } from '../types';

interface LoginProps {
  onLogin: () => void;
}

export const Login = ({ onLogin }: LoginProps) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Update profile with name
        await updateProfile(userCredential.user, { displayName: name });
        
        // Create user profile in Firestore
        const isBootstrapAdmin = email === 'weslleymatheusferreira@gmail.com';
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          id: userCredential.user.uid,
          name: name,
          email: email,
          role: isBootstrapAdmin ? 'Admin' : 'Visualizador',
          access_level: isBootstrapAdmin ? 'Admin' : 'Visualizador',
          status: 'Ativo',
          permissions: {
            can_create_indicators: isBootstrapAdmin,
            can_edit_results: isBootstrapAdmin,
            can_view_other_departments: isBootstrapAdmin,
            allowed_teams: [],
            allowed_areas: [],
            only_own_indicators: false
          }
        });
        
        console.log('User created:', userCredential.user.uid);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('User signed in:', userCredential.user.uid);
      }
      onLogin();
    } catch (err: any) {
      console.error('Auth error:', err);
      
      let friendlyMessage = 'Erro na autenticação. Tente novamente.';
      
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        friendlyMessage = isSignUp ? 'Dados inválidos para cadastro. Verifique o e-mail e a senha.' : 'E-mail ou senha incorretos. Verifique seus dados.';
      } else if (err.code === 'auth/email-already-in-use') {
        friendlyMessage = 'Este e-mail já está em uso. Tente fazer login.';
      } else if (err.code === 'auth/weak-password') {
        friendlyMessage = 'A senha deve ter pelo menos 6 caracteres.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyMessage = 'Muitas tentativas em pouco tempo. Por segurança, aguarde alguns minutos antes de tentar novamente.';
        setIsLoading(true);
        setTimeout(() => setIsLoading(false), 5000);
      } else {
        friendlyMessage = err.message;
      }
      
      setError(friendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Por favor, insira seu e-mail para redefinir a senha.');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      alert('E-mail de redefinição de senha enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError('Erro ao enviar e-mail de redefinição. Verifique se o e-mail está correto.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Create initial user profile in Firestore if it doesn't exist
      const isBootstrapAdmin = result.user.email === 'weslleymatheusferreira@gmail.com';
      
      await setDoc(doc(db, 'users', result.user.uid), {
        id: result.user.uid,
        name: result.user.displayName || 'Usuário Google',
        email: result.user.email,
        photo_url: result.user.photoURL,
        role: isBootstrapAdmin ? 'Admin' : 'Visualizador',
        access_level: isBootstrapAdmin ? 'Admin' : 'Visualizador',
        status: 'Ativo',
        permissions: {
          can_create_indicators: isBootstrapAdmin,
          can_edit_results: isBootstrapAdmin,
          can_view_other_departments: isBootstrapAdmin,
          allowed_teams: [],
          allowed_areas: [],
          only_own_indicators: false
        }
      }, { merge: true });
      
      onLogin();
    } catch (err: any) {
      console.error('Google login error:', err);
      setError('Falha na autenticação com Google. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full overflow-hidden bg-white font-sans">
      {/* Left Side: Corporate Branding */}
      <div className="relative hidden w-1/2 flex-col justify-between p-12 lg:flex overflow-hidden bg-indigo-950">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://lh3.googleusercontent.com/d/1z3jxIAcevbaAb3C3G21m5tPmiafcXcG8" 
            alt="Bernhoeft Team" 
            className="h-full w-full object-cover opacity-90"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-indigo-950 via-indigo-950/40 to-transparent" />
        </div>

        <div className="relative z-10 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
            <LayoutDashboard className="h-6 w-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">KPI Manager</span>
        </div>

        <div className="relative z-10 space-y-6">
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-5xl font-bold leading-tight text-white"
          >
            Gestão de <span className="text-purple-300">Excelência</span> e Resultados.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-md text-lg text-slate-400"
          >
            A plataforma definitiva para monitoramento de KPIs, consolidação de metas e gestão de performance corporativa.
          </motion.p>
        </div>

        <div className="relative z-10 flex items-center gap-4 border-t border-slate-800 pt-8">
          <div className="flex -space-x-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-800 flex items-center justify-center overflow-hidden">
                <img 
                  src={`https://picsum.photos/seed/user${i}/32/32`} 
                  alt="User" 
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            Utilizado por mais de <span className="font-bold text-white">500+</span> colaboradores.
          </p>
        </div>
      </div>

      {/* Right Side: Login Form */}
      <div className="flex w-full flex-col items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <div className="mb-6 flex justify-center lg:hidden">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20">
                <LayoutDashboard className="h-7 w-7" />
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {isSignUp ? 'Crie sua conta' : 'Bem-vindo ao Portal'}
            </h2>
            <p className="mt-2 text-slate-500">
              {isSignUp 
                ? 'Preencha os dados abaixo para começar a gerenciar seus KPIs.' 
                : 'Acesse sua conta para gerenciar seus indicadores e resultados.'}
            </p>
          </div>

          {!isSignUp && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-xs py-1 h-auto"
                onClick={() => {
                  setEmail('admin@test.com');
                  setPassword('password123');
                }}
              >
                Preencher Demo
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-4 space-y-6">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-100">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {isSignUp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative"
                  >
                    <UserIcon className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
                    <Input
                      label="Nome Completo"
                      type="text"
                      placeholder="Seu Nome"
                      className="pl-10"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required={isSignUp}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="relative">
                <Mail className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
                <Input
                  label="E-mail Corporativo"
                  type="email"
                  placeholder="seu.nome@empresa.com"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-[38px] h-4 w-4 text-slate-400" />
                <Input
                  label="Senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {!isSignUp && (
              <div className="flex items-center justify-end">
                <button 
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                >
                  Esqueci minha senha
                </button>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full gap-2 py-6 text-lg shadow-lg shadow-indigo-100"
              disabled={isLoading}
            >
              {isLoading ? (isSignUp ? 'Criando conta...' : 'Autenticando...') : (isSignUp ? 'Criar Conta' : 'Entrar')}
              {!isLoading && <ArrowRight className="h-5 w-5" />}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError(null);
                }}
                className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
              >
                {isSignUp ? 'Já tem uma conta? Entre aqui' : 'Não tem uma conta? Cadastre-se'}
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-4 text-slate-500 uppercase tracking-widest text-[10px] font-bold">Ou continue com</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant="outline" 
                type="button" 
                className="gap-2 border-slate-200 hover:bg-slate-50"
                onClick={handleGoogleLogin}
                disabled={isLoading}
              >
                <img src="https://www.svgrepo.com/show/303108/google-icon-logo.svg" alt="Google" className="h-4 w-4" referrerPolicy="no-referrer" />
                Google
              </Button>
              <Button variant="outline" type="button" className="gap-2 border-slate-200 hover:bg-slate-50">
                <img src="https://www.svgrepo.com/show/303114/microsoft-logo.svg" alt="Microsoft" className="h-4 w-4" referrerPolicy="no-referrer" />
                Microsoft
              </Button>
            </div>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            Ao entrar, você concorda com nossos <a href="#" className="underline hover:text-slate-600">Termos de Uso</a> e <a href="#" className="underline hover:text-slate-600">Política de Privacidade</a>.
          </p>
        </div>
      </div>
    </div>
  );
};
