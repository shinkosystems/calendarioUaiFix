// src/api.ts

import { supabase } from './supabaseClient';
import { 
    startOfMonth, endOfMonth, 
    startOfWeek, endOfWeek, 
    format, 
    startOfDay, endOfDay 
} from 'date-fns';
// CORREÇÃO TS: Usar import type para importar o tipo Day
import type { Day } from 'date-fns'; 

// 1. Tipagem para os dados finais da tarefa
export interface TaskCardData {
  id: number; 
  chaveUnica: string;
  clienteNome: string;
  horario: string; 
  bairro: string;
  dataHorario: string; // Inclui data e hora para exibição no card
  clienteUuid: string;
  profissionalUuid: string;
}

// Funções utilitárias de data: Retorna timestamps completos para gte/lte
const getDateRange = (mode: 'day' | 'week' | 'month', date: Date): [string, string] => {
  let startDate: Date;
  let endDate: Date;
  
  // A tipagem já está correta aqui após a alteração no import
  const weekOptions = { weekStartsOn: 0 as Day }; 

  if (mode === 'month') {
    startDate = startOfMonth(date);
    endDate = endOfDay(endOfMonth(date)); 
  } else if (mode === 'week') {
    startDate = startOfWeek(date, weekOptions);
    endDate = endOfDay(endOfWeek(date, weekOptions));
  } else { 
    startDate = startOfDay(date); 
    endDate = endOfDay(date);
  }
  
  // Retorna o formato ISO do PostgREST com hora e fuso horário
  const formatSQL = (d: Date) => d.toISOString();

  return [formatSQL(startDate), formatSQL(endDate)];
};


/**
 * Busca e estrutura as tarefas, filtrando pelo UUID do Trabalhador E pelo intervalo de data.
 */
export async function fetchTasks(
    mode: 'day' | 'week' | 'month', 
    selectedDate: Date, 
    trabalhadorUuid: string 
): Promise<TaskCardData[]> {
    
    const [startDate, endDate] = getDateRange(mode, selectedDate); 
    const filterUuid = trabalhadorUuid; 
    
    const TRABALHADOR_COLUNA_AGENDA = 'profissional'; 

    console.log('--- DEBUG Supabase Query (FINAL) ---');
    
    try {
        
        // ETAPA 1: Busca Agenda e Chaves
        const { data: agendaData, error: agendaError } = await supabase
            .from('agenda')
            .select(`
                execucao,
                cliente, 
                chave, 
                chaves:chave!inner(chaveunica)
            `)
            .eq(`${TRABALHADOR_COLUNA_AGENDA}::uuid`, filterUuid) 
            .gte('execucao', startDate) 
            .lte('execucao', endDate); 
            
        if (agendaError) {
            console.error('Erro na Etapa 1 (Agenda/Chaves):', agendaError);
            return [];
        }

        if (!agendaData || agendaData.length === 0) {
            console.log('Nenhuma tarefa encontrada no período.');
            return [];
        }
        
        const clientUuids = Array.from(new Set(agendaData.map((item: any) => item.cliente).filter(Boolean)));
        
        // ETAPA 2: Busca Nomes e Bairros na tabela Users
        let usersMap: Map<string, { nome: string, bairro: string }> = new Map();

        if (clientUuids.length > 0) {
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('uuid, nome, bairro')
                .in('uuid', clientUuids);

            if (usersError) {
                console.error('Erro na Etapa 2 (Users):', usersError);
            } else if (usersData) {
                usersData.forEach((user: any) => {
                    usersMap.set(user.uuid, { nome: user.nome, bairro: user.bairro });
                });
            }
        }
        
        // ETAPA 3: Mapear e combinar os dados (INCLUSÃO DOS UUIDs)
        const result = agendaData.map((item: any) => {
            const clienteUuid = item.cliente; 
            const userData = usersMap.get(clienteUuid) || { nome: 'Cliente Desconhecido', bairro: 'N/A' };
            
            const execucaoDate = new Date(item.execucao);
            
            return {
                id: item.chave, 
                chaveUnica: item.chaves.chaveunica,
                clienteNome: userData.nome, 
                bairro: userData.bairro,
                horario: format(execucaoDate, 'HH:mm'), 
                dataHorario: format(execucaoDate, 'dd/MM/yyyy - HH:mm'), 
                clienteUuid: clienteUuid, 
                profissionalUuid: filterUuid, 
            } as TaskCardData;
        });
        
        console.log('--- DEBUG FIM ---');
        return result;

    } catch (e) {
        console.error('Erro de rede ou Supabase:', e);
        return [];
    }
}


/**
 * Busca o nome do usuário (trabalhador) pela UUID.
 */
export async function fetchWorkerName(uuid: string): Promise<string> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('nome')
            .eq('uuid', uuid)
            .single(); 
            
        if (error) {
            console.error('Erro ao buscar o nome do trabalhador:', error);
            return 'Trabalhador(a)'; 
        }
        
        return data?.nome || 'Trabalhador(a)';
        
    } catch (e) {
        console.error('Erro de rede ao buscar o nome:', e);
        return 'Trabalhador(a)';
    }
}