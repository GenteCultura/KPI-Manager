import React, { useState, useEffect, useMemo } from 'react';
import { User, DEPARTMENTS, AVAILABLE_KPIS, AccessLevel, UserStatus, Area, Team, KPI, InventoryIndicator, Diretoria, Departamento, Gerencia, Servico } from '../types';
import { Modal } from './ui/Modal';
import { Input, Badge } from './ui/Input';
import { Button } from './ui/Button';
import { Toggle } from './ui/Toggle';
import { MultiSelect } from './ui/Toggle'; // MultiSelect is in Toggle.tsx
import { adminAuth, db } from '../firebase';
import { collection, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { useStore } from '../store/useStore';
import { toCamelCase } from '../lib/mapping';
import { Target, AlertCircle, Camera, User as UserIcon, Lock, Eye, EyeOff, Mail } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (user: User) => void;
  user?: User | null;
}

const initialUser: User = {
  id: '',
  name: '',
  email: '',
  diretoriaId: '',
  departmentId: '',
  gerenciaId: '',
  servicoId: '',
  teamId: '',
  department: DEPARTMENTS[0],
  role: '',
  accessLevel: 'Visualizador',
  status: 'Ativo',
  permissions: {
    canCreateIndicators: false,
    canEditResults: false,
    canViewOtherDepartments: false,
    allowedTeams: [],
    allowedAreas: [],
    onlyOwnIndicators: false
  },
  hireDate: new Date().toISOString().slice(0, 10),
  photoUrl: ''
};

