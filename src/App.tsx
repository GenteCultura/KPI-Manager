import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Plus, Edit2, Trash2, ChevronLeft, ChevronRight, Users, Filter, BarChart3, LayoutDashboard, Calculator, CheckCircle2, AlertCircle, Network, Clock } from 'lucide-react';
import { Toaster, toast } from 'react-hot-toast';
import { User, AccessLevel, UserStatus, KPI, Area, Team, ConsolidatedIndicator, AuditLog, InventoryIndicator } from './types';
import { Button } from './components/ui/Button';
import { Input, Badge } from './components/ui/Input';
import { UserModal } from './components/UserModal';
import { KPIModal } from './components/KPIModal';
import { IndicatorConsolidation } from './components/IndicatorConsolidation';
import { StructureList } from './components/StructureList';
import { Login } from './components/Login';
import { ExportCenter } from './components/ExportCenter';
import { Dashboard } from './components/Dashboard';
import { OrgManagement } from './components/OrgManagement';
import { DeleteConfirmationModal } from './components/DeleteConfirmationModal';
import { AuditTrailModal } from './components/AuditTrailModal';
import { IndicatorInventory } from './components/IndicatorInventory';
import { DataLogs } from './components/DataLogs';
import { BulkImport } from './components/BulkImport';
import { Calendar } from './components/Calendar';
import { useStore } from './store/useStore';
import { toSnakeCase, toCamelCase } from './lib/mapping';
import { createAuditLog, getChanges } from './lib/audit';
import { motion, AnimatePresence } from 'framer-motion';

import { UserManagement } from './components/UserManagement';
import { Settings } from './components/Settings';
import { UserProfile } from './components/UserProfile';
import { TopNav } from './components/TopNav';
import { Homepage } from './components/Homepage';

import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, orderBy, where } from 'firebase/firestore';

type View = 'landing' | 'login' | 'dashboard' | 'users' | 'consolidation' | 'master' | 'export' | 'org' | 'inventory' | 'settings' | 'import' | 'profile' | 'logs' | 'calendar';

