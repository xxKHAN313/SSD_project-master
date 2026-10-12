/**
 * @fileoverview Message input area component.
 * Auto-resizing textarea, character counter, typing events, and send action.
 */

import React, { useState, useRef, useCallback, KeyboardEvent } from 'react';
import styles from './Chat.module.css';
import { useSocket } from '../../hooks/useSocket';
import chatService from '../../services/chatService';
import { useChatContext } from '../../store/chatContext';
import { useAppContext } from '../../store/appContext';

const MAX_CHARS = 1000;
// threshold where the counter turns red to warn the user
const WARN_THRESHOLD = 900;

export function MessageInput(): JSX.Element {
  const [content, setContent] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { activeRoom, addMessage } = useChatContext();
  useAppContext(); // context connected for potential future toast use
  const { emitTyping, emitStopTyping } = useSocket();

  // grow the textarea height to fit content, capped at 5 rows (~120px)
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length > MAX_CHARS) return; // hard-stop at max
    setContent(val);
    setSendError(null);
    autoResize();

    // emit typing event on each keystroke (the hook debounces internally)
    if (val.trim()) {
      emitTyping();
    } else {
      emitStopTyping();
    }
  };

  const handleSend = useCallback(async () => {
    const trimmed = content.trim();
    if (!trimmed || !activeRoom || isSending) return;

    setIsSending(true);
    setSendError(null);

    // optimistically clear the input before the network round-trip
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    emitStopTyping();

    try {
      const message = await chatService.sendMessage(activeRoom.id, trimmed);
      // add to local state immediately; socket echo will be deduplicated by the context reducer
      addMessage(message);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to send message.';
      setSendError(msg);
      // restore content so the user doesn't lose their message
      setContent(trimmed);
    } finally {
      setIsSending(false);
      textareaRef.current?.focus();
    }
  }, [content, activeRoom, isSending, emitStopTyping, addMessage]);

  // enter sends, shift+enter inserts a newline
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = content.trim().length > 0 && content.length <= MAX_CHARS && !isSending;
  const isNearLimit = content.length >= WARN_THRESHOLD;

  if (!activeRoom) {
    return (
      <div className={styles.inputArea}>
        <div className={styles.inputRow} style={{ opacity: 0.5 }}>
          <textarea
            className={styles.textarea}
            placeholder="Select a room to start chatting..."
            disabled
            rows={1}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.inputArea}>
      <div className={styles.inputRow}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={`Message #${activeRoom.name}`}
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={content.trim() ? emitTyping : undefined}
          onBlur={emitStopTyping}
          rows={1}
          aria-label="Message input"
          aria-multiline="true"
          disabled={isSending}
        />
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          title="Send (Enter)"
        >
          {isSending ? (
            /* tiny spinner inside the send button while awaiting the api */
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
              <path d="M12 2 a10 10 0 0 1 10 10" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }} />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          )}
        </button>
      </div>

      {/* footer row: error message or char counter */}
      <div className={styles.inputFooter}>
        {sendError ? (
          <span className={styles.inputError}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            Cannot send: {sendError}
          </span>
        ) : (
          <span />
        )}

        <span className={`${styles.charCount} ${isNearLimit ? styles.charCountWarn : ''}`}>
          {content.length}/{MAX_CHARS}
        </span>
      </div>
    </div>
  );
}

export default MessageInput;
