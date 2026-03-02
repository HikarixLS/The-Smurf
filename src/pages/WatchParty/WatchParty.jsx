import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMonitor, FiPlus, FiUsers, FiPlay, FiTrash2, FiAlertCircle, FiSearch, FiX } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import { watchPartyService } from '@/services/firebase/watchPartyService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import { movieService } from '@/services/api/movieService';
import { getImageUrl } from '@/utils/helpers';
import styles from './WatchParty.module.css';

const WatchParty = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const session = watchPartyService.getSession();
    const firebaseOk = isFirebaseConfigured();

    // Movie search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedMovie, setSelectedMovie] = useState(null);
    const searchTimeoutRef = useRef(null);

    useEffect(() => {
        if (!firebaseOk) {
            setLoading(false);
            return;
        }

        const unsubscribe = watchPartyService.onRoomsUpdate((updatedRooms) => {
            setRooms(updatedRooms);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [firebaseOk]);

    // Debounced movie search
    const handleSearchChange = useCallback((value) => {
        setSearchQuery(value);
        setSelectedMovie(null);

        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!value.trim() || value.trim().length < 2) {
            setSearchResults([]);
            setSearching(false);
            return;
        }

        setSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            try {
                const res = await movieService.searchMovies(value.trim(), 1, 10);
                if (res?.data?.items) {
                    setSearchResults(res.data.items);
                } else {
                    setSearchResults([]);
                }
            } catch (e) {
                console.error('Search error:', e);
                setSearchResults([]);
            } finally {
                setSearching(false);
            }
        }, 400);
    }, []);

    const handleSelectMovie = (movie) => {
        setSelectedMovie(movie);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleCreate = async () => {
        if (!selectedMovie) return;
        setCreating(true);
        try {
            const thumbUrl = getImageUrl(selectedMovie.thumb_url || selectedMovie.poster_url);
            const room = await watchPartyService.createRoom({
                movieSlug: selectedMovie.slug,
                movieName: selectedMovie.name,
                movieThumb: thumbUrl,
                movieOriginName: selectedMovie.origin_name || '',
                movieYear: selectedMovie.year || '',
                movieQuality: selectedMovie.quality || '',
            });
            navigate(`/watch-party/room/${room.id}`);
        } catch (err) {
            console.error('Create room error:', err);
            alert('Không thể tạo phòng: ' + err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleJoin = (roomId) => {
        navigate(`/watch-party/room/${roomId}`);
    };

    const handleDelete = async (roomId, e) => {
        e.stopPropagation();
        if (confirm('Bạn có chắc muốn xóa phòng này?')) {
            await watchPartyService.deleteRoom(roomId);
        }
    };

    const timeSince = (ts) => {
        const mins = Math.floor((Date.now() - ts) / 60000);
        if (mins < 1) return 'Vừa xong';
        if (mins < 60) return `${mins} phút trước`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} giờ trước`;
        return `${Math.floor(hours / 24)} ngày trước`;
    };

    return (
        <>
            <Header />
            <main className={styles.watchParty}>
                <div className={styles.container}>
                    <div className={styles.header}>
                        <div>
                            <h1 className={styles.title}>
                                <FiMonitor /> Xem Chung
                            </h1>
                            <p className={styles.subtitle}>
                                Tạo phòng hoặc tham gia phòng xem phim cùng bạn bè
                            </p>
                            <p className={styles.identity}>
                                Bạn là: <strong>{session.name}</strong>
                            </p>
                        </div>
                        <button
                            className={styles.createBtn}
                            onClick={() => {
                                setShowCreate(!showCreate);
                                setSelectedMovie(null);
                                setSearchQuery('');
                                setSearchResults([]);
                            }}
                            disabled={!firebaseOk}
                        >
                            <FiPlus /> Tạo phòng
                        </button>
                    </div>

                    {/* Firebase not configured warning */}
                    {!firebaseOk && (
                        <div className={styles.warning}>
                            <FiAlertCircle size={24} />
                            <div>
                                <strong>Firebase chưa được cấu hình</strong>
                                <p>Vui lòng thêm Firebase credentials vào file <code>.env</code> để sử dụng tính năng Xem Chung. Xem hướng dẫn trong file <code>.env.example</code>.</p>
                            </div>
                        </div>
                    )}

                    {/* Create room panel with movie search */}
                    {showCreate && firebaseOk && (
                        <div className={styles.createPanel}>
                            <h3>Tạo phòng xem chung</h3>

                            {/* Movie search input */}
                            <div className={styles.formGroup}>
                                <label>Tìm phim để xem chung</label>
                                <div className={styles.searchWrapper}>
                                    <FiSearch className={styles.searchIcon} />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => handleSearchChange(e.target.value)}
                                        placeholder="Nhập tên phim để tìm kiếm..."
                                        className={styles.input}
                                        autoFocus
                                    />
                                    {searchQuery && (
                                        <button
                                            className={styles.clearSearch}
                                            onClick={() => {
                                                setSearchQuery('');
                                                setSearchResults([]);
                                            }}
                                        >
                                            <FiX />
                                        </button>
                                    )}
                                </div>

                                {/* Search results dropdown */}
                                {(searchResults.length > 0 || searching) && (
                                    <div className={styles.searchDropdown}>
                                        {searching ? (
                                            <div className={styles.searchLoading}>
                                                <div className={styles.miniSpinner} />
                                                Đang tìm kiếm...
                                            </div>
                                        ) : (
                                            searchResults.map(movie => (
                                                <div
                                                    key={movie.slug}
                                                    className={styles.searchItem}
                                                    onClick={() => handleSelectMovie(movie)}
                                                >
                                                    <img
                                                        src={getImageUrl(movie.thumb_url || movie.poster_url)}
                                                        alt={movie.name}
                                                        className={styles.searchThumb}
                                                        onError={e => { e.target.style.display = 'none'; }}
                                                    />
                                                    <div className={styles.searchItemInfo}>
                                                        <span className={styles.searchItemName}>{movie.name}</span>
                                                        <span className={styles.searchItemMeta}>
                                                            {movie.origin_name && <em>{movie.origin_name}</em>}
                                                            {movie.year && ` • ${movie.year}`}
                                                            {movie.quality && ` • ${movie.quality}`}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        {!searching && searchResults.length === 0 && searchQuery.length >= 2 && (
                                            <div className={styles.searchLoading}>Không tìm thấy phim</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Selected movie preview */}
                            {selectedMovie && (
                                <div className={styles.selectedMovie}>
                                    <img
                                        src={getImageUrl(selectedMovie.thumb_url || selectedMovie.poster_url)}
                                        alt={selectedMovie.name}
                                        className={styles.selectedThumb}
                                        onError={e => { e.target.style.display = 'none'; }}
                                    />
                                    <div className={styles.selectedInfo}>
                                        <h4>{selectedMovie.name}</h4>
                                        {selectedMovie.origin_name && (
                                            <p className={styles.selectedOrigin}>{selectedMovie.origin_name}</p>
                                        )}
                                        <div className={styles.selectedMeta}>
                                            {selectedMovie.year && <span>{selectedMovie.year}</span>}
                                            {selectedMovie.quality && <span className={styles.qualityTag}>{selectedMovie.quality}</span>}
                                            {selectedMovie.lang && <span className={styles.langTag}>{selectedMovie.lang}</span>}
                                            {selectedMovie.episode_current && <span>{selectedMovie.episode_current}</span>}
                                        </div>
                                    </div>
                                    <button
                                        className={styles.removeSelected}
                                        onClick={() => setSelectedMovie(null)}
                                    >
                                        <FiX />
                                    </button>
                                </div>
                            )}

                            <div className={styles.formActions}>
                                <button
                                    className={styles.submitBtn}
                                    onClick={handleCreate}
                                    disabled={creating || !selectedMovie}
                                >
                                    {creating ? 'Đang tạo...' : '🎬 Tạo phòng xem chung'}
                                </button>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setShowCreate(false)}
                                >
                                    Hủy
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Rooms list */}
                    {loading ? (
                        <div className={styles.loadingState}>
                            <div className={styles.spinner} />
                            <p>Đang tải danh sách phòng...</p>
                        </div>
                    ) : rooms.length === 0 ? (
                        <div className={styles.emptyState}>
                            <FiMonitor size={48} />
                            <h2>Chưa có phòng nào</h2>
                            <p>Hãy tạo phòng đầu tiên để bắt đầu xem phim cùng bạn bè!</p>
                        </div>
                    ) : (
                        <div className={styles.roomsGrid}>
                            {rooms.map(room => (
                                <div
                                    key={room.id}
                                    className={styles.roomCard}
                                    onClick={() => handleJoin(room.id)}
                                >
                                    <div className={styles.roomThumbnail}>
                                        <img
                                            src={room.movieThumb}
                                            alt={room.movieName}
                                            onError={(e) => { e.target.style.display = 'none'; }}
                                        />
                                        <div className={styles.roomOverlay}>
                                            <button className={styles.joinBtn}>
                                                <FiPlay /> Tham gia
                                            </button>
                                        </div>
                                        <span className={`${styles.statusBadge} ${styles[room.status]}`}>
                                            {room.status === 'playing' ? '🔴 LIVE' : room.status === 'paused' ? '⏸ Paused' : '⏳ Chờ'}
                                        </span>
                                    </div>
                                    <div className={styles.roomInfo}>
                                        <h3 className={styles.roomTitle}>{room.movieName}</h3>
                                        <div className={styles.roomMeta}>
                                            <span className={styles.host}>
                                                {room.hostName} • {timeSince(room.createdAt)}
                                            </span>
                                            <div className={styles.roomRight}>
                                                <span className={styles.viewers}>
                                                    <FiUsers size={12} /> {room.members ? Object.keys(room.members).length : 0}
                                                </span>
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={(e) => handleDelete(room.id, e)}
                                                    title="Xóa phòng"
                                                >
                                                    <FiTrash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            <Footer />
        </>
    );
};

export default WatchParty;
