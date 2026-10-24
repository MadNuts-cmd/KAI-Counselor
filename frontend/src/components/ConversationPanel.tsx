import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Sparkles, User, ArrowDown, Brain, Smile, X } from 'lucide-react';
import type { ChatMessage } from '../types/events';

interface ConversationPanelProps {
  messages: ChatMessage[];
  isStreaming?: boolean;
  partialText?: string;
  onClose?: () => void;
  className?: string;
}

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  isStreaming = false,
  partialText = '',
  onClose,
  className = '',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const prevMsgLengthRef = useRef(messages.length);

  const scrollToBottom = (smooth = true) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setIsScrolledUp(false);
      setNewMessagesCount(0);
    }
  };

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Bounded check: if within 45px of the bottom, consider at-bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 45;
    if (isAtBottom) {
      setIsScrolledUp(false);
      setNewMessagesCount(0);
    } else {
      setIsScrolledUp(true);
    }
  };

  // Follow new messages if near bottom, otherwise increment badge without forcing scroll
  useEffect(() => {
    const diff = messages.length - prevMsgLengthRef.current;
    if (diff > 0) {
      if (!isScrolledUp) {
        scrollToBottom(true);
      } else {
        setNewMessagesCount((prev) => prev + diff);
      }
    }
    prevMsgLengthRef.current = messages.length;
  }, [messages.length, isScrolledUp]);

  // Initial scroll on mount
  useEffect(() => {
    scrollToBottom(false);
  }, []);

  return (
    <div
      className={`flex flex-col h-full bg-[#0D1117] border-r border-[#1C2331] select-text relative text-xs ${className}`}
    >
      {/* Panel Header */}
      <div className="h-11 px-3.5 border-b border-[#1C2331] flex items-center justify-between shrink-0 bg-[#101520]/90 select-none">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">
            Dialogue & Memory
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
            {messages.length} turns
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
              title="Close Dialogue Window"
              aria-label="Close Dialogue Window"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-700/60 scrollbar-track-transparent"
      >
        {messages.length === 0 && !isStreaming ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
            <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-2.5 text-cyan-400/70 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-300">Session Ready</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[200px] leading-relaxed">
              Start conversation to engage. Biofeedback telemetry will ground the clinical reflection.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.speaker === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              {/* Speaker Label & Timestamp */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-slate-400 font-mono">
                {msg.speaker === 'user' ? (
                  <>
                    <span>Personnel</span>
                    <User className="w-2.5 h-2.5 text-slate-400" />
                  </>
                ) : (
                  <>
                    <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
                    <span className="text-cyan-300 font-medium">KAI Counselor</span>
                  </>
                )}
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[88%] rounded-2xl p-2.5 sm:p-3 text-xs leading-relaxed ${
                  msg.speaker === 'user'
                    ? 'bg-[#18202E] border border-cyan-500/20 text-slate-100 rounded-tr-none shadow-sm'
                    : 'bg-[#121724] border border-[#222E42] text-slate-100 rounded-tl-none shadow-sm'
                }`}
              >
                {/* Emotion Tag */}
                {msg.emotionTag && (
                  <div className="mb-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-950/60 border border-purple-500/30 text-purple-300 text-[9px] font-mono font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>Affect: {msg.emotionTag}</span>
                  </div>
                )}

                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Turn Telemetry Footer if available */}
                {(msg.eegState || msg.facialState) && (
                  <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[9px] text-slate-400 font-mono">
                    {msg.eegState && (
                      <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                        <Brain className="w-2.5 h-2.5 text-cyan-400" />
                        EEG: {msg.eegState}
                      </span>
                    )}
                    {msg.facialState && (
                      <span className="flex items-center gap-1 bg-slate-900/90 px-1.5 py-0.5 rounded border border-slate-800">
                        <Smile className="w-2.5 h-2.5 text-purple-400" />
                        Face: {msg.facialState}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* Live Streaming / Thinking Indicator */}
        {isStreaming && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-1 mb-1 px-1 text-[10px] text-cyan-400 font-mono">
              <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
              <span>Formulating clinical response...</span>
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-none p-2.5 bg-[#121724]/70 border border-cyan-500/30 text-slate-400 text-xs italic animate-pulse">
              {partialText || 'Analyzing neuro-affective telemetry and structuring empathetic reflection...'}
            </div>
          </div>
        )}
      </div>

      {/* Floating Scroll to Bottom Button */}
      {isScrolledUp && (
        <button
          onClick={() => scrollToBottom(true)}
          className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-600/90 hover:bg-cyan-500 text-slate-950 font-semibold shadow-[0_4px_16px_rgba(54,207,255,0.35)] backdrop-blur-md transition-all cursor-pointer text-[10px]"
          title="Scroll to latest message"
        >
          <ArrowDown className="w-3 h-3" />
          <span>Latest {newMessagesCount > 0 ? `(${newMessagesCount} new)` : ''}</span>
        </button>
      )}
    </div>
  );
};
