import React, { useState, useMemo } from 'react';
import { 
  MessageSquare, 
  X, 
  Search, 
  Send, 
  ChevronRight, 
  HelpCircle,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const FAQ_DATA = [
  {
    category: 'Geral',
    questions: [
      { q: 'O que é o KAPY?', a: 'O KAPY é uma plataforma de consolidação de indicadores (KPIs) focada em Analytics e Gestão de Processos, automatizando o que antes era feito em planilhas manuais.' },
      { q: 'Como exportar relatórios?', a: 'Vá até o Centro de Relatórios no menu superior. Lá você pode filtrar por período e organização antes de exportar em PDF ou Excel.' }
    ]
  },
  {
    category: 'Configuração',
    questions: [
      { q: 'Como cadastrar um novo KPI?', a: 'Acesse a "Lista de Estrutura" e clique em "Adicionar KPI". Você precisará definir o nome, polaridade, meta e o gestor responsável.' },
      { q: 'Como definir a hierarquia?', a: 'Na aba "Organização", você pode gerenciar Diretorias, Departamentos e Gerências, estabelecendo a estrutura subordinada necessária.' }
    ]
  },
  {
    category: 'RH / People Analytics',
    questions: [
      { q: 'O que é o IDC?', a: 'IDC (Índice de Desempenho Consolidado) é a métrica final que pondera todos os KPIs de um colaborador para gerar uma nota de performance de 0 a 100.' },
      { q: 'Como calcular Turnover?', a: 'O Turnover é calculado automaticamente com base nos dados de movimentação de pessoal inseridos no Inventário de Indicadores.' }
    ]
  }
];

export const SupportChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredFaq = useMemo(() => {
    if (!searchTerm) return FAQ_DATA;
    return FAQ_DATA.map(cat => ({
      ...cat,
      questions: cat.questions.filter(q => 
        q.q.toLowerCase().includes(searchTerm.toLowerCase()) || 
        q.a.toLowerCase().includes(searchTerm.toLowerCase())
      )
    })).filter(cat => cat.questions.length > 0);
  }, [searchTerm]);

  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom right' }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="absolute bottom-16 right-0 w-[400px] max-h-[600px] bg-white rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-slate-900 p-6 text-white shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <HelpCircle className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-none">Central de Ajuda</h3>
                    <p className="text-slate-400 text-[10px] uppercase tracking-widest mt-1.5 font-medium">Suporte KAPY Analytics</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input 
                  type="text"
                  placeholder="Como podemos ajudar?"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:bg-white/10 focus:outline-none transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8 bg-slate-50/30">
              {filteredFaq.length > 0 ? (
                filteredFaq.map((cat, i) => (
                  <div key={i} className="space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">{cat.category}</h4>
                    <div className="space-y-2">
                      {cat.questions.map((q, j) => (
                        <div 
                          key={j} 
                          className="group bg-white p-4 rounded-2xl border border-slate-100 hover:border-slate-300 hover:shadow-sm transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-xs font-bold text-slate-700 leading-tight">{q.q}</p>
                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-900 transform group-hover:translate-x-1 transition-all shrink-0" />
                          </div>
                          <p className="text-[11px] text-slate-500 font-light mt-2 hidden group-hover:block leading-relaxed">
                            {q.a}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center space-y-4">
                  <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-300">
                    <Search className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Nenhum resultado encontrado</p>
                    <p className="text-xs text-slate-400 mt-1">Tente palavras-chave diferentes.</p>
                  </div>
                </div>
              )}

              {/* Quick Resources */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3">
                <button className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
                  <BookOpen className="h-4 w-4 text-emerald-500" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Documentação</span>
                </button>
                <button className="flex items-center gap-2 p-3 rounded-xl border border-slate-100 bg-white hover:border-slate-200 transition-all">
                  <ExternalLink className="h-4 w-4 text-blue-500" />
                  <span className="text-[10px] font-bold text-slate-600 uppercase">Abertura de Chamado</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-3">
              <input 
                type="text" 
                placeholder="Fale com um atendente..."
                className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-slate-900 transition-all"
              />
              <button className="h-10 w-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-slate-800 transition-all shrink-0 shadow-lg shadow-slate-900/10">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={`h-14 w-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500 ${isOpen ? 'bg-slate-900 text-white rotate-90 shadow-slate-900/20' : 'bg-white text-slate-900 shadow-slate-200/50 hover:bg-slate-50'}`}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </motion.button>
    </div>
  );
};