export const UserModal = ({ isOpen, onClose, onSave, user }: UserModalProps) => {
  const { kpis, inventoryIndicators } = useStore();
  const [formData, setFormData] = useState<User>(initialUser);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [diretorias, setDiretorias] = useState<Diretoria[]>([]);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);

  const [isLoading, setIsLoading] = useState(false);

  const userKPIs = useMemo(() => kpis.filter(k => k.ownerId === user?.id), [kpis, user]);
  const userInventory = useMemo(() => inventoryIndicators.filter(i => i.responsibleId === user?.id), [inventoryIndicators, user]);
  const totalIndicators = userKPIs.length + userInventory.length;

  useEffect(() => {
    const unsubDiretorias = onSnapshot(collection(db, 'diretorias'), (snapshot) => {
      setDiretorias(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    });
    const unsubDepartamentos = onSnapshot(collection(db, 'departamentos'), (snapshot) => {
      setDepartamentos(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    });
    const unsubGerencias = onSnapshot(collection(db, 'gerencias'), (snapshot) => {
      setGerencias(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    });
    const unsubServicos = onSnapshot(collection(db, 'servicos'), (snapshot) => {
      setServicos(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    });
    const unsubTeams = onSnapshot(collection(db, 'teams'), (snapshot) => {
      setTeams(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    });
    const unsubAreas = onSnapshot(collection(db, 'areas'), (snapshot) => {
      setAreas(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    });

    return () => {
      unsubDiretorias();
      unsubDepartamentos();
      unsubGerencias();
      unsubServicos();
      unsubTeams();
      unsubAreas();
    };
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        ...initialUser,
        ...user,
        permissions: {
          ...initialUser.permissions,
          ...(user.permissions || {})
        }
      });
      setPassword('');
    } else {
      setFormData({ ...initialUser, id: crypto.randomUUID() });
      setPassword('');
    }
  }, [user, isOpen]);

  const handleInputChange = (field: keyof User, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePermissionChange = (field: keyof User['permissions'], value: any) => {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [field]: value }
    }));
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setIsLoading(true);
    try {
      await sendPasswordResetEmail(adminAuth, user.email);
      toast.success('E-mail de redefinição enviado com sucesso!');
    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast.error('Erro ao enviar e-mail: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      let finalId = formData.id;

      // If it's a new user, create in Firebase Auth first
      if (!user) {
        // Check if email already exists in Firestore first
        const q = query(collection(db, 'users'), where('email', '==', formData.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          throw new Error('Este e-mail já está cadastrado no banco de dados do sistema.');
        }

        if (!password || password.length < 6) {
          throw new Error('A senha deve ter pelo menos 6 caracteres para novos usuários.');
        }

        try {
          // Create user in Auth using the secondary app (adminAuth)
          const userCredential = await createUserWithEmailAndPassword(adminAuth, formData.email, password);
          finalId = userCredential.user.uid;
          console.log('User created in Auth with UID:', finalId);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
            throw new Error('Este e-mail já existe no sistema de autenticação (Firebase Auth).');
          } else {
            throw authError;
          }
        }
      }

      onSave({ ...formData, id: finalId });
      onClose();
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredDepts = departamentos.filter(d => d.diretoriaId === formData.diretoriaId);
  const filteredGerencias = gerencias.filter(g => g.departmentId === formData.departmentId);
  const filteredServicos = servicos.filter(s => s.gerenciaId === formData.gerenciaId);
  const filteredTeams = teams.filter(t => t.servicoId === formData.servicoId);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('photoUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? 'Editar Usuário' : 'Novo Usuário'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Salvando...' : (user ? 'Salvar Alterações' : 'Criar Usuário')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Photo */}
        <div className="flex flex-col items-center gap-4 py-2">
          <div className="relative group">
            <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-indigo-100 bg-gray-50 flex items-center justify-center">
              {formData.photoUrl ? (
                <img src={formData.photoUrl} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="h-12 w-12 text-gray-300" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center cursor-pointer shadow-lg hover:bg-indigo-700 transition-colors">
              <Camera className="h-4 w-4" />
              <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
            </label>
          </div>
          <p className="text-xs text-gray-500">Clique na câmera para alterar a foto</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Matrícula"
            placeholder="Ex: 12345"
            value={formData.registrationNumber || ''}
            onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
          />
          <Input
            label="Nome Completo"
            placeholder="Ex: Ana Silva"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            required
          />
          <Input
            label="E-mail Corporativo"
            type="email"
            placeholder="ana.silva@empresa.com"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            required
          />

          <div className="relative">
            <Lock className="absolute left-3 top-[38px] h-4 w-4 text-gray-400" />
            <Input
              label={user ? "Alterar Senha (opcional)" : "Senha de Acesso"}
              type={showPassword ? 'text' : 'password'}
              placeholder={user ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
              className="pl-10 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required={!user}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[38px] text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          
          {/* Hierarchy */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Diretoria</label>
            <select
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.diretoriaId || ''}
              onChange={(e) => {
                handleInputChange('diretoriaId', e.target.value);
                handleInputChange('departmentId', '');
                handleInputChange('gerenciaId', '');
                handleInputChange('servicoId', '');
                handleInputChange('teamId', '');
              }}
            >
              <option value="">Selecione uma diretoria</option>
              {diretorias.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Departamento</label>
            <select
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.departmentId || ''}
              onChange={(e) => {
                const dept = departamentos.find(d => d.id === e.target.value);
                handleInputChange('departmentId', e.target.value);
                handleInputChange('department', dept?.name || '');
                handleInputChange('gerenciaId', '');
                handleInputChange('servicoId', '');
                handleInputChange('teamId', '');
              }}
            >
              <option value="">Selecione um departamento</option>
              {filteredDepts.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Gerência</label>
            <select
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.gerenciaId || ''}
              onChange={(e) => {
                handleInputChange('gerenciaId', e.target.value);
                handleInputChange('servicoId', '');
                handleInputChange('teamId', '');
              }}
            >
              <option value="">Selecione uma gerência</option>
              {filteredGerencias.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Serviço</label>
            <select
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.servicoId || ''}
              onChange={(e) => {
                handleInputChange('servicoId', e.target.value);
                handleInputChange('teamId', '');
              }}
            >
              <option value="">Selecione um serviço</option>
              {filteredServicos.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Time</label>
            <select
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.teamId || ''}
              onChange={(e) => handleInputChange('teamId', e.target.value)}
            >
              <option value="">Selecione um time</option>
              {filteredTeams.map((team) => (
                <option key={team.id} value={team.id}>{team.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Cargo"
            placeholder="Ex: Gerente Comercial"
            value={formData.role}
            onChange={(e) => handleInputChange('role', e.target.value)}
            required
          />
          <Input
            label="Data de Admissão"
            type="date"
            value={formData.hireDate || ''}
            onChange={(e) => handleInputChange('hireDate', e.target.value)}
            required
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Nível de Acesso</label>
            <select
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.accessLevel}
              onChange={(e) => handleInputChange('accessLevel', e.target.value as AccessLevel)}
            >
              <option value="Admin">Admin</option>
              <option value="Gestor">Gestor</option>
              <option value="Visualizador">Visualizador</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value as UserStatus)}
            >
              <option value="Ativo">Ativo</option>
              <option value="Inativo">Inativo</option>
            </select>
          </div>
        </div>

        {/* Password Section */}
        <div className="space-y-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
            <Lock className="h-3 w-3" />
            Segurança
          </h4>
          
          {!user ? (
            <div className="space-y-1">
              <Input
                label="Senha Inicial"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-[10px] text-slate-400">Esta senha será usada para o primeiro acesso do colaborador.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Por questões de segurança, as senhas não podem ser visualizadas ou alteradas diretamente.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full gap-2 text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                onClick={handleResetPassword}
                disabled={isLoading}
              >
                <Mail className="h-4 w-4" />
                Enviar E-mail de Redefinição
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <h4 className="text-sm font-semibold text-gray-900">Permissões (RBAC)</h4>
          <div className="divide-y divide-gray-100">
            <Toggle
              label="Pode criar indicadores?"
              description="Permite a criação de novos KPIs no sistema."
              checked={formData.permissions.canCreateIndicators}
              onChange={(val) => handlePermissionChange('canCreateIndicators', val)}
            />
            <Toggle
              label="Pode editar resultados?"
              description="Permite a alimentação e edição de valores nos indicadores."
              checked={formData.permissions.canEditResults}
              onChange={(val) => handlePermissionChange('canEditResults', val)}
            />
            <Toggle
              label="Pode visualizar indicadores de outros departamentos?"
              description="Permite acesso a KPIs que não pertencem ao seu departamento."
              checked={formData.permissions.canViewOtherDepartments}
              onChange={(val) => handlePermissionChange('canViewOtherDepartments', val)}
            />
            <Toggle
              label="Visualizar apenas os próprios indicadores?"
              description="Restringe a visualização apenas aos indicadores onde o usuário é o responsável."
              checked={formData.permissions.onlyOwnIndicators}
              onChange={(val) => handlePermissionChange('onlyOwnIndicators', val)}
            />
          </div>
          
          <div className="grid grid-cols-1 gap-4 pt-2">
            <MultiSelect
              label="Áreas Liberadas para visualização"
              placeholder="Selecione as áreas..."
              options={areas.map(a => ({ label: a.name, value: a.id }))}
              selected={formData.permissions.allowedAreas}
              onChange={(val) => handlePermissionChange('allowedAreas', val)}
            />
            <MultiSelect
              label="Times Liberados para visualização"
              placeholder="Selecione os times..."
              options={teams.map(t => ({ label: t.name, value: t.id }))}
              selected={formData.permissions.allowedTeams}
              onChange={(val) => handlePermissionChange('allowedTeams', val)}
            />
          </div>
        </div>

        {user && (
          <div className="space-y-4 rounded-xl border border-indigo-100 bg-indigo-50/30 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Target className="h-4 w-4 text-indigo-600" />
                Indicadores sob responsabilidade ({totalIndicators})
              </h4>
            </div>
            
            {totalIndicators > 0 ? (
              <div className="grid grid-cols-1 gap-2">
                {userKPIs.map(kpi => (
                  <div key={kpi.id} className="flex items-center justify-between rounded-lg bg-white p-2 text-xs border border-indigo-100/50">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{kpi.code} - {kpi.name}</span>
                      <span className="text-gray-500">{kpi.department}</span>
                    </div>
                    <Badge variant={kpi.status === 'Ativo' ? 'success' : 'neutral'}>{kpi.status}</Badge>
                  </div>
                ))}
                {userInventory.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg bg-white p-2 text-xs border border-indigo-100/50">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{inv.code} - {inv.name}</span>
                      <span className="text-gray-500">Inventário</span>
                    </div>
                    <Badge variant={inv.status === 'Ativo' ? 'success' : 'neutral'}>{inv.status}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-gray-500 italic">
                <AlertCircle className="h-3.5 w-3.5" />
                Este usuário não possui indicadores vinculados.
              </div>
            )}
          </div>
        )}
      </form>
    </Modal>
  );
};
