import React, { useState, useMemo, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, ChevronRight, Layout, Network, User as UserIcon, ChevronDown, ChevronUp, GitGraph, List, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Area, Team, User, DEPARTMENTS, Diretoria, Departamento, Gerencia, Servico } from '../types';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { toast } from 'react-hot-toast';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { toSnakeCase, toCamelCase } from '../lib/mapping';
import { useStore } from '../store/useStore';

import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface OrgManagementProps {
  users: User[];
  areas?: Area[];
  teams?: Team[];
  diretorias?: Diretoria[];
  departamentos?: Departamento[];
  gerencias?: Gerencia[];
  servicos?: Servico[];
  currentUser: User | null;
}

export const OrgManagement = ({ 
  users, 
  areas: propAreas, 
  teams: propTeams,
  diretorias: propDiretorias,
  departamentos: propDepartamentos,
  gerencias: propGerencias,
  servicos: propServicos,
  currentUser
}: OrgManagementProps) => {
  const { 
    areas: storeAreas, 
    teams: storeTeams,
    diretorias: storeDiretorias,
    departamentos: storeDepartamentos,
    gerencias: storeGerencias,
    servicos: storeServicos,
    setTeams,
    setDiretorias,
    setDepartamentos,
    setGerencias,
    setServicos
  } = useStore();
  
  const areas = propAreas || storeAreas;
  const teams = propTeams || storeTeams;
  const diretorias = propDiretorias || storeDiretorias;
  const departamentos = propDepartamentos || storeDepartamentos;
  const gerencias = propGerencias || storeGerencias;
  const servicos = propServicos || storeServicos;

  const [isDiretoriaModalOpen, setIsDiretoriaModalOpen] = useState(false);
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [isGerenciaModalOpen, setIsGerenciaModalOpen] = useState(false);
  const [isServicoModalOpen, setIsServicoModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  const [editingDiretoria, setEditingDiretoria] = useState<Diretoria | null>(null);
  const [editingDept, setEditingDept] = useState<Departamento | null>(null);
  const [editingGerencia, setEditingGerencia] = useState<Gerencia | null>(null);
  const [editingServico, setEditingServico] = useState<Servico | null>(null);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<{ id: string, type: 'diretoria' | 'departamento' | 'gerencia' | 'servico' | 'team' } | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'visual'>(currentUser?.accessLevel === 'Admin' ? 'list' : 'visual');

  const isAdmin = currentUser?.accessLevel === 'Admin';

  const cleanObject = (obj: any) => {
    const newObj = { ...obj };
    Object.keys(newObj).forEach(key => {
      if (newObj[key] === undefined || newObj[key] === '') {
        newObj[key] = null;
      }
    });
    return newObj;
  };

  const handleSaveDiretoria = async (diretoria: Diretoria) => {
    try {
      const cleaned = cleanObject(diretoria);
      const dbData = toSnakeCase(cleaned);
      await setDoc(doc(db, 'diretorias', cleaned.id), dbData, { merge: true });
      
      toast.success(editingDiretoria ? 'Diretoria atualizada!' : 'Diretoria criada!');
      setIsDiretoriaModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `diretorias/${diretoria.id}`);
    }
  };

  const handleSaveDept = async (dept: Departamento) => {
    try {
      const cleaned = cleanObject(dept);
      const dbData = toSnakeCase(cleaned);
      await setDoc(doc(db, 'departamentos', cleaned.id), dbData, { merge: true });

      toast.success(editingDept ? 'Departamento atualizado!' : 'Departamento criado!');
      setIsDeptModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `departamentos/${dept.id}`);
    }
  };

  const handleSaveGerencia = async (gerencia: Gerencia) => {
    try {
      const cleaned = cleanObject(gerencia);
      const dbData = toSnakeCase(cleaned);
      await setDoc(doc(db, 'gerencias', cleaned.id), dbData, { merge: true });

      toast.success(editingGerencia ? 'Gerência atualizada!' : 'Gerência criada!');
      setIsGerenciaModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `gerencias/${gerencia.id}`);
    }
  };

  const handleSaveServico = async (servico: Servico) => {
    try {
      const cleaned = cleanObject(servico);
      const dbData = toSnakeCase(cleaned);
      await setDoc(doc(db, 'servicos', cleaned.id), dbData, { merge: true });

      toast.success(editingServico ? 'Serviço atualizado!' : 'Serviço criado!');
      setIsServicoModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `servicos/${servico.id}`);
    }
  };

  const handleSaveTeam = async (team: Team) => {
    try {
      const cleaned = cleanObject(team);
      const dbData = toSnakeCase(cleaned);
      
      await setDoc(doc(db, 'teams', cleaned.id), dbData, { merge: true });

      toast.success(editingTeam ? 'Time atualizado!' : 'Time criado!');
      setIsTeamModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `teams/${team.id}`);
    }
  };

  const handleDelete = async (id: string, type: string) => {
    const table = type === 'diretoria' ? 'diretorias' : 
                  type === 'departamento' ? 'departamentos' :
                  type === 'gerencia' ? 'gerencias' :
                  type === 'servico' ? 'servicos' : 'teams';
    try {
      await deleteDoc(doc(db, table, id));

      toast.success('Item excluído');
      setIsDeleteModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${table}/${id}`);
    }
  };

  const confirmDelete = (id: string, type: any) => {
    setDeleteConfig({ id, type });
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <Network className="h-7 w-7 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Gestão Organizacional</h1>
            <p className="text-slate-400 text-[10px] font-light tracking-widest mt-1 uppercase">Gerencie a estrutura e hierarquia da sua empresa.</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100/50 p-1 border border-slate-200/40">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[10px] font-medium uppercase tracking-widest transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <List className="h-3.5 w-3.5" /> Lista
            </button>
            <button
              onClick={() => setViewMode('visual')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-[10px] font-medium uppercase tracking-widest transition-all ${
                viewMode === 'visual' 
                  ? 'bg-white text-slate-800 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <GitGraph className="h-3.5 w-3.5" /> Visual
            </button>
          </div>
        </div>
      </div>

      {/* Admin Actions Bar */}
      {isAdmin && (
        <div className="flex flex-wrap gap-3 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-200/40 w-fit">
          <Button variant="ghost" onClick={() => { setEditingDiretoria(null); setIsDiretoriaModalOpen(true); }} className="!h-10 gap-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl px-4 text-[9px] font-medium uppercase tracking-widest transition-all">
            <Plus className="h-3.5 w-3.5" /> Diretoria
          </Button>
          <Button variant="ghost" onClick={() => { setEditingDept(null); setIsDeptModalOpen(true); }} className="!h-10 gap-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl px-4 text-[9px] font-medium uppercase tracking-widest transition-all">
            <Plus className="h-3.5 w-3.5" /> Depto
          </Button>
          <Button variant="ghost" onClick={() => { setEditingGerencia(null); setIsGerenciaModalOpen(true); }} className="!h-10 gap-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl px-4 text-[9px] font-medium uppercase tracking-widest transition-all">
            <Plus className="h-3.5 w-3.5" /> Gerência
          </Button>
          <Button variant="ghost" onClick={() => { setEditingServico(null); setIsServicoModalOpen(true); }} className="!h-10 gap-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-xl px-4 text-[9px] font-medium uppercase tracking-widest transition-all">
            <Plus className="h-3.5 w-3.5" /> Serviço
          </Button>
          <Button onClick={() => { setEditingTeam(null); setIsTeamModalOpen(true); }} className="!h-10 gap-2 !rounded-xl bg-slate-800 text-white hover:bg-slate-700 px-6 text-[9px] font-medium uppercase tracking-widest shadow-sm transition-all">
            <Plus className="h-3.5 w-3.5" /> Novo Time
          </Button>
        </div>
      )}

      <div className="mx-auto w-full">
        {viewMode === 'list' ? (
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
            {/* Hierarchy Sections */}
            <div className="space-y-10">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-100"></div>
                <h2 className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">
                  Estrutura Hierárquica
                </h2>
                <div className="h-px flex-1 bg-slate-100"></div>
              </div>
              
              {/* Diretorias */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Diretorias</h3>
                </div>
                {diretorias.length === 0 && (
                  <div className="p-10 text-center border border-dashed border-slate-200 rounded-3xl text-slate-300 text-[10px] font-light tracking-widest uppercase">
                    Nenhuma diretoria cadastrada.
                  </div>
                )}
                <div className="grid gap-3">
                  {diretorias.map(d => {
                    const manager = users.find(u => u.id === d.managerId);
                    return (
                      <div key={d.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_4px_rgba(0,0,0,0.02)] group hover:border-slate-300 transition-all duration-300">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-normal text-slate-800 uppercase tracking-tight">{d.name}</span>
                          <span className="text-[9px] text-slate-400 font-light uppercase tracking-widest">Diretor: {manager?.name || 'Não definido'}</span>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditingDiretoria(d); setIsDiretoriaModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => confirmDelete(d.id, 'diretoria')} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Departamentos */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Departamentos</h3>
                </div>
                <div className="grid gap-3">
                  {departamentos.map(dept => {
                    const dir = diretorias.find(d => d.id === dept.diretoriaId);
                    const manager = users.find(u => u.id === dept.managerId);
                    return (
                      <div key={dept.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_4px_rgba(0,0,0,0.02)] group hover:border-slate-300 transition-all duration-300">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-normal text-slate-800 uppercase tracking-tight">{dept.name}</span>
                          <div className="flex items-center gap-3 text-[9px] text-slate-400 font-light uppercase tracking-widest">
                            <span className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">{dir?.name || 'Sem Diretoria'}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                            <span>Gerente: {manager?.name || 'Não definido'}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditingDept(dept); setIsDeptModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => confirmDelete(dept.id, 'departamento')} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gerências */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Gerências</h3>
                </div>
                <div className="grid gap-3">
                  {gerencias.map(ger => {
                    const dept = departamentos.find(d => d.id === ger.departmentId);
                    const manager = users.find(u => u.id === ger.managerId);
                    return (
                      <div key={ger.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_4px_rgba(0,0,0,0.02)] group hover:border-slate-300 transition-all duration-300">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-normal text-slate-800 uppercase tracking-tight">{ger.name}</span>
                          <div className="flex items-center gap-3 text-[9px] text-slate-400 font-light uppercase tracking-widest">
                            <span className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">{dept?.name || 'Sem Depto'}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                            <span>Gerente: {manager?.name || 'Não definido'}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditingGerencia(ger); setIsGerenciaModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => confirmDelete(ger.id, 'gerencia')} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Serviços */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[9px] font-medium text-slate-400 uppercase tracking-widest">Serviços</h3>
                </div>
                <div className="grid gap-3">
                  {servicos.map(srv => {
                    const ger = gerencias.find(g => g.id === srv.gerenciaId);
                    const manager = users.find(u => u.id === srv.managerId);
                    return (
                      <div key={srv.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200/60 shadow-[0_2px_4px_rgba(0,0,0,0.02)] group hover:border-slate-300 transition-all duration-300">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-normal text-slate-800 uppercase tracking-tight">{srv.name}</span>
                          <div className="flex items-center gap-3 text-[9px] text-slate-400 font-light uppercase tracking-widest">
                            <span className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">{ger?.name || 'Sem Gerência'}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-200"></span>
                            <span>Supervisor: {manager?.name || 'Não definido'}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditingServico(srv); setIsServicoModalOpen(true); }} className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => confirmDelete(srv.id, 'servico')} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Teams Section */}
            <div className="space-y-10">
              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-100"></div>
                <h2 className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-400 whitespace-nowrap">
                  Times Operacionais
                </h2>
                <div className="h-px flex-1 bg-slate-100"></div>
              </div>
              <div className="grid gap-6">
                {teams.map(team => {
                  const servico = servicos.find(s => s.id === team.servicoId);
                  const gerencia = gerencias.find(g => g.id === (team.gerenciaId || servico?.gerenciaId));
                  const depto = departamentos.find(d => d.id === (team.deptId || gerencia?.departmentId));
                  const diretoria = diretorias.find(d => d.id === (team.diretoriaId || depto?.diretoriaId));
                  
                  const leader = users.find(u => u.id === team.leaderId);
                  const teamMembers = users.filter(u => u.teamId === team.id);
                  return (
                    <div key={team.id} className="group rounded-3xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-all hover:border-slate-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
                      <div className="flex items-start justify-between">
                        <div className="space-y-4">
                          <div className="flex flex-wrap items-center gap-2 text-[8px] font-medium text-slate-400 uppercase tracking-[0.2em]">
                            <span className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">{diretoria?.name || '...'}</span>
                            <ChevronRight className="h-2.5 w-2.5 opacity-30" />
                            <span className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">{depto?.name || '...'}</span>
                            <ChevronRight className="h-2.5 w-2.5 opacity-30" />
                            <span className="bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/50">{gerencia?.name || '...'}</span>
                          </div>
                          <div className="space-y-1">
                            <h3 className="text-lg font-normal text-slate-800 uppercase tracking-tight">{team.name}</h3>
                            <p className="text-[10px] font-light text-slate-400 uppercase tracking-widest">{servico ? servico.name : 'Serviço não definido'}</p>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-light text-slate-500 uppercase tracking-widest">
                            <UserIcon className="h-3.5 w-3.5 text-slate-300" />
                            Líder: <span className="font-medium text-slate-700">{leader ? leader.name : 'Não definido'}</span>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => { setEditingTeam(team); setIsTeamModalOpen(true); }} className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl transition-colors">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => confirmDelete(team.id, 'team')} className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-8 flex items-center justify-between border-t border-slate-50 pt-6">
                        <div className="flex -space-x-2">
                          {teamMembers.slice(0, 5).map(member => (
                            <div key={member.id} className="h-9 w-9 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-[10px] font-medium text-slate-400 shadow-sm overflow-hidden" title={member.name}>
                              {member.photoUrl ? <img src={member.photoUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : member.name.charAt(0)}
                            </div>
                          ))}
                          {teamMembers.length > 5 && (
                            <div className="h-9 w-9 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[9px] font-medium text-slate-500 shadow-sm">
                              +{teamMembers.length - 5}
                            </div>
                          )}
                        </div>
                        <span className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em]">
                          {teamMembers.length} Colaboradores
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <VisualOrganogram 
            diretorias={diretorias} 
            departamentos={departamentos} 
            gerencias={gerencias} 
            servicos={servicos} 
            teams={teams} 
            users={users} 
          />
        )}
      </div>

      {/* Hierarchy Modals */}
      <DiretoriaModal isOpen={isDiretoriaModalOpen} onClose={() => setIsDiretoriaModalOpen(false)} onSave={handleSaveDiretoria} users={users} initialData={editingDiretoria} />
      <DeptModal isOpen={isDeptModalOpen} onClose={() => setIsDeptModalOpen(false)} onSave={handleSaveDept} diretorias={diretorias} users={users} initialData={editingDept} />
      <GerenciaModal isOpen={isGerenciaModalOpen} onClose={() => setIsGerenciaModalOpen(false)} onSave={handleSaveGerencia} departamentos={departamentos} users={users} initialData={editingGerencia} />
      <ServicoModal isOpen={isServicoModalOpen} onClose={() => setIsServicoModalOpen(false)} onSave={handleSaveServico} gerencias={gerencias} users={users} initialData={editingServico} />
      <TeamModal 
        isOpen={isTeamModalOpen} 
        onClose={() => setIsTeamModalOpen(false)} 
        onSave={handleSaveTeam} 
        users={users} 
        servicos={servicos} 
        gerencias={gerencias}
        departamentos={departamentos}
        diretorias={diretorias}
        initialData={editingTeam} 
      />

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => deleteConfig && handleDelete(deleteConfig.id, deleteConfig.type)}
        title="Excluir Item"
        message="Tem certeza que deseja excluir este item da hierarquia?"
        itemName=""
      />
    </div>
  );
};

const DiretoriaModal = ({ isOpen, onClose, onSave, users, initialData }: { isOpen: boolean, onClose: () => void, onSave: (d: Diretoria) => void, users: User[], initialData?: Diretoria | null }) => {
  const [name, setName] = useState('');
  const [managerId, setManagerId] = useState('');
  useEffect(() => { 
    setName(initialData?.name || ''); 
    setManagerId(initialData?.managerId || '');
  }, [initialData, isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Diretoria" : "Nova Diretoria"}>
      <form onSubmit={e => { e.preventDefault(); onSave({ id: initialData?.id || crypto.randomUUID(), name, managerId }); }} className="space-y-4">
        <Input label="Nome da Diretoria" value={name} onChange={e => setName(e.target.value)} required />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Responsável (Diretor)</label>
          <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900" value={managerId} onChange={e => setManagerId(e.target.value)}>
            <option value="">Selecione um responsável</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
};

const DeptModal = ({ isOpen, onClose, onSave, diretorias, users, initialData }: { isOpen: boolean, onClose: () => void, onSave: (d: Departamento) => void, diretorias: Diretoria[], users: User[], initialData?: Departamento | null }) => {
  const [name, setName] = useState('');
  const [diretoriaId, setDiretoriaId] = useState('');
  const [managerId, setManagerId] = useState('');
  useEffect(() => { 
    setName(initialData?.name || ''); 
    setDiretoriaId(initialData?.diretoriaId || ''); 
    setManagerId(initialData?.managerId || '');
  }, [initialData, isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Departamento" : "Novo Departamento"}>
      <form onSubmit={e => { e.preventDefault(); onSave({ id: initialData?.id || crypto.randomUUID(), name, diretoriaId, managerId }); }} className="space-y-4">
        <Input label="Nome do Departamento" value={name} onChange={e => setName(e.target.value)} required />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Diretoria</label>
          <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900" value={diretoriaId} onChange={e => setDiretoriaId(e.target.value)} required>
            <option value="">Selecione uma diretoria</option>
            {diretorias.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Responsável (Gerente de Depto)</label>
          <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-slate-900" value={managerId} onChange={e => setManagerId(e.target.value)}>
            <option value="">Selecione um responsável</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
};

const GerenciaModal = ({ isOpen, onClose, onSave, departamentos, users, initialData }: { isOpen: boolean, onClose: () => void, onSave: (g: Gerencia) => void, departamentos: Departamento[], users: User[], initialData?: Gerencia | null }) => {
  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  useEffect(() => { 
    setName(initialData?.name || ''); 
    setDepartmentId(initialData?.departmentId || ''); 
    setManagerId(initialData?.managerId || '');
  }, [initialData, isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Gerência" : "Nova Gerência"}>
      <form onSubmit={e => { e.preventDefault(); onSave({ id: initialData?.id || crypto.randomUUID(), name, departmentId, managerId }); }} className="space-y-4">
        <Input label="Nome da Gerência" value={name} onChange={e => setName(e.target.value)} required />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Departamento</label>
          <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={departmentId} onChange={e => setDepartmentId(e.target.value)} required>
            <option value="">Selecione um departamento</option>
            {departamentos.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Responsável (Gerente)</label>
          <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={managerId} onChange={e => setManagerId(e.target.value)}>
            <option value="">Selecione um responsável</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
};

const ServicoModal = ({ isOpen, onClose, onSave, gerencias, users, initialData }: { isOpen: boolean, onClose: () => void, onSave: (s: Servico) => void, gerencias: Gerencia[], users: User[], initialData?: Servico | null }) => {
  const [name, setName] = useState('');
  const [gerenciaId, setGerenciaId] = useState('');
  const [managerId, setManagerId] = useState('');
  useEffect(() => { 
    setName(initialData?.name || ''); 
    setGerenciaId(initialData?.gerenciaId || ''); 
    setManagerId(initialData?.managerId || '');
  }, [initialData, isOpen]);
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Serviço" : "Novo Serviço"}>
      <form onSubmit={e => { e.preventDefault(); onSave({ id: initialData?.id || crypto.randomUUID(), name, gerenciaId, managerId }); }} className="space-y-4">
        <Input label="Nome do Serviço" value={name} onChange={e => setName(e.target.value)} required />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Gerência</label>
          <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={gerenciaId} onChange={e => setGerenciaId(e.target.value)} required>
            <option value="">Selecione uma gerência</option>
            {gerencias.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Responsável (Supervisor)</label>
          <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={managerId} onChange={e => setManagerId(e.target.value)}>
            <option value="">Selecione um responsável</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
};

const TeamModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  users, 
  servicos, 
  gerencias, 
  departamentos, 
  diretorias, 
  initialData 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSave: (team: Team) => void, 
  users: User[], 
  servicos: Servico[],
  gerencias: Gerencia[],
  departamentos: Departamento[],
  diretorias: Diretoria[],
  initialData?: Team | null 
}) => {
  const [name, setName] = useState('');
  const [diretoriaId, setDiretoriaId] = useState('');
  const [deptId, setDeptId] = useState('');
  const [gerenciaId, setGerenciaId] = useState('');
  const [servicoId, setServicoId] = useState('');
  const [leaderId, setLeaderId] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setDiretoriaId(initialData.diretoriaId || '');
      setDeptId(initialData.deptId || '');
      setGerenciaId(initialData.gerenciaId || '');
      setServicoId(initialData.servicoId || '');
      setLeaderId(initialData.leaderId || '');
    } else {
      setName('');
      setDiretoriaId('');
      setDeptId('');
      setGerenciaId('');
      setServicoId('');
      setLeaderId('');
    }
  }, [initialData, isOpen]);

  // Filter options based on selection
  const filteredDepts = useMemo(() => departamentos.filter(d => !diretoriaId || d.diretoriaId === diretoriaId), [departamentos, diretoriaId]);
  const filteredGers = useMemo(() => gerencias.filter(g => !deptId || g.departmentId === deptId), [gerencias, deptId]);
  const filteredSrvs = useMemo(() => servicos.filter(s => !gerenciaId || s.gerenciaId === gerenciaId), [servicos, gerenciaId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ 
      id: initialData?.id || crypto.randomUUID(), 
      name, 
      diretoriaId,
      deptId,
      gerenciaId,
      servicoId, 
      leaderId 
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={initialData ? "Editar Time" : "Novo Time"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Nome do Time" value={name} onChange={e => setName(e.target.value)} required />
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Diretoria</label>
            <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={diretoriaId} onChange={e => { setDiretoriaId(e.target.value); setDeptId(''); setGerenciaId(''); setServicoId(''); }}>
              <option value="">Selecione uma diretoria</option>
              {diretorias.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Departamento</label>
            <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={deptId} onChange={e => { setDeptId(e.target.value); setGerenciaId(''); setServicoId(''); }}>
              <option value="">Selecione um depto</option>
              {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Gerência</label>
            <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={gerenciaId} onChange={e => { setGerenciaId(e.target.value); setServicoId(''); }}>
              <option value="">Selecione uma gerência</option>
              {filteredGers.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Serviço</label>
            <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={servicoId} onChange={e => setServicoId(e.target.value)} required>
              <option value="">Selecione um serviço</option>
              {filteredSrvs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700">Líder do Time</label>
          <select className="h-10 rounded-lg border border-gray-300 px-3 text-sm" value={leaderId} onChange={e => setLeaderId(e.target.value)}>
            <option value="">Selecione um líder</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4"><Button variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit">Salvar</Button></div>
      </form>
    </Modal>
  );
};

interface VisualOrganogramProps {
  diretorias: Diretoria[];
  departamentos: Departamento[];
  gerencias: Gerencia[];
  servicos: Servico[];
  teams: Team[];
  users: User[];
}

const VisualOrganogram = ({ diretorias, departamentos, gerencias, servicos, teams, users }: VisualOrganogramProps) => {
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [scale, setScale] = useState(1);

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setScale(1);

  const renderManager = (managerId?: string) => {
    if (!managerId) return null;
    const manager = users.find(u => u.id === managerId);
    if (!manager) return null;

    return (
      <div className="mt-2 flex items-center gap-2 rounded-full bg-white/50 px-2 py-1 border border-indigo-100/50">
        <div className="h-5 w-5 overflow-hidden rounded-full border border-indigo-200 bg-gray-100 flex items-center justify-center">
          {manager.photoUrl ? (
            <img src={manager.photoUrl} alt={manager.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <UserIcon className="h-3 w-3 text-gray-400" />
          )}
        </div>
        <span className="text-[8px] font-medium text-gray-600 truncate max-w-[80px]">{manager.name}</span>
      </div>
    );
  };

  return (
    <div className="relative w-full">
      {/* Zoom Controls */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <button
          onClick={handleZoomIn}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          title="Aumentar Zoom"
        >
          <ZoomIn className="h-5 w-5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          title="Diminuir Zoom"
        >
          <ZoomOut className="h-5 w-5" />
        </button>
        <button
          onClick={handleResetZoom}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
          title="Resetar Zoom"
        >
          <Maximize className="h-5 w-5" />
        </button>
        <div className="bg-white px-2 py-1 rounded-lg shadow-md border border-slate-100 text-[10px] font-black text-slate-400 text-center">
          {Math.round(scale * 100)}%
        </div>
      </div>

      <div className="overflow-auto pb-8 min-h-[600px] bg-slate-50/30 rounded-3xl border border-slate-100">
        <motion.div 
          animate={{ scale }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          style={{ originX: 0.5, originY: 0 }}
          className="min-w-max flex flex-col items-center gap-12 p-12"
        >
          {/* CEO / Root Node */}
        <div className="flex flex-col items-center">
          <div className="relative flex flex-col items-center gap-2 rounded-2xl border-2 border-indigo-600 bg-white p-4 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white">
              <Network className="h-6 w-6" />
            </div>
            <div className="text-center">
              <h3 className="text-sm font-black text-gray-900">DIRETORIA EXECUTIVA</h3>
              <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Corporativo</p>
            </div>
            <div className="absolute -bottom-6 left-1/2 h-6 w-0.5 bg-indigo-200 -translate-x-1/2" />
          </div>
        </div>

        {/* Diretorias Level */}
        <div className="flex gap-12 relative">
          <div className="absolute -top-6 left-0 right-0 h-0.5 bg-indigo-200" />
          {diretorias.map((diretoria) => {
            const deptos = departamentos.filter(d => d.diretoriaId === diretoria.id);
            const isExpanded = expandedNodes[diretoria.id] !== false;

            return (
              <div key={diretoria.id} className="flex flex-col items-center gap-8 relative">
                <div className="absolute -top-6 left-1/2 h-6 w-0.5 bg-indigo-200 -translate-x-1/2" />
                
                {/* Diretoria Node */}
                <div 
                  onClick={() => toggleNode(diretoria.id)}
                  className={`cursor-pointer flex flex-col items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 shadow-sm transition-all hover:shadow-md ${!isExpanded ? 'opacity-70' : ''}`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm">
                    <Layout className="h-5 w-5" />
                  </div>
                  <div className="text-center">
                    <h4 className="text-xs font-bold text-gray-900 uppercase">{diretoria.name}</h4>
                    <p className="text-[9px] text-indigo-500 font-medium">{deptos.length} Departamentos</p>
                    {renderManager(diretoria.managerId)}
                  </div>
                  {deptos.length > 0 && (
                    <div className="mt-1">
                      {isExpanded ? <ChevronUp className="h-3 w-3 text-indigo-400" /> : <ChevronDown className="h-3 w-3 text-indigo-400" />}
                    </div>
                  )}
                  {isExpanded && deptos.length > 0 && (
                    <div className="absolute -bottom-8 left-1/2 h-8 w-0.5 bg-indigo-100 -translate-x-1/2" />
                  )}
                </div>

                {/* Departamentos Level */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex gap-8 relative"
                    >
                      {deptos.length > 1 && (
                        <div className="absolute -top-8 left-0 right-0 h-0.5 bg-indigo-100" />
                      )}
                      {deptos.map((dept) => {
                        const gers = gerencias.filter(g => g.departmentId === dept.id);
                        const isDeptExpanded = expandedNodes[dept.id] === true;

                        return (
                          <div key={dept.id} className="flex flex-col items-center gap-8 relative">
                            <div className="absolute -top-8 left-1/2 h-8 w-0.5 bg-indigo-100 -translate-x-1/2" />
                            
                            {/* Dept Node */}
                            <div 
                              onClick={() => toggleNode(dept.id)}
                              className={`cursor-pointer flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:shadow-md w-40 ${isDeptExpanded ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                            >
                              <div className="text-center">
                                <h5 className="text-xs font-bold text-gray-900">{dept.name}</h5>
                                <p className="text-[9px] text-gray-500">{gers.length} Gerências</p>
                                {renderManager(dept.managerId)}
                              </div>
                              {gers.length > 0 && (
                                <div className="mt-1">
                                  {isDeptExpanded ? <ChevronUp className="h-3 w-3 text-gray-400" /> : <ChevronDown className="h-3 w-3 text-gray-400" />}
                                </div>
                              )}
                            </div>

                            {/* Gerencias Level */}
                            <AnimatePresence>
                              {isDeptExpanded && (
                                <motion.div 
                                  initial={{ opacity: 0, y: -10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="flex gap-8 relative"
                                >
                                  {gers.length > 1 && (
                                    <div className="absolute -top-8 left-0 right-0 h-0.5 bg-gray-100" />
                                  )}
                                  {gers.map((ger) => {
                                    const srvs = servicos.filter(s => s.gerenciaId === ger.id);
                                    const isGerExpanded = expandedNodes[ger.id] === true;
                                    
                                    return (
                                      <div key={ger.id} className="flex flex-col items-center gap-8 relative">
                                        <div className="absolute -top-8 left-1/2 h-8 w-0.5 bg-gray-100 -translate-x-1/2" />
                                        
                                        {/* Gerencia Node */}
                                        <div 
                                          onClick={() => toggleNode(ger.id)}
                                          className={`cursor-pointer flex flex-col items-center gap-1 rounded-lg border border-gray-100 bg-gray-50 p-3 shadow-sm w-44 ${isGerExpanded ? 'ring-1 ring-indigo-400' : ''}`}
                                        >
                                          <span className="text-[10px] font-bold text-gray-900">{ger.name}</span>
                                          <span className="text-[8px] text-gray-400">{srvs.length} Serviços</span>
                                          {renderManager(ger.managerId)}
                                          {srvs.length > 0 && (
                                            <div className="mt-1">
                                              {isGerExpanded ? <ChevronUp className="h-2.5 w-2.5 text-gray-400" /> : <ChevronDown className="h-2.5 w-2.5 text-gray-400" />}
                                            </div>
                                          )}
                                        </div>

                                        {/* Servicos Level */}
                                        <AnimatePresence>
                                          {isGerExpanded && (
                                            <motion.div 
                                              initial={{ opacity: 0, y: -10 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              exit={{ opacity: 0, y: -10 }}
                                              className="flex gap-6 relative"
                                            >
                                              {srvs.length > 1 && (
                                                <div className="absolute -top-8 left-0 right-0 h-0.5 bg-gray-50" />
                                              )}
                                              {srvs.map((srv) => {
                                                const srvTeams = teams.filter(t => t.servicoId === srv.id);
                                                const isSrvExpanded = expandedNodes[srv.id] === true;

                                                return (
                                                  <div key={srv.id} className="flex flex-col items-center gap-6 relative">
                                                    <div className="absolute -top-8 left-1/2 h-8 w-0.5 bg-gray-50 -translate-x-1/2" />
                                                    
                                                    {/* Servico Node */}
                                                    <div 
                                                      onClick={() => toggleNode(srv.id)}
                                                      className={`cursor-pointer flex flex-col items-center gap-1 rounded-lg border border-gray-50 bg-white p-2 shadow-sm w-40 ${isSrvExpanded ? 'ring-1 ring-indigo-300' : ''}`}
                                                    >
                                                      <span className="text-[9px] font-bold text-gray-800">{srv.name}</span>
                                                      <span className="text-[7px] text-gray-400">{srvTeams.length} Times</span>
                                                      {renderManager(srv.managerId)}
                                                    </div>

                                                    {/* Teams Level */}
                                                    <AnimatePresence>
                                                      {isSrvExpanded && (
                                                        <motion.div 
                                                          initial={{ opacity: 0, x: -10 }}
                                                          animate={{ opacity: 1, x: 0 }}
                                                          exit={{ opacity: 0, x: -10 }}
                                                          className="flex flex-col gap-2 relative pl-4"
                                                        >
                                                          {srvTeams.map((team) => {
                                                            const leader = users.find(u => u.id === team.leaderId);
                                                            return (
                                                              <div key={team.id} className="flex items-center gap-2 relative">
                                                                <div className="absolute -left-4 top-1/2 h-0.5 w-4 bg-gray-100 -translate-y-1/2" />
                                                                <div className="flex flex-col gap-1 rounded-md border border-gray-50 bg-white p-2 shadow-sm w-44">
                                                                  <span className="text-[8px] font-black text-indigo-600 uppercase">{team.name}</span>
                                                                  <div className="flex items-center gap-1 border-b border-gray-50 pb-1 mb-1">
                                                                    <div className="h-4 w-4 overflow-hidden rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center">
                                                                      {leader?.photoUrl ? (
                                                                        <img src={leader.photoUrl} alt={leader.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                                                      ) : (
                                                                        <UserIcon className="h-2 w-2 text-gray-300" />
                                                                      )}
                                                                    </div>
                                                                    <span className="text-[7px] text-gray-500 truncate font-bold">Líder: {leader?.name || 'N/D'}</span>
                                                                  </div>
                                                                  
                                                                  {/* Team Members */}
                                                                  <div className="flex flex-col gap-0.5">
                                                                    {users.filter(u => u.teamId === team.id && u.id !== team.leaderId).map(member => (
                                                                      <div key={member.id} className="flex items-center gap-1">
                                                                        <div className="h-3 w-3 overflow-hidden rounded-full bg-gray-50 flex items-center justify-center">
                                                                          {member.photoUrl ? (
                                                                            <img src={member.photoUrl} alt={member.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                                                          ) : (
                                                                            <UserIcon className="h-1.5 w-1.5 text-gray-300" />
                                                                          )}
                                                                        </div>
                                                                        <span className="text-[6px] text-gray-400 truncate">{member.name}</span>
                                                                      </div>
                                                                    ))}
                                                                  </div>
                                                                </div>
                                                              </div>
                                                            );
                                                          })}
                                                        </motion.div>
                                                      )}
                                                    </AnimatePresence>
                                                  </div>
                                                );
                                              })}
                                            </motion.div>
                                          )}
                                        </AnimatePresence>
                                      </div>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  </div>
);
};
