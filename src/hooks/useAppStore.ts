import React, { useReducer, useCallback, useMemo } from 'react';
import { LogEntry, BotStats } from '../types';
import { INITIAL_STATS, STORAGE_KEY_DEVICE_ID } from '../constants';

type State = {
  logs: LogEntry[];
  sessionStats: Record<string, BotStats>;
  identityStats: Record<string, BotStats>;
};

type Action = 
  | { type: 'ADD_LOG', log: LogEntry }
  | { type: 'CLEAR_LOGS' }
  | { type: 'UPDATE_STATS', id: string, update: Partial<Record<keyof BotStats, number>>, deviceId: string }
  | { type: 'SET_IDENTITY_STATS', id: string, stats: BotStats }
  | { type: 'RESET_STATS', id?: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_LOG':
      return {
        ...state,
        logs: [action.log, ...state.logs].slice(0, 100)
      };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'RESET_STATS':
      if (action.id) {
        const newSessionStats = { ...state.sessionStats };
        delete newSessionStats[action.id];
        return { ...state, sessionStats: newSessionStats };
      }
      return { ...state, sessionStats: {} };
    case 'UPDATE_STATS': {
      const { id, update, deviceId } = action;
      
      // Update Session Stats
      const currentSession = state.sessionStats[id] || { ...INITIAL_STATS };
      const newSessionStats = { ...state.sessionStats };
      const updatedSession = { ...currentSession };

      Object.entries(update).forEach(([key, value]) => {
        const k = key as keyof BotStats;
        const currentMap = { ...(updatedSession[k] || {}) };
        currentMap[deviceId] = (currentMap[deviceId] || 0) + (value || 0);
        updatedSession[k] = currentMap;
      });

      newSessionStats[id] = updatedSession;

      // Update Identity Stats (All-time)
      const currentStats = state.identityStats[id] || { ...INITIAL_STATS };
      const newStats = { ...currentStats };

      Object.entries(update).forEach(([key, value]) => {
        const k = key as keyof BotStats;
        const currentMap = { ...(newStats[k] || {}) };
        currentMap[deviceId] = (currentMap[deviceId] || 0) + (value || 0);
        newStats[k] = currentMap;
      });

      return {
        ...state,
        sessionStats: newSessionStats,
        identityStats: {
          ...state.identityStats,
          [id]: newStats
        }
      };
    }
    case 'SET_IDENTITY_STATS':
      return {
        ...state,
        identityStats: {
          ...state.identityStats,
          [action.id]: action.stats
        }
      };
    default:
      return state;
  }
}

export function useAppStore() {
  const [state, dispatch] = useReducer(reducer, {
    logs: [],
    sessionStats: {},
    identityStats: {}
  });

  const deviceId = useMemo(() => {
    const saved = localStorage.getItem(STORAGE_KEY_DEVICE_ID);
    return saved || 'default-device';
  }, []);

  const addLog = useCallback((
    message: string, 
    type: LogEntry['type'] = 'info', 
    pubkey?: string, 
    botName?: string, 
    eventId?: string, 
    relays?: string[],
    contextContent?: string,
    contextPubkey?: string,
    botId?: string,
    targetEventId?: string
  ) => {
    dispatch({
      type: 'ADD_LOG',
      log: {
        id: Math.random().toString(36).substring(7),
        timestamp: Date.now(),
        type,
        message,
        pubkey,
        botName,
        botId,
        eventId,
        targetEventId,
        relays,
        contextContent,
        contextPubkey
      }
    });
  }, []);

  const clearLogs = useCallback(() => dispatch({ type: 'CLEAR_LOGS' }), []);

  const updateStats = useCallback((id: string, update: Partial<Record<keyof BotStats, number>>) => {
    dispatch({ type: 'UPDATE_STATS', id, update, deviceId });
  }, [deviceId]);

  const setIdentityStats = useCallback((id: string, stats: BotStats) => {
    dispatch({ type: 'SET_IDENTITY_STATS', id, stats });
  }, []);

  const resetStats = useCallback((id?: string) => {
    dispatch({ type: 'RESET_STATS', id });
  }, []);

  return {
    state,
    addLog,
    clearLogs,
    updateStats,
    setIdentityStats,
    resetStats
  };
}
