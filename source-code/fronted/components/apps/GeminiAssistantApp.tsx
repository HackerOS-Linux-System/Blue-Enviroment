import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, AlertTriangle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { AppProps } from '../../types';

// Use ReactMarkdown if available, but for this standalone strict example we will use simple text formatting
// Since we can't install external deps like react-markdown, we will just display text.

interface Message {
    role: 'user' | 'model' | 'error';
    text: string;
}

const GeminiAssistantApp: React.FC<AppProps> = () => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'Hello! I am Blue AI, your integrated system assistant. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            if (!process.env.API_KEY) {
                throw new Error('API Key not found. Please check your environment configuration.');
            }

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            // Using stream for better UX
            const streamResult = await ai.models.generateContentStream({
                model: 'gemini-3-flash-preview',
                contents: [
                    { role: 'user', parts: [{ text: userMessage }] }
                ],
            });

            let fullText = '';

            // Add a placeholder message for streaming
            setMessages(prev => [...prev, { role: 'model', text: '' }]);

            for await (const chunk of streamResult) {
                const chunkText = chunk.text;
                if (chunkText) {
                    fullText += chunkText;
                    setMessages(prev => {
                        const newHistory = [...prev];
                        const lastMsg = newHistory[newHistory.length - 1];
                        if (lastMsg.role === 'model') {
                            lastMsg.text = fullText;
                        }
                        return newHistory;
                    });
                }
            }

        } catch (error: any) {
            console.error("Gemini Error:", error);
            setMessages(prev => [...prev, { role: 'error', text: `Error: ${error.message || 'Something went wrong.'}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-slate-900/50 flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
        <Bot size={20} className="text-white" />
        </div>
        <div>
        <h3 className="font-semibold text-sm">Blue Assistant</h3>
        <p className="text-xs text-blue-300 flex items-center gap-1">
        <Sparkles size={10} /> Powered by Gemini
        </p>
        </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
            <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
            <div
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none shadow-lg shadow-blue-900/20'
                : msg.role === 'error'
                ? 'bg-red-500/10 border border-red-500/50 text-red-200 rounded-bl-none'
                : 'bg-slate-800 text-slate-100 rounded-bl-none border border-white/5'
            }`}
            >
            {msg.role === 'error' && <AlertTriangle size={14} className="inline mr-2 -mt-0.5" />}
            <div className="whitespace-pre-wrap">{msg.text}</div>
            </div>
            </div>
        ))}
        {isLoading && messages[messages.length - 1].text === '' && (
            <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-white/5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            </div>
        )}
        <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-slate-900 border-t border-white/5">
        <div className="relative flex items-center gap-2 bg-slate-800 rounded-xl border border-white/10 focus-within:border-blue-500/50 transition-colors p-1 pr-2">
        <input
        type="text"
        className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
        placeholder="Ask Blue AI..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isLoading}
        />
        <button
        onClick={handleSend}
        disabled={!input.trim() || isLoading}
        className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white transition-all shadow-lg shadow-blue-500/20 disabled:shadow-none"
        >
        <Send size={16} />
        </button>
        </div>
        <p className="text-[10px] text-center text-slate-600 mt-2">
        Blue AI can make mistakes. Consider checking important information.
        </p>
        </div>
        </div>
    );
};

export default GeminiAssistantApp;
