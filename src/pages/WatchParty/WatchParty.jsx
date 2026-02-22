import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiMonitor, FiPlus, FiUsers, FiPlay, FiTrash2, FiAlertCircle } from 'react-icons/fi';
import Header from '@/components/layout/Header/Header';
import Footer from '@/components/layout/Footer/Footer';
import { watchPartyService } from '@/services/firebase/watchPartyService';
import { isFirebaseConfigured } from '@/services/firebase/config';
import styles from './WatchParty.module.css';

const WatchParty = () => {
    const navigate = useNavigate();
    const [rooms, setRooms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [movieSlug, setMovieSlug] = useState('');
    const [movieName, setMovieName] = useState('');
    const [creating, setCreating] = useState(false);
    const session = watchPartyService.getSession();
    const firebaseOk = isFirebaseConfigured();

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

    const handleCreate = async () => {
        if (!movieSlug.trim() || !movieName.trim()) return;
        setCreating(true);
        try {
            const room = await watchPartyService.createRoom({
                movieSlug: movieSlug.trim(),
                movieName: movieName.trim(),
                movieThumb: `https://img.ophim.live/uploads/movies/${movieSlug.trim()}-thumb.jpg`,
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
                            onClick={() => setShowCreate(!showCreate)}
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

                    {/* Create room modal */}
                    {showCreate && firebaseOk && (
                        <div className={styles.createPanel}>
                            <h3>Tạo phòng xem chung</h3>
                            <div className={styles.formGroup}>
                                <label>Slug phim (VD: dam-lay-muoi)</label>
                                <input
                                    type="text"
                                    value={movieSlug}
                                    onChange={e => setMovieSlug(e.target.value)}
                                    placeholder="dam-lay-muoi"
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label>Tên phim</label>
                                <input
                                    type="text"
                                    value={movieName}
                                    onChange={e => setMovieName(e.target.value)}
                                    placeholder="Đầm Lầy Muối"
                                    className={styles.input}
                                />
                            </div>
                            <div className={styles.formActions}>
                                <button
                                    className={styles.submitBtn}
                                    onClick={handleCreate}
                                    disabled={creating || !movieSlug.trim() || !movieName.trim()}
                                >
                                    {creating ? 'Đang tạo...' : 'Tạo phòng'}
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
                                            onError={(e) => { e.target.src = 'https://via.placeholder.com/400x225/1a1a1a/666?text=No+Image'; }}
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
                                                {room.hostId === session.id && (
                                                    <button
                                                        className={styles.deleteBtn}
                                                        onClick={(e) => handleDelete(room.id, e)}
                                                        title="Xóa phòng"
                                                    >
                                                        <FiTrash2 size={14} />
                                                    </button>
                                                )}
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
