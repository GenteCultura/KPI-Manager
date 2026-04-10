# Documentação Técnica: SaaS de Gestão de Indicadores (Estilo Actio)

## 1. Visão Geral
O sistema é uma plataforma de **Gestão de Desempenho Corporativo** focada na coleta, consolidação e análise de indicadores (KPIs). O objetivo principal é permitir que gestores acompanhem o desempenho de seus times através de um índice consolidado (IDC/IDCO), garantindo a integridade dos dados através de trilhas de auditoria e tratando exceções operacionais como períodos de férias.

## 2. Stack Recomendada
*   **Frontend:** React 18+ com TypeScript.
*   **Build Tool:** Vite (para inicialização rápida e HMR eficiente).
*   **Styling:** Tailwind CSS (utilitários para design responsivo e customização).
*   **UI Components:** Shadcn/UI (baseado em Radix UI para acessibilidade e componentes polidos).
*   **Charts:** Recharts (com foco em `ResponsiveContainer` e estabilidade de renderização).
*   **Icons:** Lucide React.
*   **State Management:** Zustand ou React Context (para persistência de filtros e dados globais).

## 3. Arquitetura de Dados (Entidades)

### **Usuários (Users)**
*   `id`, `name`, `email`, `role`, `accessLevel` (Admin, Gestor, Colaborador).
*   **Hierarquia:** `diretoriaId`, `departmentId`, `gerenciaId`, `teamId`.
*   **Status Especial:** `isOnVacation` (Boolean), `vacationStart`, `vacationEnd`.

### **Inventário de Indicadores (InventoryIndicators)**
*   `id`, `code` (IND-XXX), `name`, `description`, `weight` (Peso para o IDC).
*   `polarity` (Cima/Baixo - se o indicador é melhor quando cresce ou quando diminui).
*   `responsibleId` (FK para Usuário).

### **Consolidação (Consolidations)**
*   `id`, `collaboratorId`, `month` (AAAA-MM), `totalTarget` (Meta do IDC).
*   `indicators`: Array de objetos contendo `code`, `name`, `weight`, `target` e `actual`.
*   `finalScore`: Resultado calculado do IDC.

### **Estrutura Organizacional**
*   `Diretorias`, `Departamentos`, `Gerências`, `Times` (Tabelas de relacionamento para filtros em cascata).

### **Auditoria (AuditLogs)**
*   `id`, `userId`, `action` (CREATE, UPDATE, DELETE), `targetId`, `changes` (JSON com `oldValue` e `newValue`), `timestamp`.

---

## 4. Regras de Negócio

### **Cálculo do IDC (Índice de Desempenho Consolidado)**
O IDC é a média ponderada do atingimento de cada indicador individual:
1.  **Atingimento Individual:** `(Realizado / Meta)` para polaridade "Cima" ou `(Meta / Realizado)` para polaridade "Baixo".
2.  **Trava de Atingimento:** O atingimento individual é geralmente limitado a um range (ex: 0% a 120%) para evitar que um único indicador distorça a média.
3.  **Cálculo Final:** `Σ (Atingimento Individual * Peso) / Σ Pesos`.

### **Lógica de N/A e Férias**
*   **Férias:** Se `isOnVacation` for `true` para o mês de referência, o sistema deve permitir marcar a consolidação como "Isento". No dashboard, este usuário é ignorado na média global para não penalizar o time.
*   **Indicador N/D (Não Disponível):** Se um indicador específico não puder ser medido no mês, seu peso é redistribuído proporcionalmente entre os outros indicadores daquela consolidação, garantindo que a soma dos pesos considerados seja sempre 100%.

### **Trilha de Auditoria**
*   Toda alteração em valores de "Realizado" ou mudanças no "Inventário" deve gerar um log automático.
*   O log deve capturar o estado anterior e o novo estado, permitindo a rastreabilidade total em caso de auditorias de RH ou Qualidade.

---

## 5. Interface e Experiência do Usuário (UX)

### **Barra de Filtros e Inventário**
*   **Filtros em Cascata:** A seleção de uma *Diretoria* deve filtrar automaticamente os *Departamentos* disponíveis, e assim por diante.
*   **Busca Global:** Filtro por nome ou e-mail do colaborador em tempo real.

### **Sistema de Faróis (Visual Score)**
*   **Verde (Sucesso):** Score >= Meta (ex: 85%).
*   **Amarelo (Atenção):** Score entre 70% e 84%.
*   **Vermelho (Crítico):** Score < 70%.
*   *Nota: As cores devem possuir contraste adequado para acessibilidade.*

### **Dashboards e Cross-filtering**
*   **Estabilidade:** Gráficos envoltos em containers com altura fixa (`h-[400px]`) e uso de `debounce` no `ResponsiveContainer`.
*   **Interatividade:** Ao clicar em uma fatia do gráfico de "Status de KPIs", os outros gráficos (Evolução Mensal e Ranking) devem se filtrar automaticamente para mostrar apenas os dados daquele status.
*   **Skeletons:** Uso de estados de carregamento animados para evitar saltos de layout (Layout Shift) enquanto os dados do banco são processados.

---

## 6. Jornada do Usuário (RBAC)

### **Administrador (Admin)**
*   **Foco:** Governança, Configuração e Integridade.
*   **Jornada:**
    1.  **Setup Inicial:** Configura a hierarquia organizacional (Diretorias -> Times).
    2.  **Gestão de Acessos:** Cria usuários e define permissões granulares.
    3.  **Curadoria de Indicadores:** Gerencia o Inventário Mestre, garantindo que os códigos (IND-XXX) sigam o padrão.
    4.  **Carga de Dados:** Realiza importações em massa (Bulk Import) para acelerar o início do ciclo mensal.
    5.  **Monitoramento Global:** Acompanha o IDC de toda a companhia e revisa a Trilha de Auditoria para garantir conformidade.

### **Gestor (Manager)**
*   **Foco:** Liderança, Acompanhamento e Resultados.
*   **Jornada:**
    1.  **Análise de Time:** Filtra o Dashboard para visualizar o desempenho de sua Gerência ou Time específico.
    2.  **Ciclo de Consolidação:** No final do mês, revisa os indicadores de seus liderados e realiza a consolidação dos resultados.
    3.  **Gestão de Exceções:** Marca períodos de férias para colaboradores, garantindo que a meta do time seja ajustada automaticamente.
    4.  **Plano de Ação:** Identifica colaboradores no "Farol Vermelho" e utiliza os dados para reuniões de feedback e melhoria.

### **Colaborador (Collaborator)**
*   **Foco:** Autogestão e Transparência.
*   **Jornada:**
    1.  **Visão de Metas:** Acessa seu perfil para visualizar quais indicadores estão sob sua responsabilidade e quais são as metas do mês.
    2.  **Acompanhamento:** Monitora seu próprio IDC através do dashboard pessoal, entendendo como cada indicador impacta sua nota final.
    3.  **Histórico:** Consulta resultados de meses anteriores para entender sua evolução de performance na companhia.
