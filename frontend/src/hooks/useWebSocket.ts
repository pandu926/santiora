"use client";

import React, { createContext, useContext, useCallback, type ReactNode } from "react";

export interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export type WsEvent = WsMessage;
export interface NewMarketEvent extends WsMessage { type: "NewMarket"; address: string; question: string; category: string; }
export interface BetPlacedEvent extends WsMessage { type: "BetPlaced"; market_address: string; bettor: string; is_yes: boolean; amount: string; }
export interface MarketResolvedEvent extends WsMessage { type: "MarketResolved"; address: string; outcome: boolean; confidence: number; }
export interface MarketUpdatedEvent extends WsMessage { type: "MarketUpdated"; address: string; }
export interface OddsChangedEvent extends WsMessage { type: "OddsChanged"; market_address: string; yes_odds: number; }
export interface AgentActivityEvent extends WsMessage { type: "AgentActivity"; agent: string; step: string; market_address: string; detail: string; timestamp: number; }

interface WebSocketContextValue {
  lastMessage: WsMessage | null;
  isConnected: boolean;
  recentEvents: WsEvent[];
  subscribe: (type: string, handler: (event: WsEvent) => void) => () => void;
}

const defaultValue: WebSocketContextValue = {
  lastMessage: null,
  isConnected: false,
  recentEvents: [],
  subscribe: () => () => {},
};

const WebSocketContext = createContext<WebSocketContextValue>(defaultValue);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  return React.createElement(WebSocketContext.Provider, { value: defaultValue }, children);
}

export function useWebSocket() {
  const ctx = useContext(WebSocketContext);
  const subscribe = useCallback((_type: string, _handler: (event: WsEvent) => void) => {
    return () => {};
  }, []);
  return { ...ctx, subscribe };
}
