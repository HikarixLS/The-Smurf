import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiX, FiSend, FiFilm, FiChevronDown } from 'react-icons/fi';
import { getMovieRecommendations } from '@/services/ai/geminiService';
import { movieService } from '@/services/api/movieService';
import { getImageUrl, PLACEHOLDER_IMG } from '@/utils/helpers';
import styles from './AIAssistant.module.css';

// ── Mini movie card shown inside chat ─────────────────────────────────────────
const MiniMovieCard = ({ movie }) => {
    const navigate = useNavigate();
    const posterUrl = getImageUrl(movie.poster_url || movie.thumb_url);
    return (
        <div className={styles.miniCard} onClick={() => navigate(`/movie/${movie.slug}`)}>
            <img
                src={posterUrl}
                alt={movie.name}
                className={styles.miniPoster}
                onError={e => { e.target.onerror = null; e.target.src = PLACEHOLDER_IMG; }}
            />
            <div className={styles.miniInfo}>
                <p className={styles.miniTitle}>{movie.origin_name || movie.name}</p>
                <p className={styles.miniSub}>{movie.name}</p>
                <div className={styles.miniMeta}>
                    {movie.year && <span>{movie.year}</span>}
                    {movie.quality && <span className={styles.miniQuality}>{movie.quality}</span>}
                    {movie.lang && <span className={styles.miniLang}>{movie.lang}</span>}
                </div>
            </div>
        </div>
    );
};

// ── Typing dots ───────────────────────────────────────────────────────────────
const TypingDots = () => (
    <div className={styles.typingDots}>
        <span /><span /><span />
    </div>
);

// ── Initial welcome message ───────────────────────────────────────────────────
const WELCOME = {
    id: 0,
    role: 'assistant',
    text: 'Xin chào! 🎬 Tôi là trợ lý phim AI của The Smurf. Hãy cho tôi biết bạn muốn xem phim gì — thể loại, quốc gia, hay cả tên phim cụ thể cũng được!',
    movies: [],
    suggestions: ['Gợi ý phim hành động hay 🔥', 'Phim Hàn Quốc lãng mạn 💕', 'Phim kinh dị Nhật Bản 👻'],
};

