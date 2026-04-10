import React, { useState, useRef } from 'react';
import { User, UserStatus, AccessLevel } from '../types';
import { Camera, Mail, User as UserIcon, Briefcase, Shield, Building2, Calendar, CheckCircle2, AlertCircle, Upload, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input, Badge } from './ui/Input';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface UserProfileProps {
  user: User;
  onUpdate: (updatedUser: User) => void;
}

export const UserProfile = ({ user, onUpdate }: UserProfileProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 1MB for Firestore document limit)
    if (file.size > 1024 * 1024) {
      toast.error('A imagem deve ter menos de 1MB.');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        // Update Firestore
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, {
          photo_url: base64String
        });

        // Update local state
        onUpdate({ ...user, photoUrl: base64String });
        toast.success('Foto de perfil atualizada!');
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      toast.error('Erro ao atualizar foto: ' + error.message);
      setIsUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!user.photoUrl) return;
    
    setIsUploading(true);
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, {
        photo_url: null
      });

      onUpdate({ ...user, photoUrl: undefined });
      toast.success('Foto de perfil removida.');
    } catch (error: any) {
      console.error('Error removing photo:', error);
      toast.error('Erro ao remover foto.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
        <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden"
      >
        {/* Header/Banner */}
        <div className="h-32 bg-gradient-to-r from-indigo-600 to-violet-600" />
        
        <div className="px-8 pb-8">
          <div className="relative flex justify-between items-end -mt-12 mb-6">
            {/* Profile Photo */}
            <div className="relative group">
              <div className="h-32 w-32 rounded-2xl border-4 border-white bg-slate-100 overflow-hidden shadow-md">
                {user.photoUrl ? (
                  <img 
                    src={user.photoUrl} 
                    alt={user.name} 
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-slate-400">
                    <UserIcon className="h-16 w-16" />
                  </div>
                )}
                
                {isUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-2 right-2 p-2 bg-white rounded-lg shadow-lg border border-slate-200 text-slate-600 hover:text-indigo-600 transition-all group-hover:scale-110"
                title="Alterar foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoUpload} 
                className="hidden" 
                accept="image/*"
              />
            </div>

            <div className="flex gap-2 mb-2">
              {user.photoUrl && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="text-red-600 border-red-100 hover:bg-red-50"
                  onClick={removePhoto}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remover Foto
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1 mb-8">
            <h1 className="text-2xl font-bold text-slate-900">{user.name}</h1>
            <p className="text-slate-500 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {user.email}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Professional Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Informações Profissionais</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-indigo-600">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Cargo</p>
                    <p className="text-sm font-semibold text-slate-700">{user.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-indigo-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Departamento</p>
                    <p className="text-sm font-semibold text-slate-700">{user.department}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-indigo-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Data de Admissão</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {user.hireDate ? new Date(user.hireDate).toLocaleDateString('pt-BR') : 'Não informada'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* System Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Acesso ao Sistema</h3>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-indigo-600">
                    <Shield className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Nível de Acesso</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-700">{user.accessLevel}</p>
                      <Badge variant={user.accessLevel === 'Admin' ? 'success' : 'neutral'}>
                        {user.accessLevel}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-indigo-600">
                    {user.status === 'Ativo' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <AlertCircle className="h-5 w-5 text-amber-500" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Status da Conta</p>
                    <p className="text-sm font-semibold text-slate-700">{user.status}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="h-10 w-10 rounded-lg bg-white flex items-center justify-center shadow-sm text-indigo-600">
                    <UserIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Matrícula</p>
                    <p className="text-sm font-semibold text-slate-700">{user.registrationNumber || 'N/A'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
