import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Shield, Search, Clock, Loader2, LogOut, Terminal, AlertCircle, Key, ExternalLink, ShieldCheck, ChevronDown, FileCode, Lock, Globe, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast, Toaster } from 'sonner';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { MovieItem, SearchResponse, ResolveResponse, InitResponse, AuthResponse, SessionData, PostDetail, ApiResponse } from '@shared/types';
import { encryptData } from '@shared/crypto';
import { cn } from '@/lib/utils';
export function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [session, setSession] = useState<SessionData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<MovieItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [selectedPost, setSelectedPost] = useState<PostDetail | null>(null);
  const [isLoadingPostId, setIsLoadingPostId] = useState<string | null>(null);
  const initializationLock = useRef(false);
  const searchExecutedRef = useRef<string | null>(null);
  const handleLogout = useCallback((msg = 'Session Terminated') => {
    setSession(null);
    localStorage.removeItem('sg_session');
    setResults([]);
    setHasSearched(false);
    setSelectedPost(null);
    searchExecutedRef.current = null;
    if (msg) toast.error(msg, { icon: <Shield className="w-4 h-4" /> });
  }, []);
  const executeSearch = useCallback(async (query: string, currentSession: SessionData) => {
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const encryptedQuery = await encryptData(query, currentSession.token);
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': currentSession.token },
        body: JSON.stringify({ payload: encryptedQuery })
      });
      const data: SearchResponse = await res.json();
      if (data.success) {
        setResults(data.results || []);
      } else if (res.status === 401) {
        handleLogout('Session Validation Failed');
      }
    } catch (err) {
      toast.error('Search Node Offline');
    } finally {
      setIsSearching(false);
    }
  }, [handleLogout]);
  const initializeSession = useCallback(async (providedKey?: string) => {
    if (initializationLock.current) return null;
    initializationLock.current = true;
    try {
      if (providedKey) {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: providedKey })
        });
        const data: AuthResponse = await res.json();
        if (data.success && data.token && data.expiresAt) {
          const newSession: SessionData = {
            token: data.token,
            expiresAt: data.expiresAt,
            startedAt: Date.now(),
            totalDuration: data.expiresAt - Date.now()
          };
          setSession(newSession);
          localStorage.setItem('sg_session', JSON.stringify(newSession));
          toast.success('Access Granted: Master Key Verified', { icon: <ShieldCheck className="w-4 h-4 text-green-500" /> });
          setSearchParams(params => {
            params.delete('key');
            return params;
          }, { replace: true });
          initializationLock.current = false;
          return newSession;
        } else {
          toast.error('Access Denied: Invalid Master Key');
        }
      }
      const res = await fetch('/api/init');
      const data: InitResponse = await res.json();
      if (data.success) {
        const newSession: SessionData = {
          token: data.token,
          expiresAt: data.expiresAt,
          startedAt: Date.now(),
          totalDuration: data.expiresAt - Date.now()
        };
        setSession(newSession);
        localStorage.setItem('sg_session', JSON.stringify(newSession));
        initializationLock.current = false;
        return newSession;
      }
    } catch (err) {
      console.error('Handshake failed');
    } finally {
      initializationLock.current = false;
    }
    return null;
  }, [setSearchParams]);
  useEffect(() => {
    const keyParam = searchParams.get('key');
    const findParam = searchParams.get('find');
    const saved = localStorage.getItem('sg_session');
    const setup = async () => {
      let activeSession = session;
      if (!activeSession) {
        if (keyParam) {
          activeSession = await initializeSession(keyParam);
        } else if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.expiresAt > Date.now()) {
              setSession(parsed);
              activeSession = parsed;
            } else {
              activeSession = await initializeSession();
            }
          } catch {
            activeSession = await initializeSession();
          }
        } else {
          activeSession = await initializeSession();
        }
      }
      if (findParam && activeSession && searchExecutedRef.current !== findParam) {
        searchExecutedRef.current = findParam;
        setSearchQuery(findParam);
        executeSearch(findParam, activeSession);
      }
    };
    setup();
  }, [searchParams, session, initializeSession, executeSearch]);
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, session.expiresAt - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) handleLogout('Session Expired: Re-authentication Required');
    }, 1000);
    return () => clearInterval(interval);
  }, [session, handleLogout]);
  const analyzePost = async (postId: string) => {
    if (!session) return;
    setIsLoadingPostId(postId);
    try {
      const res = await fetch(`/api/post?id=${postId}`, {
        headers: { 'Authorization': session.token }
      });
      const data: ApiResponse<PostDetail> = await res.json();
      if (data.success && data.data) {
        setSelectedPost(data.data);
      } else {
        toast.error('Post Data Encrypted or Missing');
      }
    } catch (err) {
      toast.error('Extraction Protocol Failure');
    } finally {
      setIsLoadingPostId(null);
    }
  };
  const handleDownload = async (id: string) => {
    if (!session) return;
    setResolvingId(id);
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': session.token },
        body: JSON.stringify({ id }),
      });
      const data: ResolveResponse = await res.json();
      if (data.success && data.url) {
        window.open(data.url, '_blank');
        toast.success('Link Resolved Successfully');
      } else {
        toast.error('Resolution Error: Link Expired');
      }
    } finally {
      setResolvingId(null);
    }
  };
  const formatTime = (ms: number) => {
    const mins = Math.floor(ms / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const isLowTime = timeLeft < 60000;
  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans selection:bg-green-500/30 selection:text-white">
      <ThemeToggle />
      <Toaster position="top-right" theme="dark" richColors />
      {/* HEADER SECTION */}
      <header className="border-b border-white/5 bg-black/60 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Shield className="w-5 h-5 md:w-6 md:h-6 text-green-500" />
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-green-500 rounded-full blur-md -z-10"
              />
            </div>
            <span className="font-mono font-black text-lg md:text-xl tracking-tighter text-white uppercase flex items-center gap-1">
              SECURE<span className="text-green-500">GATE</span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded bg-white/5 text-[8px] border border-white/10 text-zinc-500">v2.0</span>
            </span>
          </div>
          {session && (
            <div className="flex items-center gap-2 md:gap-4">
              <div className={cn(
                "flex items-center gap-2 px-2 md:px-3 py-1 rounded-full border text-[10px] md:text-xs font-mono transition-all duration-500 bg-black/40",
                isLowTime ? "border-red-500/50 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "border-white/10 text-zinc-400"
              )}>
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: isLowTime ? 0.5 : 2, repeat: Infinity }}
                >
                  <Circle className={cn("w-2 h-2 fill-current", isLowTime ? "text-red-500" : "text-green-500")} />
                </motion.div>
                <span className="hidden xs:inline">SESSION:</span>
                <span className="tabular-nums">{formatTime(timeLeft)}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleLogout()} 
                className="text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all rounded-full h-8 w-8 md:h-10 md:w-10"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-24">
        <div className="max-w-4xl mx-auto space-y-20">
          {/* HERO & SEARCH */}
          <div className="space-y-8 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="space-y-4"
            >
              <h1 className="text-6xl md:text-9xl font-display font-black tracking-tighter text-white leading-[0.85] uppercase">
                Asset <br /><span className="text-green-500">Gateway</span>
              </h1>
              <div className="flex items-center justify-center gap-4 text-zinc-500 font-mono text-[10px] md:text-xs uppercase tracking-[0.4em]">
                <span className="flex items-center gap-1.5"><Lock className="w-3 h-3" /> Encrypted</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> Decentralized</span>
                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3 h-3" /> Verified</span>
              </div>
            </motion.div>
            <form 
              onSubmit={(e) => { e.preventDefault(); if(session) executeSearch(searchQuery, session); }} 
              className="relative group max-w-2xl mx-auto mt-12"
            >
              <div className="absolute -inset-1 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-[2rem] blur-xl opacity-0 group-focus-within:opacity-100 transition duration-1000" />
              <div className="relative">
                <Input
                  className="h-16 md:h-20 bg-zinc-900/40 border-white/10 text-lg md:text-xl focus-visible:ring-green-500/40 rounded-[1.8rem] pl-14 pr-32 transition-all border-white/5 placeholder:text-zinc-700"
                  placeholder="Query database..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  disabled={!session || isSearching}
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-600 group-focus-within:text-green-500 transition-colors" />
                <Button 
                  type="submit" 
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-10 md:h-14 bg-green-600 hover:bg-green-500 text-white px-6 rounded-2xl font-mono shadow-lg shadow-green-500/10 transition-all active:scale-95" 
                  disabled={isSearching || !session}
                >
                  {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'EXECUTE'}
                </Button>
              </div>
            </form>
          </div>
          {/* RESULTS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {isSearching ? [...Array(6)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-40 rounded-2xl bg-zinc-900/50" />
                </div>
              )) : results.length > 0 ? results.map((item) => (
                <motion.div 
                  key={item.id} 
                  layout 
                  initial={{ opacity: 0, y: 20 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group"
                >
                  <Card className="bg-zinc-900/20 border-white/5 hover:border-green-500/30 transition-all duration-500 h-full flex flex-col group-hover:bg-zinc-900/40 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    <CardHeader className="p-6 flex-grow">
                      <div className="text-[9px] font-mono text-zinc-600 mb-2 tracking-widest uppercase">ID: {item.id}</div>
                      <CardTitle className="text-sm md:text-base font-bold text-zinc-200 group-hover:text-white transition-colors leading-tight mb-2 line-clamp-3 uppercase font-mono tracking-tight">
                        {item.title}
                      </CardTitle>
                    </CardHeader>
                    <CardFooter className="px-6 pb-6 pt-0">
                      <Button
                        onClick={() => analyzePost(item.id)}
                        disabled={isLoadingPostId !== null}
                        className={cn(
                          "w-full bg-zinc-800/40 hover:bg-green-600 text-white font-mono text-[10px] h-10 rounded-xl group/btn transition-all duration-300 border border-white/5",
                          isLoadingPostId === item.id && "animate-pulse"
                        )}
                      >
                        {isLoadingPostId === item.id ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : (
                          <Terminal className="w-3.5 h-3.5 mr-2 group-hover/btn:translate-x-1 transition-transform" />
                        )}
                        ANALYZE ENTRY
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              )) : hasSearched && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="col-span-full py-24 text-center border border-dashed border-white/10 rounded-[2.5rem] bg-zinc-950/50"
                >
                  <AlertCircle className="w-12 h-12 text-zinc-800 mx-auto mb-6" />
                  <h3 className="text-xl font-bold text-zinc-600 font-mono tracking-tighter">ZERO ASSETS MATCHED QUERY</h3>
                  <p className="text-zinc-800 text-xs font-mono mt-2">Check encryption key or search parameters</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* API DOCUMENTATION SECTION */}
          <section className="pt-24 border-t border-white/5">
            <div className="flex items-center gap-3 mb-10">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <FileCode className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white font-mono uppercase">API Reference</h2>
                <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-[0.2em]">System Integrations & Logic</p>
              </div>
            </div>
            <Accordion type="single" collapsible className="w-full space-y-3">
              {[
                { id: 'init', label: 'GET /api/init', desc: 'Handshake endpoint. Establishes a temporary public session and returns a bearer token for limited access.' },
                { id: 'search', label: 'POST /api/search', desc: 'Protected search node. Requires valid session and AES-256-GCM encrypted query payload for result extraction.' },
                { id: 'resolve', label: 'POST /api/resolve', desc: 'Secure resolver. Converts internal opaque reference IDs into proxied delivery URLs with one-time use logic.' },
                { id: 'post', label: 'GET /api/post', desc: 'Detail extraction. Parses WordPress content blocks to generate temporary reference mappings for download links.' }
              ].map((spec) => (
                <AccordionItem key={spec.id} value={spec.id} className="border-none bg-zinc-900/20 rounded-2xl px-5 overflow-hidden transition-all hover:bg-zinc-900/40">
                  <AccordionTrigger className="text-[11px] font-mono text-zinc-400 hover:text-green-400 uppercase tracking-widest py-5 no-underline hover:no-underline">
                    {spec.label}
                  </AccordionTrigger>
                  <AccordionContent className="text-zinc-500 font-mono text-[11px] leading-relaxed pb-6 border-t border-white/5 pt-4">
                    {spec.desc}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </div>
      </main>
      <footer className="py-16 border-t border-white/5 mt-24 bg-black/40">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center gap-8 mb-6 opacity-30">
            <Globe className="w-5 h-5 text-zinc-400" />
            <ShieldCheck className="w-5 h-5 text-zinc-400" />
            <Lock className="w-5 h-5 text-zinc-400" />
          </div>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.4em] mb-2">SecureGate Internal Infrastructure &copy; 2025</p>
          <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-zinc-800 uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
            ALL ENDPOINTS MONITORED IN REAL-TIME
          </div>
        </div>
      </footer>
      {/* RESOLUTION DIALOG */}
      <AnimatePresence>
        {selectedPost && (
          <Dialog open onOpenChange={(open) => !open && setSelectedPost(null)}>
            <DialogContent className="sm:max-w-[500px] bg-[#080808] border-white/10 text-white overflow-hidden p-0 rounded-[2rem]">
              <div className="h-1 w-full bg-gradient-to-r from-green-500/0 via-green-500 to-green-500/0 animate-pulse" />
              <div className="p-8">
                <DialogHeader className="mb-8">
                  <DialogTitle className="text-xl md:text-2xl font-bold text-white uppercase font-mono tracking-tighter leading-tight">
                    {selectedPost.title}
                  </DialogTitle>
                  <div className="flex items-center gap-2 mt-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                    <DialogDescription className="text-zinc-500 font-mono text-[10px] uppercase tracking-widest">
                      ACTIVE RESOLUTION NODE: {selectedPost.postId}
                    </DialogDescription>
                  </div>
                </DialogHeader>
                <div className="grid grid-cols-1 gap-4">
                  {selectedPost.links.map((link) => (
                    <Button
                      key={link.id}
                      onClick={() => handleDownload(link.id)}
                      disabled={!!resolvingId}
                      variant="outline"
                      className={cn(
                        "h-20 border-white/5 bg-zinc-900/30 hover:bg-green-950/20 hover:border-green-500/50 group/link transition-all rounded-[1.2rem] relative overflow-hidden",
                        resolvingId === link.id && "bg-green-950/20 border-green-500/50"
                      )}
                    >
                      <div className="flex justify-between items-center w-full px-4 font-mono">
                        <div className="flex flex-col items-start text-left">
                          <span className="text-[9px] text-zinc-600 uppercase tracking-widest mb-1">{link.label} NETWORK</span>
                          <span className="text-sm font-bold text-zinc-300 group-hover/link:text-white transition-colors">SECURE DELIVERY LINK</span>
                        </div>
                        {resolvingId === link.id ? (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-green-500 animate-pulse uppercase">RESOLVING...</span>
                            <Loader2 className="w-5 h-5 animate-spin text-green-500" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-full bg-white/5 group-hover/link:bg-green-500/20 transition-colors">
                            <ExternalLink className="w-4 h-4 text-zinc-600 group-hover/link:text-green-500 transition-colors" />
                          </div>
                        )}
                      </div>
                    </Button>
                  ))}
                </div>
                {selectedPost.links.length === 0 && (
                  <div className="py-16 text-center text-zinc-700 font-mono text-xs border border-dashed border-white/5 rounded-[1.5rem] bg-zinc-900/10">
                    <Lock className="w-8 h-8 mx-auto mb-4 opacity-20" />
                    NO RESOLVABLE ASSETS FOUND
                  </div>
                )}
                <div className="mt-8 pt-6 border-t border-white/5 flex justify-between items-center text-[9px] font-mono text-zinc-700 uppercase tracking-widest">
                  <span>ID: {selectedPost.postId}</span>
                  <span>ENCRYPTION: AES-256</span>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
    </div>
  );
}