// ── Main AIAssistant component ────────────────────────────────────────────────
const AIAssistant = () => {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([WELCOME]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [apiKeyMissing, setApiKeyMissing] = useState(false);
    const chatRef = useRef(null);
    const inputRef = useRef(null);
    const historyRef = useRef([]); // Gemini message history

    // Auto-scroll to bottom
    useEffect(() => {
        if (chatRef.current) {
            chatRef.current.scrollTop = chatRef.current.scrollHeight;
        }
    }, [messages, loading]);

    // Focus input when opened
    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 200);
    }, [open]);

    const fetchMoviesForSearches = useCallback(async (searches) => {
        if (!searches?.length) return [];
        const results = await Promise.allSettled(
            searches.map(s => {
                if (s.keyword) return movieService.searchMovies(s.keyword, 1, 6);
                if (s.category) return movieService.getMoviesByCategory(s.category, 1, '', 6, {
                    country: s.country,
                    year: s.year,
                    type: s.type,
                });
                if (s.country) return movieService.getMoviesByCountry(s.country, 1, '', 6, {
                    category: s.category,
                    year: s.year,
                });
                return Promise.resolve(null);
            })
        );
        const movies = [];
        const slugsSeen = new Set();
        for (const r of results) {
            if (r.status === 'fulfilled' && r.value?.data?.items) {
                for (const m of r.value.data.items) {
                    if (!slugsSeen.has(m.slug)) {
                        slugsSeen.add(m.slug);
                        movies.push(m);
                    }
                }
            }
        }
        return movies.slice(0, 8);
    }, []);

    const sendMessage = useCallback(async (text) => {
        const userText = text.trim();
        if (!userText || loading) return;

        // Add user message to UI
        setMessages(prev => [...prev, { id: Date.now(), role: 'user', text: userText }]);
        setInput('');
        setLoading(true);

        // Build Gemini history
        historyRef.current = [
            ...historyRef.current,
            { role: 'user', parts: [{ text: userText }] },
        ];

        try {
            const aiResponse = await getMovieRecommendations(historyRef.current);

            // Add model response to history
            historyRef.current = [
                ...historyRef.current,
                { role: 'model', parts: [{ text: JSON.stringify(aiResponse) }] },
            ];

            // Fetch actual movies from API
            const movies = await fetchMoviesForSearches(aiResponse.searches);

            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                text: aiResponse.message || 'Đây là một số phim phù hợp với bạn:',
                movies,
                suggestions: aiResponse.suggestions || [],
            }]);
        } catch (err) {
            if (err.message === 'GEMINI_API_KEY_MISSING') {
                setApiKeyMissing(true);
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'error',
                    text: '⚠️ Chưa cấu hình Gemini API Key. Vui lòng thêm VITE_GEMINI_API_KEY vào file .env.local rồi restart dev server.',
                }]);
            } else {
                setMessages(prev => [...prev, {
                    id: Date.now() + 1,
                    role: 'error',
                    text: '😅 Có lỗi xảy ra, vui lòng thử lại sau.',
                }]);
            }
        } finally {
            setLoading(false);
        }
    }, [loading, fetchMoviesForSearches]);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input);
        }
    };

    return (
        <>
            {/* Floating trigger button */}
            <button
                className={`${styles.fab} ${open ? styles.fabOpen : ''}`}
                onClick={() => setOpen(v => !v)}
                aria-label="Trợ lý AI chọn phim"
                title="Trợ lý AI chọn phim"
            >
                {open ? <FiX size={22} /> : <FiFilm size={22} />}
                {!open && <span className={styles.fabLabel}>AI</span>}
                {!open && <span className={styles.fabPulse} />}
            </button>

            {/* Chat panel */}
            {open && (
                <div className={styles.panel}>
                    {/* Header */}
                    <div className={styles.panelHeader}>
                        <div className={styles.panelHeaderLeft}>
                            <div className={styles.aiAvatar}>🎬</div>
                            <div>
                                <p className={styles.panelTitle}>Trợ lý phim AI</p>
                                <p className={styles.panelSub}>Được hỗ trợ bởi Gemini</p>
                            </div>
                        </div>
                        <button className={styles.panelClose} onClick={() => setOpen(false)}>
                            <FiChevronDown size={20} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className={styles.messages} ref={chatRef}>
                        {messages.map(msg => (
                            <div key={msg.id} className={`${styles.msgWrapper} ${styles[msg.role]}`}>
                                {(msg.role === 'assistant' || msg.role === 'error') && (
                                    <div className={styles.msgAvatar}>🎬</div>
                                )}
                                <div className={styles.msgBubble}>
                                    <p className={styles.msgText}>{msg.text}</p>

                                    {/* Movie cards */}
                                    {msg.movies?.length > 0 && (
                                        <div className={styles.movieGrid}>
                                            {msg.movies.map(m => (
                                                <MiniMovieCard key={m.slug} movie={m} />
                                            ))}
                                        </div>
                                    )}

                                    {/* Suggestion chips */}
                                    {msg.suggestions?.length > 0 && (
                                        <div className={styles.chips}>
                                            {msg.suggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    className={styles.chip}
                                                    onClick={() => sendMessage(s)}
                                                >
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className={`${styles.msgWrapper} ${styles.assistant}`}>
                                <div className={styles.msgAvatar}>🎬</div>
                                <div className={styles.msgBubble}><TypingDots /></div>
                            </div>
                        )}
                    </div>

                    {/* Input bar */}
                    <div className={styles.inputBar}>
                        <textarea
                            ref={inputRef}
                            className={styles.inputField}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Nhập yêu cầu phim của bạn..."
                            rows={1}
                            disabled={loading || apiKeyMissing}
                        />
                        <button
                            className={styles.sendBtn}
                            onClick={() => sendMessage(input)}
                            disabled={!input.trim() || loading || apiKeyMissing}
                            aria-label="Gửi"
                        >
                            <FiSend size={18} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default AIAssistant;
