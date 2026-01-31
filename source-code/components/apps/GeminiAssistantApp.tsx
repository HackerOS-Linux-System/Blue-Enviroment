import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles, AlertTriangle, LogOut, ArrowRight, Trash2, StopCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import { AppProps } from '../../types';
// @ts-ignore
import ReactMarkdown from 'react-markdown';

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
        { role: 'model', text: 'Hello! I am **Blue AI**, your integrated system assistant. How can I help you today?' }
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
                // @ts-ignore
                await window.aistudio.openSelectKey();
                setIsConnected(true);
            } else {
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

    const handleClearChat = () => {
        setMessages([{ role: 'model', text: 'Chat cleared. How can I help?' }]);
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage = input;
        setInput('');
        setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
        setIsLoading(true);

        try {
            const currentKey = apiKey || process.env.API_KEY || '';
            if (!currentKey) {
                // @ts-ignore
                if (window.aistudio) {
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
            <div className="relative animate-bounce-slow">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-600/20 transform rotate-3">
            <Bot size={48} className="text-white" />
            </div>
            </div>

            <div>
            <h2 className="text-3xl font-bold text-white mb-2">Welcome to Blue AI</h2>
            <p className="text-slate-400 max-w-xs mx-auto text-sm leading-relaxed">
            Your intelligent system companion powered by Gemini 3. Sign in to start.
            </p>
            </div>

            {!showManualInput ? (
                <div className="space-y-4 w-full max-w-xs animate-in fade-in slide-in-from-bottom-2">
                <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full flex items-center justify-center gap-3 bg-white text-slate-900 px-6 py-3.5 rounded-xl font-semibold hover:bg-slate-100 transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed shadow-lg"
                >
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
        <div className="p-4 border-b border-white/5 bg-slate-900/95 backdrop-blur z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg shadow-lg shadow-blue-500/20">
        <Bot size={20} className="text-white" />
        </div>
        <div>
        <h3 className="font-bold text-sm">Blue Assistant</h3>
        <p className="text-xs text-blue-300 flex items-center gap-1">
        <Sparkles size={10} /> Gemini 3 Flash
        </p>
        </div>
        </div>
        <div className="flex items-center gap-1">
        <button onClick={handleClearChat} className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Clear Chat">
        <Trash2 size={16} />
        </button>
        <button onClick={() => setIsConnected(false)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-white/10 rounded-lg transition-colors" title="Sign Out">
        <LogOut size={16} />
        </button>
        </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.map((msg, idx) => (
            <div
            key={idx}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
            <div
            className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                ? 'bg-blue-600 text-white rounded-br-none shadow-blue-900/20'
                : msg.role === 'error'
                ? 'bg-red-500/10 border border-red-500/50 text-red-200 rounded-bl-none'
                : 'bg-slate-800 text-slate-100 rounded-bl-none border border-white/5 shadow-black/20'
            }`}
            >
            {msg.role === 'error' && <AlertTriangle size={14} className="inline mr-2 -mt-0.5" />}
            {msg.role === 'model' ? (
                <div className="markdown-content">
                <ReactMarkdown
                components={{
                    code(props: any) {
                        const {children, className, node, ...rest} = props
                        return <code {...rest} className={`${className} bg-slate-950/50 px-1 py-0.5 rounded text-blue-200 font-mono text-xs`}>{children}</code>
                    },
                    pre(props: any) {
                        return <pre className="bg-slate-950 p-3 rounded-lg overflow-x-auto my-2 border border-white/10 text-xs font-mono text-slate-300">{props.children}</pre>
                    }
                }}
                >
                {msg.text}
                </ReactMarkdown>
                </div>
            ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
            )}
            </div>
            </div>
        ))}
        {isLoading && messages[messages.length - 1].text === '' && (
            <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 border border-white/5 flex items-center gap-1.5 shadow-lg">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            </div>
        )}
        <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-slate-900 border-t border-white/5">
        <div className="relative flex items-center gap-2 bg-slate-800 rounded-xl border border-white/10 focus-within:border-blue-500/50 transition-colors p-1.5 pr-2 shadow-inner">
        <input
        type="text"
        className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none"
        placeholder="Ask anything..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        disabled={isLoading}
        autoFocus
        />
        <button
        onClick={handleSend}
        disabled={!input.trim() || isLoading}
        className={`p-2.5 rounded-lg transition-all ${
            input.trim() && !isLoading
            ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
        >
        {isLoading ? <StopCircle size={18} className="animate-pulse" /> : <Send size={18} />}
        </button>
        </div>
        </div>
        </div>
    );
};

export default GeminiAssistantApp;