export default function App() {
  const { 
    users, setUsers, addUser, updateUser, deleteUser,
    kpis, setKpis, addKpi, updateKpi, deleteKpi,
    consolidations, setConsolidations, addConsolidation, deleteConsolidation,
    setAreas, setTeams, setAuditLogs, auditLogs,
    setDataLogs, dataLogs,
    inventoryIndicators, setInventoryIndicators,
    setBaseIndicators,
    setDiretorias, setDepartamentos, setGerencias, setServicos,
    setNotificationSettings,
    diretorias, departamentos, gerencias, servicos,
  } = useStore();
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<View>('login');
  const [isLoadingData, setIsLoadingData] = useState(true);

  const currentUser = useMemo(() => {
    if (!sessionUser) return null;
    
    const userFromDb = users.find(u => u.email === sessionUser.email);
    
    // Super admin logic: if the email matches the owner, force Admin access
    if (sessionUser.email === 'weslleymatheusferreira@gmail.com') {
      if (userFromDb) {
        return { ...userFromDb, accessLevel: 'Admin' as AccessLevel };
      }
      // If user doesn't exist in DB yet, return a mock Admin user so they can access the UI to create themselves
      return {
        id: sessionUser.uid,
        name: sessionUser.displayName || 'Super Admin',
        email: sessionUser.email,
        accessLevel: 'Admin' as AccessLevel,
        status: 'Ativo' as UserStatus,
        role: 'Administrador do Sistema',
        department: 'Administração',
        permissions: {
          canCreateIndicators: true,
          canEditResults: true,
          canViewOtherDepartments: true,
          allowedAreas: [],
          allowedTeams: [],
          onlyOwnIndicators: false,
          powerUser: true
        }
      } as User;
    }
    
    return userFromDb || null;
  }, [sessionUser, users]);

  const { areas, teams } = useStore();

  const filteredAreas = useMemo(() => {
    if (!currentUser || currentUser.accessLevel === 'Admin') return areas;
    const allowedAreas = currentUser.permissions?.allowedAreas || [];
    if (allowedAreas.length === 0) return [];
    return areas.filter(area => allowedAreas.includes(area.id));
  }, [currentUser, areas]);

  const filteredTeams = useMemo(() => {
    if (!currentUser || currentUser.accessLevel === 'Admin') return teams;
    const allowedTeams = currentUser.permissions?.allowedTeams || [];
    const allowedAreas = currentUser.permissions?.allowedAreas || [];
    
    return teams.filter(team => {
      const isAllowedTeam = allowedTeams.includes(team.id);
      const isAllowedArea = allowedAreas.includes(team.servicoId || '');
      return isAllowedTeam || isAllowedArea;
    });
  }, [currentUser, teams]);

  const filteredKPIs = useMemo(() => {
    if (!currentUser) return [];
    
    const activeKpis = kpis.filter(kpi => kpi.status === 'Ativo');
    if (currentUser.accessLevel === 'Admin') return activeKpis;

    return activeKpis.filter(kpi => {
      if (kpi.ownerId === currentUser.id) return true;
      if (currentUser.permissions?.onlyOwnIndicators) return false;

      const owner = users.find(u => u.id === kpi.ownerId);
      if (!owner) return false;

      if (owner.departmentId === currentUser.departmentId) return true;
      if (currentUser.permissions?.canViewOtherDepartments) return true;

      const diretoria = diretorias.find(d => d.id === owner.diretoriaId);
      if (diretoria && currentUser.permissions?.allowedAreas?.includes(diretoria.id)) return true;

      const team = teams.find(t => t.id === owner.teamId);
      if (team && currentUser.permissions?.allowedTeams?.includes(team.id)) return true;

      return false;
    });
  }, [currentUser, kpis, users, areas, teams, diretorias]);

  const filteredInventoryIndicators = useMemo(() => {
    if (!currentUser) return [];
    
    if (currentUser.accessLevel === 'Admin') return inventoryIndicators;

    return inventoryIndicators.filter(indicator => {
      if (indicator.responsibleId === currentUser.id) return true;
      if (currentUser.permissions?.onlyOwnIndicators) return false;

      const owner = users.find(u => u.id === indicator.responsibleId);
      if (!owner) return false;

      if (owner.departmentId === currentUser.departmentId) return true;
      if (currentUser.permissions?.canViewOtherDepartments) return true;

      const diretoria = diretorias.find(d => d.id === owner.diretoriaId);
      if (diretoria && currentUser.permissions?.allowedAreas?.includes(diretoria.id)) return true;

      const team = teams.find(t => t.id === owner.teamId);
      if (team && currentUser.permissions?.allowedTeams?.includes(team.id)) return true;

      return false;
    });
  }, [currentUser, inventoryIndicators, users, areas, teams, diretorias]);

  const dashboardKPIs = useMemo(() => {
    const mappedInventory = filteredInventoryIndicators.map(ind => ({
      id: ind.id,
      code: ind.code,
      name: ind.name,
      department: ind.targetRole || 'Geral',
      description: `Inventário: ${ind.name}`,
      unit: 'Número Absoluto' as const,
      polarity: ind.polarity || 'Cima',
      frequency: 'Mensal' as const,
      target: typeof ind.target === 'string' ? parseFloat(ind.target.replace(/[^0-9.]/g, '')) || 0 : ind.target,
      actual: 0,
      weight: ind.weight || 0,
      ownerId: ind.responsibleId,
      status: 'Ativo' as const,
      diretoriaId: ind.diretoriaId,
      departmentId: ind.departmentId,
      teamId: ind.teamId,
    }));

    return [...filteredKPIs, ...mappedInventory];
  }, [filteredKPIs, filteredInventoryIndicators]);

  const filteredUsers = useMemo(() => {
    if (!currentUser) return [];
    
    const activeUsers = users.filter(user => user.status === 'Ativo');
    if (currentUser.accessLevel === 'Admin') return activeUsers;

    return activeUsers.filter(user => {
      if (user.id === currentUser.id) return true;
      if (currentUser.permissions?.onlyOwnIndicators) return false;

      if (user.department === currentUser.department) return true;
      if (currentUser.permissions?.canViewOtherDepartments) return true;

      const diretoria = diretorias.find(d => d.id === user.diretoriaId);
      if (diretoria && currentUser.permissions?.allowedAreas?.includes(diretoria.id)) return true;

      const team = teams.find(t => t.id === user.teamId);
      if (team && currentUser.permissions?.allowedTeams?.includes(team.id)) return true;

      return false;
    });
  }, [currentUser, users, areas, teams, diretorias]);

  const filteredConsolidations = useMemo(() => {
    if (!currentUser) return [];
    if (currentUser.accessLevel === 'Admin') return consolidations;

    return consolidations.filter(c => {
      if (c.collaboratorId === currentUser.id) return true;
      return filteredUsers.some(u => u.id === c.collaboratorId);
    });
  }, [currentUser, consolidations, filteredUsers]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedAuditItem, setSelectedAuditItem] = useState<{ id: string, name: string } | null>(null);
  const [editingKPI, setEditingKPI] = useState<KPI | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setSessionUser(user);
      setIsAuthReady(true);
      if (!user) {
        setCurrentView('login');
      }
    });

    return () => unsubscribe();
  }, []);

  const usersRef = useRef<string>('');
  
  // Real-time users listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady) return;

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const camelData = toCamelCase(data);
      const dataString = JSON.stringify(camelData);
      
      if (dataString !== usersRef.current) {
        usersRef.current = dataString;
        setUsers(camelData);
        console.log('Users updated:', snapshot.size, 'docs');
      }
      setIsLoadingData(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
      setIsLoadingData(false);
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady]);

  // Real-time KPIs listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady || !currentUser) return;

    let q = collection(db, 'kpis') as any;
    const isRestricted = currentUser.accessLevel === 'Visualizador' || currentUser.permissions?.onlyOwnIndicators;
    
    if (isRestricted && currentUser.accessLevel !== 'Admin') {
      q = query(q, where('owner_id', '==', currentUser.id));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`[Firestore Debug] Fetching from collection: 'kpis'. Received ${snapshot.size} documents.`);
      if (snapshot.size === 0) {
        console.warn('[Firestore Debug] KPI collection is empty or query returned no results.');
      }
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setKpis(toCamelCase(data));
    }, (error) => {
      console.error('[Firestore Debug] Error fetching KPIs:', error);
      handleFirestoreError(error, OperationType.LIST, 'kpis');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady, currentUser]);

  // Real-time Consolidations listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady || !currentUser) return;

    let q = collection(db, 'consolidations') as any;
    const isRestricted = currentUser.accessLevel === 'Visualizador' || currentUser.permissions?.onlyOwnIndicators;

    if (isRestricted && currentUser.accessLevel !== 'Admin') {
      q = query(q, where('collaborator_id', '==', currentUser.id));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Consolidations snapshot received:', snapshot.size, 'docs');
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setConsolidations(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'consolidations');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady, currentUser]);

  // Real-time hierarchy listeners
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady) return;

    const unsubDiretorias = onSnapshot(collection(db, 'diretorias'), (snapshot) => {
      setDiretorias(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'diretorias');
    });
    const unsubDepartamentos = onSnapshot(collection(db, 'departamentos'), (snapshot) => {
      setDepartamentos(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'departamentos');
    });
    const unsubGerencias = onSnapshot(collection(db, 'gerencias'), (snapshot) => {
      setGerencias(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'gerencias');
    });
    const unsubServicos = onSnapshot(collection(db, 'servicos'), (snapshot) => {
      setServicos(toCamelCase(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'servicos');
    });

    return () => {
      unsubDiretorias();
      unsubDepartamentos();
      unsubGerencias();
      unsubServicos();
    };
  }, [isAuthenticated, isAuthReady]);

  // Real-time Areas listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady) return;

    const unsubscribe = onSnapshot(collection(db, 'areas'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAreas(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'areas');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady]);

  // Real-time Teams listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady) return;

    const unsubscribe = onSnapshot(collection(db, 'teams'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTeams(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'teams');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady]);

  // Real-time Audit Logs listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady || currentUser?.accessLevel !== 'Admin') return;

    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAuditLogs(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady, currentUser]);

  // Real-time Data Logs listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady || currentUser?.accessLevel !== 'Admin') return;

    const q = query(collection(db, 'data_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDataLogs(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'data_logs');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady, currentUser]);

  // Real-time Inventory Indicators listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady || !currentUser) return;

    let q = collection(db, 'inventory_indicators') as any;
    const isRestricted = currentUser.accessLevel === 'Visualizador' || currentUser.permissions?.onlyOwnIndicators;

    if (isRestricted && currentUser.accessLevel !== 'Admin') {
      q = query(q, where('responsible_id', '==', currentUser.id));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setInventoryIndicators(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'inventory_indicators');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady, currentUser]);

  // Real-time Base Indicators (Templates) listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady || !currentUser) return;

    const q = collection(db, 'base_indicators');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBaseIndicators(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'base_indicators');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady, currentUser]);

  // Real-time Settings listener
  useEffect(() => {
    if (!isAuthenticated || !isAuthReady) return;

    const unsubscribe = onSnapshot(doc(db, 'settings', 'notifications'), (snapshot) => {
      if (snapshot.exists()) {
        setNotificationSettings(toCamelCase(snapshot.data()) as any);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/notifications');
    });

    return () => unsubscribe();
  }, [isAuthenticated, isAuthReady]);
  
  const cleanObject = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
      if (newObj[key] === undefined || newObj[key] === '') {
        newObj[key] = null;
      } else if (newObj[key] !== null && typeof newObj[key] === 'object' && !Array.isArray(newObj[key])) {
        newObj[key] = cleanObject(newObj[key]);
      }
    });
    return newObj;
  };

  const handleSaveUser = async (user: User) => {
    const oldUser = users.find(u => u.id === user.id);
    const cleanedUser = cleanObject(user);
    const dbUser = toSnakeCase(cleanedUser);

    try {
      await setDoc(doc(db, 'users', user.id), dbUser, { merge: true });
      
      // Create Audit Log
      const changes = getChanges(oldUser, user, ['name', 'email', 'department', 'role', 'accessLevel', 'status', 'diretoriaId', 'departmentId', 'gerenciaId', 'servicoId', 'teamId', 'hireDate']);
      await createAuditLog(user.id, user.name, oldUser ? 'UPDATE' : 'CREATE', changes);

      toast.success(editingUser ? 'Usuário atualizado!' : 'Usuário criado!');
      
      setIsUserModalOpen(false);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}`);
    }
  };

  const handleSaveKPI = async (kpi: KPI) => {
    const oldKpi = kpis.find(k => k.id === kpi.id);
    const cleanedKpi = cleanObject(kpi);
    const dbKpi = toSnakeCase(cleanedKpi);
    
    try {
      await setDoc(doc(db, 'kpis', kpi.id), dbKpi, { merge: true });
      
      const changes = getChanges(oldKpi, kpi, [
        'code', 'name', 'department', 'description', 'unit', 'polarity', 
        'frequency', 'ownerId', 'target', 'actual',
        'diretoriaId', 'departmentId', 'gerenciaId', 'servicoId', 'teamId'
      ]);
      await createAuditLog(kpi.id, kpi.name, oldKpi ? 'UPDATE' : 'CREATE', changes);

      toast.success(editingKPI ? `Indicador ${kpi.code} atualizado!` : `Indicador ${kpi.code} criado!`);
      setIsKPIModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `kpis/${kpi.id}`);
    }
  };

  const handleDeleteKPI = async (id: string) => {
    const kpiToDelete = kpis.find(k => k.id === id);
    
    try {
      await deleteDoc(doc(db, 'kpis', id));
      
      if (kpiToDelete) {
        await createAuditLog(id, kpiToDelete.name, 'DELETE');
      }

      toast.success('Indicador excluído');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `kpis/${id}`);
    }
  };

  const handleDeleteInventory = async (id: string) => {
    const indicatorToDelete = inventoryIndicators.find(i => i.id === id);
    
    try {
      await deleteDoc(doc(db, 'inventory_indicators', id));
      
      if (indicatorToDelete) {
        await createAuditLog(id, indicatorToDelete.name, 'DELETE');
      }

      toast.success('Indicador removido do inventário');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `inventory_indicators/${id}`);
    }
  };

  const handleInactivateUser = async (id: string) => {
    const user = users.find(u => u.id === id);
    if (!user) return;

    const newStatus: UserStatus = 'Inativo';

    try {
      // 1. Update User Status
      await updateDoc(doc(db, 'users', id), { status: newStatus });

      // 2. Cascade to KPIs
      const userKpis = kpis.filter(k => k.ownerId === id);
      for (const kpi of userKpis) {
        await updateDoc(doc(db, 'kpis', kpi.id), { status: newStatus });
      }

      // 3. Cascade to Inventory Indicators
      const userInvIndicators = inventoryIndicators.filter(i => i.responsibleId === id);
      for (const inv of userInvIndicators) {
        await updateDoc(doc(db, 'inventory_indicators', inv.id), { status: 'Cancelado' });
      }

      await createAuditLog(id, user.name, 'UPDATE', [{ field: 'status', oldValue: 'Ativo', newValue: 'Inativo' }]);
      toast.success(`Usuário ${user.name} e seus indicadores foram inativados.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${id}`);
    }
  };

  const handleDeleteUser = async (id: string) => {
    const userToDelete = users.find(u => u.id === id);

    try {
      // 1. Delete User
      await deleteDoc(doc(db, 'users', id));

      // 2. Cascade Delete KPIs
      const userKpis = kpis.filter(k => k.ownerId === id);
      for (const kpi of userKpis) {
        await deleteDoc(doc(db, 'kpis', kpi.id));
      }

      // 3. Cascade Delete Inventory Indicators
      const userInvIndicators = inventoryIndicators.filter(i => i.responsibleId === id);
      for (const inv of userInvIndicators) {
        await deleteDoc(doc(db, 'inventory_indicators', inv.id));
      }

      // Create Audit Log
      if (userToDelete) {
        await createAuditLog(id, userToDelete.name, 'DELETE');
      }

      toast.success('Usuário e seus indicadores foram excluídos permanentemente.');
      setIsDeleteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
    }
  };

  const confirmDeleteUser = (id: string) => {
    setUserToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsUserModalOpen(true);
  };

  const handleNewUser = () => {
    setEditingUser(null);
    setIsUserModalOpen(true);
  };

  const handleNewKPI = () => {
    setEditingKPI(null);
    setIsKPIModalOpen(true);
  };

  const handleOpenAuditTrail = (item: { id: string, name: string }) => {
    setSelectedAuditItem({ id: item.id, name: item.name });
    setIsAuditModalOpen(true);
  };

  const handleEditKPI = (kpi: KPI) => {
    setEditingKPI(kpi);
    setIsKPIModalOpen(true);
  };

  if (!isAuthReady || (isAuthenticated && isLoadingData)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F9FAFB]">
        <div className="flex flex-col items-center gap-6">
          <div className="h-8 w-8 animate-spin rounded-full border-[1.5px] border-slate-800 border-t-transparent" />
          <p className="text-[10px] font-normal text-slate-400 uppercase tracking-[0.2em]">
            {!isAuthReady ? 'Iniciando Sistema' : 'Sincronizando Dados'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-800 selection:bg-slate-100 selection:text-slate-900 font-sans">
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#fff',
            color: '#1e293b',
            fontSize: '12px',
            borderRadius: '8px',
            border: '1px solid #f1f5f9',
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            padding: '12px 16px',
          }
        }}
      />

      {isAuthenticated && (
        <TopNav 
          currentView={currentView} 
          onViewChange={setCurrentView} 
          onLogout={handleLogout}
          currentUser={currentUser}
        />
      )}

      {!isAuthenticated ? (
        <main className="min-h-screen flex items-center justify-center bg-slate-900 overflow-hidden">
          <Login onLogin={() => {
            setIsAuthenticated(true);
            setCurrentView('dashboard');
          }} />
        </main>
      ) : (
        <main className="transition-all duration-300 p-4 sm:p-6 lg:p-10 pt-8 sm:pt-12">
          <div className="mx-auto max-w-[1600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentView}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
              >
                {currentView === 'landing' && <Homepage onNavigate={setCurrentView} />}
                
                {isAuthenticated && (
                  <>
                    {currentView === 'dashboard' && (
                      <Dashboard 
                        kpis={dashboardKPIs} 
                        users={filteredUsers} 
                        consolidations={filteredConsolidations} 
                        areas={filteredAreas}
                        teams={filteredTeams}
                        isLoading={isLoadingData}
                      />
                    )}
                    {currentView === 'calendar' && <Calendar currentUser={currentUser} kpis={filteredKPIs} />}
                    {currentView === 'users' && (
                      <UserManagement 
                        users={filteredUsers} 
                        onEdit={handleEditUser} 
                        onDelete={confirmDeleteUser} 
                        onInactivate={handleInactivateUser}
                        onOpenAuditTrail={handleOpenAuditTrail}
                        onAdd={handleNewUser}
                        currentUser={currentUser}
                      />
                    )}
                    {currentView === 'settings' && (
                      <Settings 
                        users={filteredUsers} 
                        onEditUser={handleEditUser} 
                        onDeleteUser={confirmDeleteUser} 
                        onInactivateUser={handleInactivateUser}
                        onOpenAuditTrail={handleOpenAuditTrail}
                        onAddUser={handleNewUser}
                        currentUser={currentUser}
                      />
                    )}
                    {currentView === 'consolidation' && (
                      <IndicatorConsolidation 
                        users={filteredUsers} 
                        areas={filteredAreas} 
                        currentUser={currentUser} 
                        isLoading={isLoadingData}
                      />
                    )}
                    {currentView === 'master' && (
                      <StructureList 
                        kpis={filteredKPIs} 
                        users={filteredUsers} 
                        inventoryIndicators={filteredInventoryIndicators}
                        auditLogs={auditLogs}
                        onEdit={handleEditKPI}
                        onDeleteKPI={handleDeleteKPI}
                        onDeleteInventory={handleDeleteInventory}
                        onOpenAuditTrail={handleOpenAuditTrail}
                        currentUser={currentUser}
                      />
                    )}
                    {currentView === 'org' && (
                      <OrgManagement 
                        users={users} 
                        areas={filteredAreas} 
                        teams={filteredTeams}
                        diretorias={diretorias}
                        departamentos={departamentos}
                        gerencias={gerencias}
                        servicos={servicos}
                        currentUser={currentUser}
                      />
                    )}
                    {currentView === 'inventory' && (
                      <IndicatorInventory 
                        indicators={filteredInventoryIndicators} 
                        kpis={filteredKPIs} 
                        currentUser={currentUser} 
                        onOpenAuditTrail={handleOpenAuditTrail}
                      />
                    )}
                    {currentView === 'logs' && <DataLogs />}
                    {currentView === 'import' && <BulkImport />}
                    {currentView === 'profile' && currentUser && (
                      <UserProfile 
                        user={currentUser} 
                        onUpdate={(updatedUser) => {
                          updateUser(updatedUser);
                        }} 
                      />
                    )}
                    {currentView === 'export' && (
                      <ExportCenter 
                        kpis={filteredKPIs} 
                        users={filteredUsers} 
                        consolidations={filteredConsolidations} 
                        inventoryIndicators={filteredInventoryIndicators} 
                      />
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      )}

      {isAuthenticated && (
        <>
          <UserModal
            isOpen={isUserModalOpen}
            onClose={() => setIsUserModalOpen(false)}
            onSave={handleSaveUser}
            user={editingUser}
          />

          <KPIModal
            isOpen={isKPIModalOpen}
            onClose={() => setIsKPIModalOpen(false)}
            onSave={handleSaveKPI}
            users={users}
            diretorias={diretorias}
            departamentos={departamentos}
            gerencias={gerencias}
            servicos={servicos}
            teams={teams}
            initialData={editingKPI}
          />

          <AuditTrailModal
            isOpen={isAuditModalOpen}
            onClose={() => setIsAuditModalOpen(false)}
            title={selectedAuditItem?.name || ''}
            logs={auditLogs.filter(log => log.targetId === selectedAuditItem?.id)}
          />

          <DeleteConfirmationModal
            isOpen={isDeleteModalOpen}
            onClose={() => setIsDeleteModalOpen(false)}
            onConfirm={() => userToDeleteId && handleDeleteUser(userToDeleteId)}
            title="Excluir Usuário"
            message="Tem certeza que deseja excluir este usuário"
            itemName={users.find(u => u.id === userToDeleteId)?.name}
          />
        </>
      )}
    </div>
  );
}
