/**
 * @fileoverview Chat context and provider.
 * Manages global chat state: rooms, active room, messages, online users, typing users.
 * Updated by socket events and api calls throughout the chat lifecycle.
 */

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  ReactNode,
} from 'react';
import { ChatRoom, Message } from '../types';

// --- state shape ---

interface ChatState {
  rooms: ChatRoom[];
  activeRoom: ChatRoom | null;
  messages: Message[];
  onlineUsers: string[];
  typingUsers: string[];
  isLoadingRooms: boolean;
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
}

// --- action types ---

type ChatAction =
  | { type: 'SET_ROOMS'; payload: ChatRoom[] }
  | { type: 'ADD_ROOM'; payload: ChatRoom }
  | { type: 'UPDATE_ROOM'; payload: ChatRoom }
  | { type: 'SET_ACTIVE_ROOM'; payload: ChatRoom | null }
  | { type: 'SET_MESSAGES'; payload: Message[] }
  | { type: 'PREPEND_MESSAGES'; payload: Message[] }
  | { type: 'ADD_MESSAGE'; payload: Message }
  | { type: 'DELETE_MESSAGE'; payload: string }
  | { type: 'SET_ONLINE_USERS'; payload: string[] }
  | { type: 'ADD_ONLINE_USER'; payload: string }
  | { type: 'REMOVE_ONLINE_USER'; payload: string }
  | { type: 'SET_TYPING_USERS'; payload: string[] }
  | { type: 'ADD_TYPING_USER'; payload: string }
  | { type: 'REMOVE_TYPING_USER'; payload: string }
  | { type: 'SET_LOADING_ROOMS'; payload: boolean }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  | { type: 'SET_HAS_MORE_MESSAGES'; payload: boolean }
  | { type: 'CLEAR_CHAT' };

// --- initial state ---

const initialState: ChatState = {
  rooms: [],
  activeRoom: null,
  messages: [],
  onlineUsers: [],
  typingUsers: [],
  isLoadingRooms: false,
  isLoadingMessages: false,
  hasMoreMessages: false,
};

// --- reducer ---

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload };

    case 'ADD_ROOM':
      return { ...state, rooms: [action.payload, ...state.rooms] };

    case 'UPDATE_ROOM': {
      const rooms = state.rooms.map((r) =>
        r.id === action.payload.id ? action.payload : r
      );
      const activeRoom =
        state.activeRoom?.id === action.payload.id
          ? action.payload
          : state.activeRoom;
      return { ...state, rooms, activeRoom };
    }

    case 'SET_ACTIVE_ROOM':
      // clear messages and typing users when switching rooms
      return {
        ...state,
        activeRoom: action.payload,
        messages: [],
        typingUsers: [],
        hasMoreMessages: false,
      };

    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };

    case 'PREPEND_MESSAGES':
      // prepend older messages (loaded from pagination) at the top
      return {
        ...state,
        messages: [...action.payload, ...state.messages],
      };

    case 'ADD_MESSAGE': {
      // avoid duplicate messages from optimistic updates + socket echo
      const exists = state.messages.some((m) => m.id === action.payload.id);
      if (exists) return state;
      // update the room's last message preview
      const rooms = state.rooms.map((r) =>
        r.id === action.payload.roomId
          ? { ...r, lastMessage: action.payload }
          : r
      );
      return {
        ...state,
        messages: [...state.messages, action.payload],
        rooms,
      };
    }

    case 'DELETE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.id === action.payload ? { ...m, isDeleted: true } : m
        ),
      };

    case 'SET_ONLINE_USERS':
      return { ...state, onlineUsers: action.payload };

    case 'ADD_ONLINE_USER':
      if (state.onlineUsers.includes(action.payload)) return state;
      return { ...state, onlineUsers: [...state.onlineUsers, action.payload] };

    case 'REMOVE_ONLINE_USER':
      return {
        ...state,
        onlineUsers: state.onlineUsers.filter((u) => u !== action.payload),
      };

    case 'SET_TYPING_USERS':
      return { ...state, typingUsers: action.payload };

    case 'ADD_TYPING_USER':
      if (state.typingUsers.includes(action.payload)) return state;
      return {
        ...state,
        typingUsers: [...state.typingUsers, action.payload],
      };

    case 'REMOVE_TYPING_USER':
      return {
        ...state,
        typingUsers: state.typingUsers.filter((u) => u !== action.payload),
      };

    case 'SET_LOADING_ROOMS':
      return { ...state, isLoadingRooms: action.payload };

    case 'SET_LOADING_MESSAGES':
      return { ...state, isLoadingMessages: action.payload };

    case 'SET_HAS_MORE_MESSAGES':
      return { ...state, hasMoreMessages: action.payload };

    case 'CLEAR_CHAT':
      return initialState;

    default:
      return state;
  }
}

