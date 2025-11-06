import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import SideBar from '../../common/adminSidebar';
import './UsersManagement.css';
import '../admin-global.css';

const UsersManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all'); // all, landlord, tenant
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [stats, setStats] = useState({
        total: 0,
        landlord: 0,
        user: 0,
        admin: 0,
        active: 0,
        blocked: 0
    });

    // Load users from API
    const loadUsers = async (page = 1, role = roleFilter, search = searchTerm) => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            const params = new URLSearchParams({
                page,
                limit: 20,
                ...(role !== 'all' && { role }),
                ...(search && { search })
            });

            const response = await fetch(
                `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/admin/users?${params}`,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to load users');
            }

            const data = await response.json();
            if (data.success) {
                setUsers(data.data.users);
                setCurrentPage(data.data.pagination.currentPage);
                setTotalPages(data.data.pagination.totalPages);
                setStats(data.data.stats);
            }
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Lỗi khi tải danh sách người dùng');
        } finally {
            setLoading(false);
        }
    };

    // Handle block/unblock user
    const handleToggleBlock = async (userId, currentStatus) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(
                `${process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api'}/admin/users/${userId}/toggle-block`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!response.ok) {
                throw new Error('Failed to toggle block status');
            }

            const data = await response.json();
            if (data.success) {
                toast.success(currentStatus === 'active' ? 'Đã khóa người dùng' : 'Đã mở khóa người dùng');
                // Reload users list
                loadUsers(currentPage, roleFilter, searchTerm);
            }
        } catch (error) {
            console.error('Error toggling block status:', error);
            toast.error('Lỗi khi thay đổi trạng thái người dùng');
        }
    };

    // Handle search
    const handleSearch = (e) => {
        e.preventDefault();
        setCurrentPage(1);
        loadUsers(1, roleFilter, searchTerm);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    // Handle filter change
    const handleRoleFilterChange = (role) => {
        setRoleFilter(role);
        setCurrentPage(1);
        loadUsers(1, role, searchTerm);
    };

    // Load users on mount
    useEffect(() => {
        loadUsers();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('vi-VN');
    };

    // Get role label
    const getRoleLabel = (role) => {
        const labels = {
            admin: 'Quản trị viên',
            landlord: 'Chủ trọ',
            tenant: 'Người dùng',
            user: 'Người dùng' // Alias for backward compatibility
        };
        return labels[role] || role;
    };

    // Get role color
    const getRoleColor = (role) => {
        const colors = {
            admin: '#dc3545',
            landlord: '#28a745',
            tenant: '#007bff',
            user: '#007bff' // Alias for backward compatibility
        };
        return colors[role] || '#6c757d';
    };

    return (
        <div className="dashboard-container">
            <SideBar />
            <div className="dashboard-content">
                <div className="users-management">
                    {/* Header Section */}
                    <div className="rooms-header">
                        <h1 className="rooms-title">Quản lý người dùng</h1>
                        <div className="header-search">
                            <div className="search-box">
                                <i className="fas fa-search search-icon"></i>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Tìm kiếm theo tên, email, số điện thoại..."
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleSearch(e);
                                        }
                                    }}
                                />
                                {searchTerm && (
                                    <button
                                        className="clear-search-btn"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setCurrentPage(1);
                                            loadUsers(1, roleFilter, '');
                                        }}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Role Tabs */}
                    <div className="status-tabs">
                        <button
                            className={`status-tab ${roleFilter === 'all' ? 'active' : ''}`}
                            onClick={() => handleRoleFilterChange('all')}
                        >
                            <i className="fas fa-list"></i>
                            Tất cả ({stats.total})
                        </button>
                        <button
                            className={`status-tab ${roleFilter === 'landlord' ? 'active' : ''}`}
                            onClick={() => handleRoleFilterChange('landlord')}
                        >
                            <i className="fas fa-user"></i>
                            Chủ trọ ({stats.landlord})
                        </button>
                        <button
                            className={`status-tab ${roleFilter === 'tenant' ? 'active' : ''}`}
                            onClick={() => handleRoleFilterChange('tenant')}
                        >
                            <i className="fas fa-users"></i>
                            Người dùng ({stats.user || 0})
                        </button>
                    </div>

                    {/* Users Table */}
                    {loading ? (
                        <div className="spinner-container">
                            <div className="spinner"></div>
                            <span className="loading-text">Đang tải danh sách người dùng...</span>
                        </div>
                    ) : users.length === 0 ? (
                        <div className="empty-state">
                            <i className="fas fa-users"></i>
                            <p>Không có người dùng nào</p>
                        </div>
                    ) : (
                        <>
                            <div className="users-table-container">
                                <table className="users-table">
                                    <thead>
                                        <tr>
                                            <th>Avatar</th>
                                            <th>Họ tên</th>
                                            <th>Email</th>
                                            <th>Số điện thoại</th>
                                            <th>Vai trò</th>
                                            <th>Trạng thái</th>
                                            <th>Ngày tạo</th>
                                            <th>Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {users.map((user) => (
                                            <tr key={user._id}>
                                                <td>
                                                    <div className="user-avatar">
                                                        {user.avatar ? (
                                                            <img src={user.avatar} alt={user.fullName} />
                                                        ) : (
                                                            <div className="avatar-placeholder">
                                                                {user.fullName?.charAt(0).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="user-name">{user.fullName}</div>
                                                </td>
                                                <td>
                                                    <div className="user-email">{user.email}</div>
                                                </td>
                                                <td>
                                                    <div className="user-phone">{user.phoneNumber || 'N/A'}</div>
                                                </td>
                                                <td>
                                                    <span 
                                                        className="role-badge" 
                                                        style={{ backgroundColor: getRoleColor(user.role) }}
                                                    >
                                                        {getRoleLabel(user.role)}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className={`status-badge ${user.status}`}>
                                                        {user.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                                                    </span>
                                                </td>
                                                <td>{formatDate(user.createdAt)}</td>
                                                <td>
                                                    <button
                                                        className={`btn-action ${user.status === 'active' ? 'btn-block' : 'btn-unblock'}`}
                                                        onClick={() => handleToggleBlock(user._id, user.status)}
                                                        title={user.status === 'active' ? 'Khóa người dùng' : 'Mở khóa người dùng'}
                                                    >
                                                        <i className={`fas ${user.status === 'active' ? 'fa-ban' : 'fa-unlock'}`}></i>
                                                        {user.status === 'active' ? 'Khóa' : 'Mở khóa'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="pagination">
                                    <button
                                        className="pagination-btn"
                                        onClick={() => loadUsers(currentPage - 1, roleFilter, searchTerm)}
                                        disabled={currentPage === 1}
                                    >
                                        <i className="fas fa-chevron-left"></i>
                                    </button>
                                    <span className="pagination-info">
                                        Trang {currentPage} / {totalPages}
                                    </span>
                                    <button
                                        className="pagination-btn"
                                        onClick={() => loadUsers(currentPage + 1, roleFilter, searchTerm)}
                                        disabled={currentPage === totalPages}
                                    >
                                        <i className="fas fa-chevron-right"></i>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UsersManagement;
