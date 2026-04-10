import React, { useState, useEffect, useMemo } from 'react';
import { KPI, DEPARTMENTS, DEPARTMENT_CODES, KPIUnit, KPIPolarity, KPIFrequency, KPICategory, User } from '../types';
import { Modal } from './ui/Modal';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Search, User as UserIcon, Check, Fingerprint } from 'lucide-react';
import { calculateKPIStatus } from '../utils/calculationEngine';

interface KPIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (kpi: KPI) => void;
  users: User[];
  diretorias: any[];
  departamentos: any[];
  gerencias: any[];
  servicos: any[];
  teams: any[];
  initialData?: KPI | null;
}

const initialKPI: KPI = {
  id: '',
  code: '',
  name: '',
  department: DEPARTMENTS[0],
  description: '',
  unit: 'Número Absoluto',
  polarity: 'Cima',
  frequency: 'Mensal',
  category: 'Produtividade',
  ownerId: '',
  status: 'Ativo'
};

export const KPIModal = ({ 
  isOpen, onClose, onSave, users, 
  diretorias, departamentos, gerencias, servicos, teams,
  initialData 
}: KPIModalProps) => {
  const [formData, setFormData] = useState<KPI>(initialKPI);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [isOwnerDropdownOpen, setIsOwnerDropdownOpen] = useState(false);
  const [unitSelection, setUnitSelection] = useState<{type: string, id: string}>({type: '', id: ''});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      const owner = users.find(u => u.id === initialData.ownerId);
      if (owner) setOwnerSearch(owner.name);

      if (initialData.diretoriaId) setUnitSelection({type: 'diretoria', id: initialData.diretoriaId});
      else if (initialData.departmentId) setUnitSelection({type: 'department', id: initialData.departmentId});
      else if (initialData.gerenciaId) setUnitSelection({type: 'gerencia', id: initialData.gerenciaId});
      else if (initialData.servicoId) setUnitSelection({type: 'servico', id: initialData.servicoId});
      else if (initialData.teamId) setUnitSelection({type: 'team', id: initialData.teamId});
      else setUnitSelection({type: '', id: ''});
    } else {
      setFormData(initialKPI);
      setOwnerSearch('');
      setUnitSelection({type: '', id: ''});
    }
  }, [initialData, isOpen, users]);

  const handleUnitChange = (value: string) => {
    if (!value) {
      setUnitSelection({type: '', id: ''});
      setFormData(prev => ({
        ...prev,
        diretoriaId: '',
        departmentId: '',
        gerenciaId: '',
        servicoId: '',
        teamId: ''
      }));
      return;
    }

    const [type, id] = value.split(':');
    setUnitSelection({type, id});
    
    setFormData(prev => ({
      ...prev,
      diretoriaId: type === 'diretoria' ? id : '',
      departmentId: type === 'department' ? id : '',
      gerenciaId: type === 'gerencia' ? id : '',
      servicoId: type === 'servico' ? id : '',
      teamId: type === 'team' ? id : ''
    }));
  };

  // Auto-generate code
  useEffect(() => {
    if (isOpen && !initialData) {
      const deptCode = DEPARTMENT_CODES[formData.department] || 'GEN';
      const sequence = '001'; 
      setFormData(prev => ({ ...prev, code: `KPI-${deptCode}-${sequence}` }));
    }
  }, [formData.department, isOpen, initialData]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.name.toLowerCase().includes(ownerSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(ownerSearch.toLowerCase())
    );
  }, [users, ownerSearch]);

  const selectedOwner = useMemo(() => {
    return users.find(u => u.id === formData.ownerId);
  }, [users, formData.ownerId]);

  const handleInputChange = (field: keyof KPI, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ownerId) {
      alert('Por favor, selecione um responsável pelo indicador.');
      return;
    }

    const status = calculateKPIStatus(formData.actual || 0, formData.target || 0, formData.polarity);
    
    onSave({ 
      ...formData, 
      id: formData.id || crypto.randomUUID(),
      kpiStatus: status
    });
    onClose();
    setFormData(initialKPI);
    setOwnerSearch('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cadastrar Novo Indicador (KPI)"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit}>Salvar Indicador</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Gestão Organizacional (Vínculo)</label>
              <select
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={unitSelection.type ? `${unitSelection.type}:${unitSelection.id}` : ""}
                onChange={(e) => handleUnitChange(e.target.value)}
              >
                <option value="">Nenhum vínculo (Geral)</option>
                
                {diretorias.length > 0 && (
                  <optgroup label="Diretorias">
                    {diretorias.map(d => <option key={d.id} value={`diretoria:${d.id}`}>{d.name}</option>)}
                  </optgroup>
                )}
                
                {departamentos.length > 0 && (
                  <optgroup label="Departamentos">
                    {departamentos.map(d => <option key={d.id} value={`department:${d.id}`}>{d.name}</option>)}
                  </optgroup>
                )}
                
                {gerencias.length > 0 && (
                  <optgroup label="Gerências">
                    {gerencias.map(g => <option key={g.id} value={`gerencia:${g.id}`}>{g.name}</option>)}
                  </optgroup>
                )}
                
                {servicos.length > 0 && (
                  <optgroup label="Serviços">
                    {servicos.map(s => <option key={s.id} value={`servico:${s.id}`}>{s.name}</option>)}
                  </optgroup>
                )}
                
                {teams.length > 0 && (
                  <optgroup label="Times">
                    {teams.map(t => <option key={t.id} value={`team:${t.id}`}>{t.name}</option>)}
                  </optgroup>
                )}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Departamento (Para Código)</label>
              <select
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <Input
              label="Código do Indicador"
              value={formData.code}
              readOnly
              className="bg-gray-50 font-mono text-indigo-600 font-semibold"
              description="Gerado automaticamente com base no departamento."
            />

            <Input
              label="Nome do Indicador"
              placeholder="Ex: Taxa de Conversão de Leads"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              required
            />

            <Input
              label="ID do Template (Generalista)"
              placeholder="Ex: TEMP-001"
              value={formData.templateId || ''}
              onChange={(e) => handleInputChange('templateId', e.target.value)}
              description="ID compartilhado para indicadores do mesmo tipo."
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Descrição / Fórmula de Cálculo</label>
              <textarea
                className="min-h-[100px] w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Explique como este KPI é medido e qual a fórmula utilizada..."
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                required
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Unidade de Medida</label>
              <select
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value as KPIUnit)}
              >
                <option value="Moeda">Moeda (R$)</option>
                <option value="Porcentagem">Porcentagem (%)</option>
                <option value="Número Absoluto">Número Absoluto</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Polaridade</label>
              <div className="flex gap-4">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="polarity"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    checked={formData.polarity === 'Cima'}
                    onChange={() => handleInputChange('polarity', 'Cima')}
                  />
                  <span className="text-sm text-gray-700">Cima</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="polarity"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    checked={formData.polarity === 'Baixo'}
                    onChange={() => handleInputChange('polarity', 'Baixo')}
                  />
                  <span className="text-sm text-gray-700">Baixo</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="polarity"
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    checked={formData.polarity === 'Igual'}
                    onChange={() => handleInputChange('polarity', 'Igual')}
                  />
                  <span className="text-sm text-gray-700">Igual</span>
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Categoria do Indicador</label>
              <select
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={formData.category}
                onChange={(e) => handleInputChange('category', e.target.value as KPICategory)}
              >
                <option value="Produtividade">Produtividade</option>
                <option value="Qualidade">Qualidade</option>
                <option value="Capacidade">Capacidade</option>
                <option value="Estratégico">Estratégico</option>
                <option value="Vaidade">Vaidade</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Frequência de Medição</label>
              <select
                className="h-10 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                value={formData.frequency}
                onChange={(e) => handleInputChange('frequency', e.target.value as KPIFrequency)}
              >
                <option value="Diário">Diário</option>
                <option value="Semanal">Semanal</option>
                <option value="Mensal">Mensal</option>
                <option value="Anual">Anual</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Meta"
                type="number"
                placeholder="0"
                value={formData.target || 0}
                onChange={(e) => handleInputChange('target', parseFloat(e.target.value) || 0)}
              />
              <Input
                label="Realizado"
                type="number"
                placeholder="0"
                value={formData.actual || 0}
                onChange={(e) => handleInputChange('actual', parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="relative flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Dono do Indicador (Responsável)</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Buscar responsável..."
                  value={ownerSearch}
                  onChange={(e) => {
                    setOwnerSearch(e.target.value);
                    setIsOwnerDropdownOpen(true);
                  }}
                  onFocus={() => setIsOwnerDropdownOpen(true)}
                />
              </div>

              {selectedOwner && !isOwnerDropdownOpen && (
                <div className="mt-2 flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <UserIcon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-indigo-900">{selectedOwner.name}</span>
                    <span className="text-[10px] text-indigo-700">{selectedOwner.email}</span>
                  </div>
                </div>
              )}

              {isOwnerDropdownOpen && (
                <div className="absolute top-full z-50 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white py-1 shadow-xl">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        onClick={() => {
                          handleInputChange('ownerId', u.id);
                          setOwnerSearch(u.name);
                          setIsOwnerDropdownOpen(false);
                        }}
                        className="flex cursor-pointer items-center justify-between px-3 py-2 hover:bg-gray-50"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{u.name}</span>
                          <span className="text-xs text-gray-500">{u.email}</span>
                        </div>
                        {formData.ownerId === u.id && <Check className="h-4 w-4 text-indigo-600" />}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-gray-500">Nenhum usuário encontrado</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </Modal>
  );
};
