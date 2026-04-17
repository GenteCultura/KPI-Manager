import React, { useState, useMemo, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  X,
  Info,
  Target,
  Bell
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval, 
  isToday,
  parseISO,
  isWithinInterval,
  startOfDay,
  endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { User, CalendarEvent, CalendarEventType, KPI } from '../types';
import { useStore } from '../store/useStore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { toSnakeCase, toCamelCase } from '../lib/mapping';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

import { DeleteConfirmationModal } from './DeleteConfirmationModal';

interface CalendarProps {
  currentUser: User | null;
  kpis: KPI[];
}

export const Calendar = ({ currentUser, kpis }: CalendarProps) => {
  const { calendarEvents, setCalendarEvents } = useStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [eventToDeleteId, setEventToDeleteId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CalendarEventType>('Deadline');
  const [eventStartDate, setEventStartDate] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [color, setColor] = useState('#4f46e5');
  const [notificationOffset, setNotificationOffset] = useState<number>(0);
  const [linkedKpiId, setLinkedKpiId] = useState<string>('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [channel, setChannel] = useState<'Email' | 'Push' | 'Both'>('Email');
  const [daysBeforeEnd, setDaysBeforeEnd] = useState<number>(0);
  const [isManualSending, setIsManualSending] = useState(false);
  const [isConfiguringNotification, setIsConfiguringNotification] = useState(false);
  const [notificationStartReminder, setNotificationStartReminder] = useState(false);
  const [notificationDeadlineAlert, setNotificationDeadlineAlert] = useState(false);
  const [selectedEventIdForNotification, setSelectedEventIdForNotification] = useState<string>('');
  const [configNotificationOffset, setConfigNotificationOffset] = useState<number>(0);
  const [configDaysBeforeEnd, setConfigDaysBeforeEnd] = useState<number>(0);
  const [configChannel, setConfigChannel] = useState<'Email' | 'Push' | 'Both'>('Email');

  const isAdmin = currentUser?.accessLevel === 'Admin';

  // Real-time events listener
  useEffect(() => {
    const q = query(collection(db, 'calendar_events'), orderBy('start_date', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCalendarEvents(toCamelCase(data));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calendar_events');
    });

    return () => unsubscribe();
  }, []);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    if (isAdmin) {
      setTitle('');
      setDescription('');
      setType('Deadline');
      setEventStartDate(format(day, "yyyy-MM-dd'T'HH:mm"));
      setEventEndDate(format(day, "yyyy-MM-dd'T'HH:mm"));
      setNotificationOffset(0);
      setLinkedKpiId('');
      setPriority('Medium');
      setChannel('Email');
      setDaysBeforeEnd(0);
      setEditingEvent(null);
      setIsModalOpen(true);
    } else {
      // For users, just select the date
      setSelectedDate(day);
    }
  };

  const handleViewEvent = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation();
    setEditingEvent(event);
    setTitle(event.title);
    setDescription(event.description);
    setType(event.type);
    setEventStartDate(event.startDate.slice(0, 16));
    setEventEndDate(event.endDate.slice(0, 16));
    setColor(event.color || '#4f46e5');
    setNotificationOffset(event.notificationOffset || 0);
    setLinkedKpiId(event.linkedKpiId || '');
    setPriority(event.priority || 'Medium');
    setChannel(event.channel || 'Email');
    setDaysBeforeEnd(event.daysBeforeEnd || 0);
    setNotificationStartReminder(event.notificationStartReminder || false);
    setNotificationDeadlineAlert(event.notificationDeadlineAlert || false);
    setIsModalOpen(true);
  };

  const handleManualNotify = async (event: CalendarEvent) => {
    if (!isAdmin || !currentUser) return;
    setIsManualSending(true);
    
    try {
      // Output JSON for manual notification
      console.log('Action: Manual Notification', JSON.stringify({
        action: "manual_notification",
        trigger: "admin_broadcast",
        params: {
          event_id: event.id,
          title: event.title,
          message: event.description,
          recipient: "all_active_users",
          priority: event.priority || 'High',
          channel: event.channel || 'Both'
        }
      }, null, 2));

      await new Promise(resolve => setTimeout(resolve, 800));
      toast.success('Notificação enviada para todos os usuários!');
    } catch (error) {
      toast.error('Erro ao enviar notificação.');
    } finally {
      setIsManualSending(false);
    }
  };

  const handleDeleteEvent = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!isAdmin) return;

    setEventToDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDeleteId) return;

    try {
      await deleteDoc(doc(db, 'calendar_events', eventToDeleteId));
      
      // Output JSON for backend notification cancellation
      console.log('Action: Cancel Notification', JSON.stringify({
        action: "cancel_notification",
        trigger: "calendar_event_deleted",
        params: {
          event_id: eventToDeleteId
        }
      }, null, 2));

      toast.success('Evento excluído');
      setIsModalOpen(false);
      setIsDeleteModalOpen(false);
      setEventToDeleteId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `calendar_events/${eventToDeleteId}`);
    }
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !currentUser) return;

    setIsSaving(true);
    const eventId = editingEvent?.id || crypto.randomUUID();
    
    const newEvent: CalendarEvent = {
      id: eventId,
      title,
      description,
      startDate: new Date(eventStartDate).toISOString(),
      endDate: new Date(eventEndDate).toISOString(),
      type,
      createdBy: currentUser.name,
      createdById: currentUser.id,
      createdAt: editingEvent?.createdAt || new Date().toISOString(),
      color,
      notificationOffset,
      linkedKpiId: linkedKpiId || undefined,
      priority,
      channel,
      daysBeforeEnd,
      notificationStartReminder,
      notificationDeadlineAlert,
    };

    try {
      await setDoc(doc(db, 'calendar_events', eventId), toSnakeCase(newEvent));
      
      // Output JSON for backend notification scheduling
      if (notificationOffset > 0 && currentUser) {
        const sendAt = new Date(new Date(eventStartDate).getTime() - notificationOffset * 60000).toISOString();
        console.log('Action: Schedule Notification', JSON.stringify({
          action: "schedule_notification",
          trigger: "calendar_event",
          params: {
            event_id: eventId,
            send_at: sendAt,
            recipient: currentUser.email,
            template_style: "minimalist_low_saturation",
            include_metrics: !!linkedKpiId,
            priority,
            channel,
            days_before_end: daysBeforeEnd
          }
        }, null, 2));
      }

      toast.success(editingEvent ? 'Evento atualizado' : 'Evento criado');
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `calendar_events/${eventId}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!isAdmin || !selectedEventIdForNotification) {
      toast.error('Selecione um evento para configurar');
      return;
    }

    const event = calendarEvents.find(e => e.id === selectedEventIdForNotification);
    if (!event) return;

    try {
      const updatedEvent = {
        ...event,
        notificationOffset: configNotificationOffset,
        daysBeforeEnd: configDaysBeforeEnd,
        channel: configChannel
      };

      await setDoc(doc(db, 'calendar_events', event.id), toSnakeCase(updatedEvent));
      
      // Output JSON for backend notification scheduling
      if (configNotificationOffset > 0 && currentUser) {
        const sendAt = new Date(new Date(event.startDate).getTime() - configNotificationOffset * 60000).toISOString();
        console.log('Action: Schedule Notification (Config)', JSON.stringify({
          action: "schedule_notification",
          trigger: "calendar_event_config_update",
          params: {
            event_id: event.id,
            send_at: sendAt,
            recipient: currentUser.email,
            priority: event.priority || 'Medium',
            channel: configChannel,
            days_before_end: configDaysBeforeEnd
          }
        }, null, 2));
      }

      toast.success('Configurações do evento salvas!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `calendar_events/${event.id}`);
    }
  };

  useEffect(() => {
    if (selectedEventIdForNotification) {
      const event = calendarEvents.find(e => e.id === selectedEventIdForNotification);
      if (event) {
        setConfigNotificationOffset(event.notificationOffset || 0);
        setConfigDaysBeforeEnd(event.daysBeforeEnd || 0);
        setConfigChannel(event.channel || 'Email');
      }
    }
  }, [selectedEventIdForNotification, calendarEvents]);

  // Derived events from KPIs (e.g. Monthly deadlines)
  const kpiDeadlines = useMemo(() => {
    const deadlines: any[] = [];
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    kpis.forEach(kpi => {
      if (kpi.frequency === 'Mensal') {
        // Assume deadline is the 5th of the next month
        const deadlineDate = new Date(currentYear, currentMonth + 1, 5);
        deadlines.push({
          id: `deadline-${kpi.id}`,
          title: `Prazo: ${kpi.name}`,
          description: `Preenchimento do realizado para ${kpi.code}`,
          startDate: deadlineDate.toISOString(),
          endDate: deadlineDate.toISOString(),
          type: 'Deadline',
          isAuto: true,
          color: '#ef4444'
        });
      }
    });
    return deadlines;
  }, [kpis, currentDate]);

  const allEvents = useMemo(() => {
    return [...calendarEvents, ...kpiDeadlines];
  }, [calendarEvents, kpiDeadlines]);

  const getEventsForDay = (day: Date) => {
    return allEvents.filter(event => {
      const start = parseISO(event.startDate);
      const end = parseISO(event.endDate);
      return isWithinInterval(startOfDay(day), { start: startOfDay(start), end: endOfDay(end) });
    });
  };

  const eventTypeColors = {
    Deadline: 'bg-[#F9F4F2] text-[#C57B67] border-[#EFE2DE]',
    Meeting: 'bg-[#F1F5F3] text-[#8DA399] border-[#E2E8E5]',
    Holiday: 'bg-slate-50 text-slate-600 border-slate-200',
    Other: 'bg-slate-50 text-slate-500 border-slate-100',
  };

  return (
    <div className="flex flex-col gap-10 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800 text-white shadow-sm">
            <CalendarIcon className="h-7 w-7 stroke-[1.5]" />
          </div>
          <div>
            <h1 className="text-2xl font-normal tracking-[0.05em] text-slate-800 uppercase">Calendário</h1>
            <p className="text-slate-400 text-[10px] font-light tracking-widest mt-1 uppercase">Prazos, reuniões e marcos importantes.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/40 shadow-sm">
          <button 
            onClick={prevMonth}
            className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[10px] font-medium text-slate-700 min-w-[140px] text-center uppercase tracking-[0.2em]">
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </span>
          <button 
            onClick={nextMonth}
            className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-[0_4px_12px_rgba(0,0,0,0.02)] overflow-hidden">
        {/* Days Header */}
        <div className="grid grid-cols-7 bg-slate-50/30 border-b border-slate-100">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-4 text-center text-[9px] font-medium uppercase tracking-[0.25em] text-slate-400">
              {day}
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {calendarDays.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            
            return (
              <div 
                key={day.toString()}
                onClick={() => handleDayClick(day)}
                className={`min-h-[140px] p-4 border-r border-b border-slate-50 transition-all cursor-pointer hover:bg-slate-50/50 group relative ${
                  !isCurrentMonth ? 'bg-slate-50/20 opacity-30' : 'bg-white'
                } ${idx % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-normal transition-all ${
                    isToday(day) 
                      ? 'bg-slate-800 text-white shadow-md' 
                      : isSameDay(day, selectedDate || new Date(-1))
                        ? 'bg-slate-100 text-slate-900 border border-slate-200'
                        : 'text-slate-500 group-hover:text-slate-800'
                  }`}>
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[8px] font-medium text-slate-300 uppercase tracking-widest">
                      {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayEvents.slice(0, 3).map(event => (
                    <div 
                      key={event.id}
                      onClick={(e) => handleViewEvent(e, event)}
                      className={`px-2.5 py-1.5 rounded-lg text-[9px] font-medium uppercase tracking-wider truncate border transition-all hover:scale-[1.02] active:scale-[0.98] ${
                        eventTypeColors[event.type as CalendarEventType] || eventTypeColors.Other
                      }`}
                      style={event.color && event.type === 'Other' ? { backgroundColor: `${event.color}08`, color: event.color, borderColor: `${event.color}15` } : {}}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[8px] font-medium text-slate-400 pl-1 mt-2 uppercase tracking-widest">
                      + {dayEvents.length - 3} mais
                    </div>
                  )}
                </div>

                {isAdmin && isCurrentMonth && (
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all translate-y-1 group-hover:translate-y-0">
                    <div className="h-6 w-6 rounded-xl bg-slate-800 text-white flex items-center justify-center shadow-lg">
                      <Plus className="h-3.5 w-3.5" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend & Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="rounded-2xl border border-slate-200/60 bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.02)] lg:col-span-2">
          <div className="flex items-center gap-4 mb-8">
            <Info className="h-4 w-4 text-slate-300" />
            <h3 className="text-[10px] font-medium text-slate-400 uppercase tracking-[0.2em]">Legenda</h3>
          </div>
          <div className="flex flex-wrap gap-8">
            {Object.entries(eventTypeColors).map(([type, classes]) => (
              <div key={type} className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-md border ${classes.split(' ')[0]} ${classes.split(' ')[2]}`} />
                <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">{type}</span>
              </div>
            ))}
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-md bg-[#C57B67]" />
              <span className="text-[10px] font-normal text-slate-500 uppercase tracking-widest">Prazos Automáticos</span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="rounded-2xl border border-slate-800 bg-slate-800 p-8 text-white shadow-xl">
            <div className="flex items-center gap-4 mb-6">
              <Bell className="h-4 w-4 text-slate-500" />
              <h3 className="text-[10px] font-medium uppercase tracking-[0.2em]">Ações Administrativas</h3>
            </div>
            <div className="space-y-6">
              <p className="text-[10px] font-light text-slate-400 leading-relaxed tracking-widest uppercase">
                Utilize o calendário para disparar notificações manuais ou agendar lembretes críticos de performance.
              </p>
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full !h-11 !rounded-xl border-slate-700 text-slate-300 hover:bg-slate-700/50 text-[9px] uppercase tracking-[0.2em] transition-all"
                  onClick={() => toast.success('Selecione um evento para disparar notificação manual')}
                >
                  Broadcast de Alerta
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-10 shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-4 mb-10">
            <div className="h-12 w-12 rounded-2xl bg-slate-50 text-slate-400 border border-slate-200/50 flex items-center justify-center shadow-sm">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-normal text-slate-800 uppercase tracking-tight">Configurações Avançadas</h3>
              <p className="text-[10px] text-slate-400 font-light uppercase tracking-widest mt-1">Defina padrões automáticos para lembretes do sistema.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="space-y-3">
              <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1">Selecionar Evento</label>
              <div className="relative">
                <select 
                  value={selectedEventIdForNotification}
                  onChange={(e) => setSelectedEventIdForNotification(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 outline-none transition-all appearance-none pr-10"
                >
                  <option value="">Selecione um evento...</option>
                  {calendarEvents.map(event => (
                    <option key={event.id} value={event.id}>{event.title}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
              </div>
              <p className="text-[8px] text-slate-400 font-light uppercase tracking-widest px-1">Escolha o evento para configurar notificações específicas.</p>
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1">Notificação (Início)</label>
              <div className="relative">
                <select 
                  value={configNotificationOffset}
                  onChange={(e) => setConfigNotificationOffset(Number(e.target.value))}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 outline-none transition-all appearance-none pr-10"
                >
                  <option value="0">Nenhum</option>
                  <option value="5">5 minutos antes</option>
                  <option value="10">10 minutos antes</option>
                  <option value="30">30 minutos antes</option>
                  <option value="60">1 hora antes</option>
                  <option value="1440">1 dia antes</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
              </div>
              <p className="text-[8px] text-slate-400 font-light uppercase tracking-widest px-1">Lembrete enviado antes do início do evento.</p>
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1">Alerta de Prazo (Fim)</label>
              <div className="relative">
                <select 
                  value={configDaysBeforeEnd}
                  onChange={(e) => setConfigDaysBeforeEnd(Number(e.target.value))}
                  className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-wider text-slate-600 focus:border-slate-400 outline-none transition-all appearance-none pr-10"
                >
                  <option value="0">Nenhum</option>
                  <option value="1">1 dia antes</option>
                  <option value="2">2 dias antes</option>
                  <option value="3">3 dias antes</option>
                  <option value="5">5 dias antes</option>
                  <option value="7">1 semana antes</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
              </div>
              <p className="text-[8px] text-slate-400 font-light uppercase tracking-widest px-1">Notificação de urgência enviada antes do término.</p>
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-medium text-slate-400 uppercase tracking-[0.2em] ml-1">Canal</label>
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setConfigChannel('Email')}
                  className={`flex-1 !h-11 !rounded-xl text-[9px] font-medium uppercase tracking-widest border-slate-200 ${configChannel === 'Email' || configChannel === 'Both' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`}
                >
                  E-mail
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setConfigChannel('Push')}
                  className={`flex-1 !h-11 !rounded-xl text-[9px] font-medium uppercase tracking-widest border-slate-200 ${configChannel === 'Push' ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-800'}`}
                >
                  Push
                </Button>
              </div>
              <p className="text-[8px] text-slate-400 font-light uppercase tracking-widest px-1">Meio preferencial para envio automático.</p>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-slate-50 flex justify-end">
            <Button 
              onClick={handleSaveConfig}
              className="!h-11 !rounded-xl bg-slate-800 text-white px-10 text-[10px] font-medium uppercase tracking-widest shadow-lg hover:bg-slate-700 transition-all"
            >
              Salvar Configurações
            </Button>
          </div>
        </div>
      )}

      {/* Event Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200/60 overflow-hidden"
            >
              <div className="p-10">
                <div className="flex items-center justify-between mb-12">
                  <div className="flex items-center gap-6">
                    <div className="h-14 w-14 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-lg">
                      {editingEvent ? <Edit2 className="h-6 w-6 stroke-[1.5]" /> : <Plus className="h-6 w-6 stroke-[1.5]" />}
                    </div>
                    <div>
                      <h2 className="text-xl font-normal tracking-tight text-slate-800 uppercase">
                        {isAdmin ? (editingEvent ? 'Editar Evento' : 'Novo Evento') : 'Detalhes'}
                      </h2>
                      <p className="text-[10px] font-light text-slate-400 uppercase tracking-[0.2em] mt-1">
                        {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="p-3 hover:bg-slate-50 rounded-2xl transition-all text-slate-300 hover:text-slate-800"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSaveEvent} className="space-y-8">
                  <div className="space-y-2.5">
                    <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Título</label>
                    <Input 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="EX: PRAZO FINAL DE PREENCHIMENTO"
                      required
                      readOnly={!isAdmin}
                      className="!h-12 !rounded-xl !text-[10px] !font-medium !uppercase !tracking-widest !bg-slate-50/30 focus:!bg-white transition-all read-only:!bg-slate-50/50"
                    />
                  </div>

                  <div className="space-y-2.5">
                    <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Descrição</label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="DETALHES SOBRE O EVENTO..."
                      readOnly={!isAdmin}
                      className="w-full min-h-[120px] p-5 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-light uppercase tracking-widest focus:ring-1 focus:ring-slate-200 focus:border-slate-300 outline-none transition-all read-only:bg-slate-50/50 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Tipo</label>
                      <div className="relative">
                        <select 
                          value={type}
                          onChange={(e) => setType(e.target.value as CalendarEventType)}
                          disabled={!isAdmin}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-widest text-slate-600 focus:border-slate-400 outline-none appearance-none disabled:opacity-100 disabled:bg-slate-50/50"
                        >
                          <option value="Deadline">Prazo</option>
                          <option value="Meeting">Reunião</option>
                          <option value="Holiday">Feriado</option>
                          <option value="Other">Outro</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Prioridade</label>
                      <div className="relative">
                        <select 
                          value={priority}
                          onChange={(e) => setPriority(e.target.value as any)}
                          disabled={!isAdmin}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-widest text-slate-600 focus:border-slate-400 outline-none appearance-none disabled:opacity-100 disabled:bg-slate-50/50"
                        >
                          <option value="Low">Baixa</option>
                          <option value="Medium">Média</option>
                          <option value="High">Alta</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Canal</label>
                      <div className="relative">
                        <select 
                          value={channel}
                          onChange={(e) => setChannel(e.target.value as any)}
                          disabled={!isAdmin}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-widest text-slate-600 focus:border-slate-400 outline-none appearance-none disabled:opacity-100 disabled:bg-slate-50/50"
                        >
                          <option value="Email">E-mail</option>
                          <option value="Push">Push</option>
                          <option value="Both">Ambos</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Vincular KPI</label>
                      <div className="relative">
                        <select 
                          value={linkedKpiId}
                          onChange={(e) => setLinkedKpiId(e.target.value)}
                          disabled={!isAdmin}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-widest text-slate-600 focus:border-slate-400 outline-none appearance-none disabled:opacity-100 disabled:bg-slate-50/50"
                        >
                          <option value="">Nenhum</option>
                          {kpis.map(kpi => (
                            <option key={kpi.id} value={kpi.id}>{kpi.name}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Lembrete (Início)</label>
                      <div className="relative">
                        <select 
                          value={notificationOffset}
                          onChange={(e) => setNotificationOffset(Number(e.target.value))}
                          disabled={!isAdmin}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-widest text-slate-600 focus:border-slate-400 outline-none appearance-none disabled:opacity-100 disabled:bg-slate-50/50"
                        >
                          <option value={0}>Nenhum</option>
                          <option value={5}>5 minutos antes</option>
                          <option value={10}>10 minutos antes</option>
                          <option value={30}>30 minutos antes</option>
                          <option value={60}>1 hora antes</option>
                          <option value={1440}>1 dia antes</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Alerta (Fim)</label>
                      <div className="relative">
                        <select 
                          value={daysBeforeEnd}
                          onChange={(e) => setDaysBeforeEnd(Number(e.target.value))}
                          disabled={!isAdmin}
                          className="w-full h-12 px-4 rounded-xl border border-slate-200 bg-slate-50/30 text-[10px] font-medium uppercase tracking-widest text-slate-600 focus:border-slate-400 outline-none appearance-none disabled:opacity-100 disabled:bg-slate-50/50"
                        >
                          <option value={0}>Nenhum</option>
                          <option value={1}>1 dia antes</option>
                          <option value={2}>2 dias antes</option>
                          <option value={3}>3 dias antes</option>
                          <option value={5}>5 dias antes</option>
                          <option value={7}>1 semana antes</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Início</label>
                      <Input 
                        type="datetime-local"
                        value={eventStartDate}
                        onChange={(e) => setEventStartDate(e.target.value)}
                        required
                        readOnly={!isAdmin}
                        className="!h-12 !rounded-xl !text-[10px] !font-medium !uppercase !tracking-widest !bg-slate-50/30 read-only:!bg-slate-50/50"
                      />
                    </div>
                    <div className="space-y-2.5">
                      <label className="text-[9px] font-medium uppercase tracking-[0.2em] text-slate-400 ml-1">Término</label>
                      <Input 
                        type="datetime-local"
                        value={eventEndDate}
                        onChange={(e) => setEventEndDate(e.target.value)}
                        required
                        readOnly={!isAdmin}
                        className="!h-12 !rounded-xl !text-[10px] !font-medium !uppercase !tracking-widest !bg-slate-50/30 read-only:!bg-slate-50/50"
                      />
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="mt-6 rounded-2xl border border-slate-100 bg-slate-50/30 p-5">
                      <button 
                        type="button"
                        onClick={() => setIsConfiguringNotification(!isConfiguringNotification)}
                        className="flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-indigo-600 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Bell className="h-4 w-4" />
                          Configurar Notificações
                        </div>
                        <ChevronDown className={`h-4 w-4 transition-transform ${isConfiguringNotification ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {isConfiguringNotification && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="pt-5 space-y-4">
                              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-700">Lembrete de Início</span>
                                  <span className="text-[8px] text-slate-400">Notificar quando o evento começar</span>
                                </div>
                                <input 
                                  type="checkbox"
                                  checked={notificationStartReminder}
                                  onChange={(e) => setNotificationStartReminder(e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </div>

                              <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100">
                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-slate-700">Alerta de Prazo</span>
                                  <span className="text-[8px] text-slate-400">Notificar 24h antes do término</span>
                                </div>
                                <input 
                                  type="checkbox"
                                  checked={notificationDeadlineAlert}
                                  onChange={(e) => setNotificationDeadlineAlert(e.target.checked)}
                                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </div>

                              <div className="space-y-2">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 ml-1">Canal de Notificação</label>
                                <select 
                                  value={channel}
                                  onChange={(e) => setChannel(e.target.value as any)}
                                  className="w-full h-10 rounded-xl border border-slate-200 bg-white px-4 text-[10px] font-bold text-slate-700 focus:border-indigo-500 focus:outline-none transition-all"
                                >
                                  <option value="Email">E-mail Corporativo</option>
                                  <option value="Push">Notificação Push</option>
                                  <option value="Both">Todos os Canais</option>
                                </select>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <div className="flex flex-col gap-4 pt-8">
                    {isAdmin ? (
                      <>
                        <div className="flex gap-4">
                          {editingEvent && (
                            <Button 
                              type="button"
                              variant="outline"
                              onClick={(e) => handleDeleteEvent(e, editingEvent.id)}
                              className="flex-1 !h-12 !rounded-xl border-rose-100 text-rose-400 hover:bg-rose-50/50 text-[10px] font-medium uppercase tracking-widest transition-all"
                            >
                              Excluir
                            </Button>
                          )}
                          <Button 
                            type="submit"
                            disabled={isSaving}
                            className="flex-[2] !h-12 !rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-lg text-[10px] font-medium uppercase tracking-widest transition-all scale-100 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            {isSaving ? 'SALVANDO...' : editingEvent ? 'SALVAR ALTERAÇÕES' : 'CRIAR EVENTO'}
                          </Button>
                        </div>
                        {editingEvent && (
                          <Button 
                            type="button"
                            variant="outline"
                            onClick={() => handleManualNotify(editingEvent)}
                            isLoading={isManualSending}
                            className="w-full !h-12 !rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 text-[10px] font-medium uppercase tracking-widest transition-all"
                          >
                            Disparar Notificação Manual
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button 
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="w-full !h-12 !rounded-xl bg-slate-800 hover:bg-slate-900 text-white shadow-lg text-[10px] font-medium uppercase tracking-widest transition-all"
                      >
                        FECHAR
                      </Button>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="Excluir Evento"
        message="Tem certeza que deseja excluir este evento do calendário"
        itemName={calendarEvents.find(e => e.id === eventToDeleteId)?.title}
      />
    </div>
  );
};
