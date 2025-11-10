// src/main.ts

import { fetchTasks, fetchWorkerName, type TaskCardData } from './api'; 
import './style.css'; 
import { 
    format, 
    addMonths, 
    subMonths, 
    addWeeks, 
    subWeeks,
    addDays,    
    subDays,
    startOfWeek,    
    endOfWeek,      
    startOfMonth,   
    endOfMonth,     
    isAfter         
} from 'date-fns';
import { ptBR } from 'date-fns/locale'; 

// --- Tipos e Funções Auxiliares de Tarefa ---

// Novo tipo para dados de exibição de tarefa no calendário
interface TaskDisplayData extends TaskCardData {
    shortTitle: string; 
    color: string;      
}

// Função auxiliar para obter uma cor baseada em um hash simples do cliente UUID
function getTaskColor(uuid: string): string {
    const colors = [
        '#FFAB91', // Laranja claro
        '#A5D6A7', // Verde claro
        '#90CAF9', // Azul claro
        '#FFD54F', // Amarelo claro
        '#BDBDBD', // Cinza claro
        '#FFC1E3', // Rosa claro
        '#B2EBF2'  // Ciano claro
    ];
    let hash = 0;
    if (!uuid) return colors[colors.length - 1]; 
    for (let i = 0; i < uuid.length; i++) {
        hash = uuid.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash % colors.length);
    return colors[index];
}

// --- Variáveis Globais e Inicialização ---

let trabalhadorUuid: string | null = null; 
let trabalhadorNome: string = 'Trabalhador(a)'; 
let currentMode: 'day' | 'week' | 'month' = 'month';
let selectedDate: Date = new Date(); 

function getTrabalhadorUuidFromUrl(): string | null {
    const params = new URLSearchParams(window.location.search);
    return params.get('id'); 
}

const app = document.getElementById('app') as HTMLDivElement;
app.innerHTML = `
  <h1>📅 Agenda do Trabalhador</h1>
  <div class="controls">
    <div class="filter-buttons">
      <button id="filter-month">Mês</button>
      <button id="filter-week">Semana</button>
      <button id="filter-day">Dia</button>
    </div>
    
    <div id="date-picker-container">
      </div>
  </div>
  
  <h2 id="tasks-title">Tarefas em: </h2> 
  <div id="tasks-list" class="tasks-list">
    </div>
`;

// --- Funções de Modal e Interatividade ---

