import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, AlertTriangle, Chrome, Key, LogOut, ArrowRight } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { AppProps } from '../../types';

interface Message {
    role: 'user' | 'model' | 'error';
    text: string;
}

const GeminiAssistantApp: React.FC<AppProps> = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [apiKey, setApiKey] = useState(process.env.API_KEY || '');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [showManualInput, setShowManualInput] = useState(false);
    const [manualKey, setManualKey] = useState('');

    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'Hello! I am Blue AI, your integrated system assistant. How can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    useEffect(() => {
        // Auto-login check
        // @ts-ignore
        if (window.aistudio && window.aistudio.hasSelectedApiKey) {
            // @ts-ignore
            window.aistudio.hasSelectedApiKey().then((has: boolean) => {
                if(has) setIsConnected(true);
            });
        }
    }, []);

    const handleGoogleLogin = async () => {
        setIsLoggingIn(true);
        try {
            // @ts-ignore
            if (window.aistudio) {
                // The environment handles the actual OAuth/Key exchange UI
                // @ts-ignore
                await window.aistudio.openSelectKey();
                setIsConnected(true);
            } else {
                // Fallback: Show manual input field instead of prompt
                console.warn("Google AI Studio environment not detected. Showing manual input.");
                setShowManualInput(true);
            }
        } catch (e) {
            console.error("Login failed", e);
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleManualSubmit = () => {
        if (manualKey.trim().length > 5) {
            setApiKey(manualKey.trim());
            setIsConnected(true);
            setShowManualInput(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const currentKey = apiKey || process.env.API_KEY || '';

            // Fallback check if key is empty
            if (!currentKey) {
                // @ts-ignore
                if (window.aistudio) {
                    // If we are here, we might need to re-select
                    // @ts-ignore
                    await window.aistudio.openSelectKey();
                } else {
                    throw new Error("API Key missing. Please sign in again.");
                }
            }

            const ai = new GoogleGenAI({ apiKey: currentKey || process.env.API_KEY });

            const streamResult = await ai.models.generateContentStream({
                model: 'gemini-3-flash-preview',
                contents: [
                    { role: 'user', parts: [{ text: userMessage }] }
                ],
            });

            let fullText = '';
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
            const errText = error.message || "An unknown error occurred.";
            setMessages(prev => [...prev, { role: 'error', text: `Error: ${errText}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isConnected) {
        return (
            <div className="h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-8">
            <div className="relative">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/20 transform rotate-3">
            <Bot size={48} className="text-white" />
            </div>
            <div className="absolute -bottom-2 -right-2 bg-white text-blue-600 p-2 rounded-full shadow-lg">
            <Sparkles size={20} />
            </div>
            </div>

            <div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome to Blue AI</h2>
            <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">
            Your intelligent system companion. Sign in with your Google Account to unlock advanced reasoning capabilities.
            </p>
            </div>

            {!showManualInput ? (
                <div className="space-y-4 w-full max-w-xs animate-in fade-in slide-in-from-bottom-2">
                <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 px-6 py-3.5 rounded-xl font-semibold hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg"
                >
                {isLoggingIn ? (
                    <div className="w-5 h-5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    // Google G Icon
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                )}
                {isLoggingIn ? 'Connecting...' : 'Sign in with Google'}
                </button>
                <button onClick={() => setShowManualInput(true)} className="text-xs text-slate-500 hover:text-blue-400 transition-colors">
                I have an API Key
                </button>
                </div>
            ) : (
                <div className="w-full max-w-xs animate-in fade-in slide-in-from-right-4">
                <div className="bg-slate-800 border border-white/10 rounded-xl p-1 flex items-center">
                <input
                type="password"
                placeholder="Enter Gemini API Key"
                className="flex-1 bg-transparent px-3 py-2 text-sm text-white focus:outline-none"
                value={manualKey}
                onChange={e => setManualKey(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleManualSubmit()}
                />
                <button
                onClick={handleManualSubmit}
                className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded-lg transition-colors"
                >
                <ArrowRight size={16} />
                </button>
                </div>
                <button onClick={() => setShowManualInput(false)} className="mt-4 text-xs text-slate-500 hover:text-white transition-colors">
                Back to Google Sign In
                </button>
                </div>
            )}
            </div>
        )
    }

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-slate-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
        <Bot size={20} className="text-white" />
        </div>
        <div>
        <h3 className="font-semibold text-sm">Blue Assistant</h3>
        <p className="text-xs text-blue-300 flex items-center gap-1">
        <Sparkles size={10} /> Pro Mode Active
        </p>
        </div>
        </div>
        <button onClick={() => setIsConnected(false)} className="text-xs text-slate-500 hover:text-white px-2 flex items-center gap-1">
        <LogOut size={12} /> Sign Out
        </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
            <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
            <div
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none shadow-blue-900/20'
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
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
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
        </div>
        </div>
    );
};

export default GeminiAssistantApp;