// --- context interface ---

interface ChatContextValue extends ChatState {
  setRooms: (rooms: ChatRoom[]) => void;
  addRoom: (room: ChatRoom) => void;
  setActiveRoom: (room: ChatRoom | null) => void;
  setMessages: (messages: Message[]) => void;
  prependMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  deleteMessage: (messageId: string) => void;
  setOnlineUsers: (users: string[]) => void;
  addOnlineUser: (userId: string) => void;
  removeOnlineUser: (userId: string) => void;
  setTypingUsers: (users: string[]) => void;
  addTypingUser: (username: string) => void;
  removeTypingUser: (username: string) => void;
  setLoadingRooms: (loading: boolean) => void;
  setLoadingMessages: (loading: boolean) => void;
  setHasMoreMessages: (hasMore: boolean) => void;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

// --- provider ---

interface ChatProviderProps {
  children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const setRooms = useCallback((rooms: ChatRoom[]) => {
    dispatch({ type: 'SET_ROOMS', payload: rooms });
  }, []);

  const addRoom = useCallback((room: ChatRoom) => {
    dispatch({ type: 'ADD_ROOM', payload: room });
  }, []);

  const setActiveRoom = useCallback((room: ChatRoom | null) => {
    dispatch({ type: 'SET_ACTIVE_ROOM', payload: room });
  }, []);

  const setMessages = useCallback((messages: Message[]) => {
    dispatch({ type: 'SET_MESSAGES', payload: messages });
  }, []);

  const prependMessages = useCallback((messages: Message[]) => {
    dispatch({ type: 'PREPEND_MESSAGES', payload: messages });
  }, []);

  const addMessage = useCallback((message: Message) => {
    dispatch({ type: 'ADD_MESSAGE', payload: message });
  }, []);

  const deleteMessage = useCallback((messageId: string) => {
    dispatch({ type: 'DELETE_MESSAGE', payload: messageId });
  }, []);

  const setOnlineUsers = useCallback((users: string[]) => {
    dispatch({ type: 'SET_ONLINE_USERS', payload: users });
  }, []);

  const addOnlineUser = useCallback((userId: string) => {
    dispatch({ type: 'ADD_ONLINE_USER', payload: userId });
  }, []);

  const removeOnlineUser = useCallback((userId: string) => {
    dispatch({ type: 'REMOVE_ONLINE_USER', payload: userId });
  }, []);

  const setTypingUsers = useCallback((users: string[]) => {
    dispatch({ type: 'SET_TYPING_USERS', payload: users });
  }, []);

  const addTypingUser = useCallback((username: string) => {
    dispatch({ type: 'ADD_TYPING_USER', payload: username });
  }, []);

  const removeTypingUser = useCallback((username: string) => {
    dispatch({ type: 'REMOVE_TYPING_USER', payload: username });
  }, []);

  const setLoadingRooms = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING_ROOMS', payload: loading });
  }, []);

  const setLoadingMessages = useCallback((loading: boolean) => {
    dispatch({ type: 'SET_LOADING_MESSAGES', payload: loading });
  }, []);

  const setHasMoreMessages = useCallback((hasMore: boolean) => {
    dispatch({ type: 'SET_HAS_MORE_MESSAGES', payload: hasMore });
  }, []);

  const clearChat = useCallback(() => {
    dispatch({ type: 'CLEAR_CHAT' });
  }, []);

  const value: ChatContextValue = {
    ...state,
    setRooms,
    addRoom,
    setActiveRoom,
    setMessages,
    prependMessages,
    addMessage,
    deleteMessage,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setTypingUsers,
    addTypingUser,
    removeTypingUser,
    setLoadingRooms,
    setLoadingMessages,
    setHasMoreMessages,
    clearChat,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// --- hook ---

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}

export default ChatContext;