/** Esconde o modal. */
function hideModal() {
    const modal = document.getElementById('app-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/** Exibe o modal com todas as tarefas de um dia específico. */
function showDayTasksModal(dayKey: string, tasks: TaskDisplayData[]) {
    const modal = document.getElementById('app-modal');
    const modalBody = document.getElementById('modal-body');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <h3>Tarefas para ${format(new Date(dayKey), 'dd/MM/yyyy (EEEE)', { locale: ptBR })}</h3>
        <div class="modal-day-tasks-list">
            ${tasks.map(task => `
                <div class="modal-task-item" style="border-left: 5px solid ${task.color};">
                    <p class="modal-task-summary">
                        <span class="modal-task-time">${task.horario}</span> - 
                        <span class="modal-task-client-name">${task.clienteNome}</span>
                    </p>
                    <p class="modal-task-details">
                        Bairro: ${task.bairro} <br>
                        Chave: ${task.chaveUnica}
                    </p>
                </div>
            `).join('')}
        </div>
    `;
    modal.style.display = 'flex';
}

/** Exibe o modal com os detalhes de uma única tarefa. */
function showTaskDetailsModal(task: TaskCardData) {
    const modal = document.getElementById('app-modal');
    const modalBody = document.getElementById('modal-body');
    if (!modal || !modalBody) return;

    modalBody.innerHTML = `
        <h3>Detalhes da Tarefa</h3>
        <div class="modal-task-full-details">
            <p><strong>Horário:</strong> ${task.horario}</p>
            <p><strong>Data:</strong> ${task.dataHorario.split(' - ')[0]}</p>
            <p><strong>Cliente:</strong> ${task.clienteNome}</p>
            <p><strong>Bairro:</strong> ${task.bairro}</p>
            <p><strong>Chave Única:</strong> ${task.chaveUnica}</p>
        </div>
    `;
    modal.style.display = 'flex';
}

/**
 * Configura os event listeners para os botões "mais" em cada dia do calendário.
 */
function setupMoreTasksListeners(tasksByDay: Map<string, TaskDisplayData[]>) {
    document.querySelectorAll<HTMLButtonElement>('.more-tasks-btn').forEach(button => {
        button.onclick = null; 
        button.onclick = () => {
            const dayKey = button.getAttribute('data-day-key');
            if (dayKey) {
                const dayTasks = tasksByDay.get(dayKey) || [];
                showDayTasksModal(dayKey, dayTasks);
            }
        };
    });
}

/**
 * Configura os event listeners para cada evento individual no calendário.
 */
function setupEventClickListener(allTasks: TaskCardData[]) {
    document.querySelectorAll<HTMLDivElement>('.calendar-event').forEach(eventEl => {
        eventEl.onclick = null; 
        eventEl.onclick = (e) => {
            e.stopPropagation(); 
            const taskId = eventEl.getAttribute('data-task-id');
            if (taskId) {
                const task = allTasks.find(t => t.chaveUnica === taskId);
                if (task) {
                    showTaskDetailsModal(task);
                }
            }
        };
    });
}


// --- Funções de Renderização da UI ---

/** Renderiza a lista de tarefas, com lógica de grade de calendário para os modos 'month', 'week' e 'day' */
function renderTasksList(tasks: TaskCardData[]) {
    const listEl = document.getElementById('tasks-list') as HTMLDivElement;
    listEl.innerHTML = ''; 

    // Ordena as tarefas por data/horário
    tasks.sort((a, b) => {
        const [dayA, monthA, yearA] = a.dataHorario.split(' - ')[0].split('/');
        const [dayB, monthB, yearB] = b.dataHorario.split(' - ')[0].split('/');
        
        const dateA = new Date(`${yearA}-${monthA}-${dayA}T${a.horario}:00`);
        const dateB = new Date(`${yearB}-${monthB}-${dayB}T${b.horario}:00`);
        
        return isAfter(dateA, dateB) ? 1 : -1;
    });
    
    // --- LÓGICA DE GRADE (COMPARTILHADA POR MÊS, SEMANA E DIA) ---
    if (currentMode === 'month' || currentMode === 'week' || currentMode === 'day') {
        
        let start: Date;
        // let end: Date; // VARIÁVEL 'end' REMOVIDA
        let visibleTasksLimit: number; 
        let gridClass: string;
        let headerClass: string;
        
        const weekOptions = { weekStartsOn: 0 as 0 }; // Domingo
        
        if (currentMode === 'month') {
            const firstDayOfMonth = startOfMonth(selectedDate);
            // CORREÇÃO CRÍTICA: O calendário deve começar no domingo da semana em que o mês começa.
            start = startOfWeek(firstDayOfMonth, weekOptions); 
            // end = endOfMonth(selectedDate); // VARIÁVEL 'end' REMOVIDA
            visibleTasksLimit = 2; 
            gridClass = 'calendar-grid month-grid';
            headerClass = 'calendar-header month-header';
        } else if (currentMode === 'week') {
            start = startOfWeek(selectedDate, weekOptions);
            // end = endOfWeek(selectedDate, weekOptions); // VARIÁVEL 'end' REMOVIDA
            visibleTasksLimit = 2; 
            gridClass = 'calendar-grid week-grid';
            headerClass = 'calendar-header week-header';
        } else { // currentMode === 'day'
            start = selectedDate;
            // end = selectedDate; // VARIÁVEL 'end' REMOVIDA
            // No modo dia, exibimos TUDO, sem limite e sem botão "mais".
            visibleTasksLimit = 1000; 
            gridClass = 'calendar-grid day-view-grid';
            headerClass = 'calendar-header day-view-header';
            
            // Se não houver tarefas no modo 'day', exibe uma mensagem
            if (tasks.length === 0) {
                 listEl.innerHTML = `<p class="no-tasks-message">Nenhuma tarefa encontrada para ${format(selectedDate, 'dd/MM/yyyy')}.</p>`;
                 return;
            }
        }
        
        // A célula do calendário sempre começa na data 'start'
        let dayCounter = start; 
        
        // 1. Cria o mapa de tarefas agrupadas por dia
        const tasksByDay = new Map<string, TaskDisplayData[]>(); 
        tasks.forEach(task => {
            const taskDateString = task.dataHorario.split(' - ')[0]; 
            const [day, month, year] = taskDateString.split('/');
            const taskDate = new Date(`${year}-${month}-${day}T00:00:00`); 
            const dayKey = format(taskDate, 'yyyy-MM-dd');

            if (!tasksByDay.has(dayKey)) {
                tasksByDay.set(dayKey, []);
            }
            
            tasksByDay.get(dayKey)!.push({
                ...task,
                shortTitle: `${task.horario} ${task.clienteNome}`, 
                color: getTaskColor(task.clienteUuid) 
            });
        });

        // 2. Renderiza o cabeçalho e a grade
        listEl.innerHTML = `
            <div class="${headerClass}">
                ${currentMode === 'day' ? `<div> </div>` : '<div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>'}
            </div>
            <div class="${gridClass}"></div>
        `;
        const gridEl = listEl.querySelector('.calendar-grid') as HTMLDivElement;
        
        let isRendering = true;
        
        // Define quantos dias renderizar: 1 para Dia, 7 para Semana, 42 para Mês (6 semanas)
        const daysToRender = currentMode === 'day' ? 1 : (currentMode === 'week' ? 7 : 42); 
        
        if (currentMode === 'week') {
            dayCounter = startOfWeek(start, weekOptions); 
        }

        let totalCellsRendered = 0;

        // Loop principal para renderizar as células
        while (isRendering && totalCellsRendered < daysToRender) {
            
            const dayKey = format(dayCounter, 'yyyy-MM-dd');
            const dayTasks = tasksByDay.get(dayKey) || [];
            
            const cell = document.createElement('div');
            cell.className = 'day-cell';
            
            // Lógica para dias fora do mês (apenas no modo MÊS)
            // Usa o firstDayOfMonth para verificar se o dia está fora do range do mês atual
            if (currentMode === 'month' && (dayCounter < startOfMonth(selectedDate) || dayCounter > endOfMonth(selectedDate))) {
                cell.classList.add('day-outside-month');
            }

            // Cabeçalho do dia: número (apenas nos modos month/week)
            if (currentMode !== 'day') {
                cell.innerHTML += `<div class="day-number">${format(dayCounter, 'd')}</div>`;
            }

            // --- Conteúdo das Tarefas ---
            
            if (dayTasks.length > 0) {
                
                // Limite só é aplicado se NÃO for o modo DIA
                const limit = (currentMode === 'day') ? dayTasks.length : visibleTasksLimit;
                const visibleTasks = dayTasks.slice(0, limit);
                
                let eventsHtml = visibleTasks.map(task => 
                    `<div class="calendar-event ${currentMode === 'day' ? 'day-mode-event' : ''}" style="background-color:${task.color};" data-task-id="${task.chaveUnica}">
                        ${task.shortTitle}
                    </div>`
                ).join('');
                
                // Lógica do botão "mais" (NÃO aparece no modo DIA)
                if (dayTasks.length > visibleTasksLimit && currentMode !== 'day') {
                    eventsHtml += `
                        <button class="more-tasks-btn" data-day-key="${dayKey}">
                            +${dayTasks.length - visibleTasksLimit} mais
                        </button>
                    `;
                }

                cell.innerHTML += `<div class="events-list">${eventsHtml}</div>`;

            } else if (currentMode === 'day' && totalCellsRendered === 0) {
                 // No modo dia, se não houver tarefas, a mensagem é tratada no início da função.
                 // Aqui apenas garante que a célula vazia seja renderizada.
            }
            
            gridEl.appendChild(cell);
            totalCellsRendered++;

            // Condições de parada
            if (currentMode === 'day' && totalCellsRendered >= 1) {
                isRendering = false;
            } else if (currentMode === 'week' && totalCellsRendered >= 7) {
                 isRendering = false;
            } else if (currentMode === 'month' && totalCellsRendered >= 42) {
                 isRendering = false;
            }

            // Move para o próximo dia (SÓ AQUI)
            dayCounter = addDays(dayCounter, 1);
        }
        
        // 3. Configura os Listeners
        setTimeout(() => {
            setupMoreTasksListeners(tasksByDay); 
            setupEventClickListener(tasks); 
        }, 0); 
        
        return; 
    } 
}


/** Renderiza o seletor de data (Mês, Semana ou Dia) */
function renderDatePicker() {
  const container = document.getElementById('date-picker-container')! as HTMLDivElement;
  container.innerHTML = ''; 
  
  const tasksTitleEl = document.getElementById('tasks-title')! as HTMLHeadingElement;
  
  // Input de data (reutilizado para Day e Month)
const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = format(selectedDate, 'yyyy-MM-dd');
  dateInput.onchange = (e) => {
      const value = (e.target as HTMLInputElement).value;
      if (value) {
          // --- CORREÇÃO DO FUSO HORÁRIO 2.0: Adiciona T00:00:00 ---
          // Isso força o new Date() a interpretar a string no fuso horário local, 
          // em vez de UTC, garantindo que o dia selecionado seja mantido.
          selectedDate = new Date(value + 'T00:00:00'); 
          // --------------------------------------------------------
          loadTasks();
          renderDatePicker(); 
      }
  };
  
  const dateDisplay = document.createElement('span');
  dateDisplay.id = 'current-date-display'; 
  
  const navigate = (direction: 'prev' | 'next') => {
    let newDate = selectedDate;
    
    if (currentMode === 'month') {
      newDate = direction === 'next' ? addMonths(selectedDate, 1) : subMonths(selectedDate, 1);
    } else if (currentMode === 'week') {
      newDate = direction === 'next' ? addWeeks(selectedDate, 1) : subWeeks(selectedDate, 1);
    } else { 
      newDate = direction === 'next' ? addDays(selectedDate, 1) : subDays(selectedDate, 1);
    }
    
    selectedDate = newDate;
    renderDatePicker(); 
    loadTasks();
  };

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '←';
  prevBtn.title = 'Anterior';
  prevBtn.onclick = () => navigate('prev');

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '→';
  nextBtn.title = 'Próximo';
  nextBtn.onclick = () => navigate('next');

  container.append(prevBtn, dateDisplay, nextBtn);

  let dateText = '';
  const weekOptions = { locale: ptBR, weekStartsOn: 0 as 0 }; 

  if (currentMode === 'month') {
    dateText = format(selectedDate, 'MMMM yyyy', { locale: ptBR });
    container.appendChild(dateInput); 

  } else if (currentMode === 'week') {
    
    const start = startOfWeek(selectedDate, weekOptions);
    const end = endOfWeek(selectedDate, weekOptions);
    
    const startDateText = format(start, 'dd/MMM', { locale: ptBR }); 
    const endDateText = format(end, 'dd/MMM', { locale: ptBR });
    
    dateText = `Semana de ${startDateText} a ${endDateText}`;

  } else { // currentMode === 'day'
    dateText = format(selectedDate, 'dd/MM/yyyy (EEEE)', { locale: ptBR }); 
    container.appendChild(dateInput); 
  }
  
  if (currentMode === 'month') {
      dateText = dateText.charAt(0).toUpperCase() + dateText.slice(1);
  }
  
  dateDisplay.textContent = dateText;
  tasksTitleEl.textContent = `Tarefas em: ${dateText}`;
}

/** Atualiza o título H1 com o nome do profissional */
function updateWorkerTitle() {
    const titleEl = document.querySelector('h1')!;
    titleEl.textContent = `📅 Agenda de ${trabalhadorNome}`;
}

// --- Lógica Principal e Inicialização ---

/** Carrega as tarefas e atualiza a UI */
async function loadTasks() {
  if (!trabalhadorUuid) {
    const listEl = document.getElementById('tasks-list') as HTMLDivElement;
    listEl.innerHTML = '<p class="error-message">Erro: UUID do Trabalhador não encontrado na URL.</p>';
    return;
  }
  
  // Limpa a lista antes de carregar
  renderTasksList([]); 
  
  const tasks = await fetchTasks(currentMode, selectedDate, trabalhadorUuid); 
  renderTasksList(tasks);
}

/** Configura os botões de filtro */
function setupFilters() {
  const filters = document.querySelectorAll('.filter-buttons button');
  
  const setActiveFilter = (mode: 'month' | 'week' | 'day', buttonId: string) => {
    filters.forEach(btn => btn.classList.remove('active'));
    document.getElementById(buttonId)?.classList.add('active');
    
    currentMode = mode;
    renderDatePicker();
    loadTasks();
  };

  document.getElementById('filter-month')!.onclick = () => {
    setActiveFilter('month', 'filter-month');
  };
  document.getElementById('filter-week')!.onclick = () => {
    setActiveFilter('week', 'filter-week');
  };
  document.getElementById('filter-day')!.onclick = () => {
    setActiveFilter('day', 'filter-day');
  };
  
  // Define o filtro inicial
  setActiveFilter(currentMode, 'filter-month');
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', async () => { 
  // Adiciona a estrutura do modal ao corpo do documento
  const modalHtml = `
    <div id="app-modal" class="modal">
        <div class="modal-content">
            <span class="close-button" role="button">&times;</span>
            <div id="modal-body"></div>
        </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  // Configura o botão de fechar e o clique fora
  document.querySelector('.modal .close-button')!.addEventListener('click', hideModal);
  window.addEventListener('click', (event) => {
      const modal = document.getElementById('app-modal');
      if (modal && event.target === modal) {
          hideModal();
      }
  });

  // 1. Obtém o UUID
  trabalhadorUuid = getTrabalhadorUuidFromUrl(); 
  
  if (!trabalhadorUuid) {
      document.getElementById('app')!.innerHTML = '<h1>Acesso Negado</h1><p class="error-message">UUID do Trabalhador é obrigatório para carregar a agenda.</p>';
      return;
  }
  
  // 2. BUSCA O NOME
  trabalhadorNome = await fetchWorkerName(trabalhadorUuid);
  
  // 3. ATUALIZA O TÍTULO
  updateWorkerTitle(); 
  
  // 4. CONFIGURA FILTROS E CARREGA TAREFAS
  setupFilters();
});