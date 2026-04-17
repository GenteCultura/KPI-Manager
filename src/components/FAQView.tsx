import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Shield, 
  User, 
  Users, 
  Settings, 
  BarChart3, 
  Info, 
  Database, 
  Calculator, 
  TrendingUp, 
  FileSpreadsheet, 
  History, 
  Lock,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FAQItemProps {
  question: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

const FAQItem = ({ question, children, icon }: FAQItemProps) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:bg-slate-50/50 px-4 rounded-xl"
      >
        <div className="flex items-center gap-3">
          {icon && <div className="text-indigo-600">{icon}</div>}
          <span className="text-sm font-bold text-slate-700">{question}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pb-6 pt-2 px-4 text-sm leading-relaxed text-slate-500">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export const FAQView = () => {
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_2px_4px_rgba(0,0,0,0.02)] overflow-hidden">
      <div className="bg-slate-50/30 p-8 border-b border-slate-100">
        <div className="flex items-center gap-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-slate-800 text-white shadow-sm ring-1 ring-slate-200">
            <HelpCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">FAQ & Manual Detalhado</h2>
            <p className="text-slate-400 text-sm font-light mt-1">Guia completo de regras de negócio, cálculos e operação do sistema.</p>
          </div>
        </div>
      </div>

      <div className="p-6 max-h-[700px] overflow-y-auto custom-scrollbar">
        <div className="space-y-4">
          {/* Regras de Negócio e Cálculos */}
          <h3 className="px-4 pt-4 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">Regras de Negócio & Cálculos</h3>
          
          <FAQItem question="Como é calculado o IDC (Índice de Desempenho)?" icon={<Calculator className="h-4 w-4" />}>
            <p className="mb-2">O IDC é uma <strong>média ponderada</strong> do atingimento de todos os indicadores de um colaborador:</p>
            <ol className="list-decimal pl-5 space-y-2">
              <li><strong>Atingimento Individual:</strong> Calculado comparando o Realizado vs Meta.</li>
              <li><strong>Peso:</strong> Cada indicador possui um peso numérico. A nota final é calculada proporcionalmente à soma total dos pesos.</li>
              <li><strong>Fórmula:</strong> <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-mono">Σ (Atingimento * Peso) / Σ Pesos</code>.</li>
            </ol>
            <p className="mt-3 text-[10px] italic text-slate-400">Nota: O sistema limita o atingimento individual a um teto (geralmente 120%) para evitar distorções extremas na média final.</p>
          </FAQItem>

          <FAQItem question="O que é a Polaridade (Cima vs Baixo)?" icon={<TrendingUp className="h-4 w-4" />}>
            <p className="mb-2">A polaridade define se o indicador é "melhor quanto maior" ou "melhor quanto menor":</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Cima (Positiva):</strong> Ex: Vendas, Lucro, Produtividade. Quanto maior o realizado, melhor o score.</li>
              <li><strong>Baixo (Negativa):</strong> Ex: Acidentes, Custos, Reclamações. Quanto menor o realizado, melhor o score.</li>
            </ul>
          </FAQItem>

          <FAQItem question="Como funciona a isenção por Férias?" icon={<Info className="h-4 w-4" />}>
            <p>Quando um colaborador é marcado como <strong>"Em Férias"</strong> no mês de referência:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Sua nota individual não é contabilizada para a média do time/departamento.</li>
              <li>O dashboard exibe um status de "Isento" para este colaborador.</li>
              <li>Isso evita que a ausência de dados de um colaborador em descanso penalize os resultados globais da gerência.</li>
            </ul>
          </FAQItem>

          {/* Operação do Sistema */}
          <h3 className="px-4 pt-8 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">Operação & Importação</h3>

          <FAQItem question="Regras para Importação em Massa (Excel)" icon={<FileSpreadsheet className="h-4 w-4" />}>
            <p className="mb-2">Ao importar dados via Excel, siga estas diretrizes:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Colaboradores:</strong> O e-mail é o identificador único. Se o e-mail já existir, os dados serão atualizados.</li>
              <li><strong>Inventário:</strong> O sistema ignora a coluna "Código" no upload e gera IDs automáticos (IND-001, IND-002...) para garantir a integridade da sequência.</li>
              <li><strong>Realizados:</strong> É obrigatório selecionar o "Mês de Referência" antes de processar o arquivo.</li>
            </ul>
          </FAQItem>

          <FAQItem question="Como funciona a Trilha de Auditoria?" icon={<History className="h-4 w-4" />}>
            <p>O sistema registra automaticamente:</p>
            <ul className="list-disc pl-5 mt-3 space-y-2">
              <li>Quem criou, editou ou excluiu qualquer registro.</li>
              <li>A data e hora exata da alteração.</li>
              <li>O valor antigo e o novo valor (em caso de edições).</li>
            </ul>
            <p className="mt-3 text-[10px] italic text-slate-400">Acesse o ícone de relógio ao lado de qualquer registro para visualizar seu histórico completo.</p>
          </FAQItem>

          {/* Segurança e Performance */}
          <h3 className="px-4 pt-8 text-[10px] font-medium uppercase tracking-[0.15em] text-slate-400">Segurança & Performance</h3>

          <FAQItem question="Níveis de Acesso (RBAC)" icon={<Lock className="h-4 w-4" />}>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Admin:</strong> Acesso total a configurações, auditoria e gestão de todos os usuários.</li>
              <li><strong>Gestor:</strong> Visualiza dados de sua hierarquia (Diretoria/Time) e realiza consolidações.</li>
              <li><strong>Colaborador:</strong> Acesso restrito aos seus próprios indicadores e dashboard pessoal.</li>
            </ul>
          </FAQItem>

          <FAQItem question="Por que os gráficos demoram um pouco para atualizar?" icon={<Zap className="h-4 w-4" />}>
            <p>O sistema utiliza uma técnica chamada <strong>Debounce</strong> nos gráficos. Isso garante que, ao aplicar múltiplos filtros rapidamente, o sistema aguarde a estabilização dos dados antes de renderizar, evitando erros de cálculo de largura e melhorando a performance geral da aplicação.</p>
          </FAQItem>

          <FAQItem question="O que fazer se um gráfico não carregar?" icon={<Shield className="h-4 w-4" />}>
            <p>Certifique-se de que:</p>
            <ol className="list-decimal pl-5 mt-3 space-y-2">
              <li>Você possui indicadores cadastrados para o filtro selecionado.</li>
              <li>O mês de referência possui consolidações concluídas.</li>
              <li>Se o problema persistir, tente limpar o cache do navegador ou verificar sua conexão com o banco de dados (Firestore).</li>
            </ol>
          </FAQItem>
        </div>
      </div>
    </div>
  );
};
