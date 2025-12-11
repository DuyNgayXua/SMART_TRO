import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import SideBar from '../../common/adminSidebar';
import './UsersManagement.css';
import '../admin-global.css';

const UsersManagement = () => {
    const { t } = useTranslation();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all'); // all, landlord, tenant
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showViewModal, setShowViewModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userPackages, setUserPackages] = useState({ propertyPackage: null, postPackage: null });
    const [loadingPackages, setLoadingPackages] = useState(false);
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
                `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users?${params}`,
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



    // Handle view user
    const handleViewUser = async (user) => {
        setSelectedUser(user);
        setShowViewModal(true);
        
        // Load user packages
        setLoadingPackages(true);
        try {
            const token = localStorage.getItem('token');
            const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/admin/users/${user._id}/packages`;
            
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.success) {
                    const packages = {
                        propertyPackage: data.data?.propertyPackage || null,
                        postPackage: data.data?.postPackage || null
                    };
                    setUserPackages(packages);
                }
            }
        } catch (error) {
            console.error('Error loading user packages:', error);
        } finally {
            setLoadingPackages(false);
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
                            <div className="search-box-user-management">
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
                                        className="clear-search-btn-user-management"
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
                            className={`status-tab ${roleFilter === 'admin' ? 'active' : ''}`}
                            onClick={() => handleRoleFilterChange('admin')}
                        >
                            <i className="fas fa-user-shield"></i>
                            Quản trị viên ({stats.admin || 0})
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
                                                        className="action-view-btn"
                                                        onClick={() => handleViewUser(user)}
                                                        title="Xem chi tiết"
                                                    >
                                                        <i className="fas fa-eye"></i>
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

            {/* View User Modal */}
            {showViewModal && selectedUser && (
                <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
                    <div className="modal-content user-detail-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-user-management">
                            <h2>
                                <i className="fas fa-user-circle"></i> Thông tin người dùng
                            </h2>
                            <button className="close-modal-btn" onClick={() => setShowViewModal(false)}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>

                        <div className="modal-body">
                            {/* User Info Section */}
                            <div className="user-detail-section">
                                <h3 className="user-section-title">
                                    <i className="fas fa-id-card"></i> Thông tin cá nhân
                                </h3>
                                <div className="user-detail-grid">
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Họ và tên:</span>
                                        <span className="user-detail-value">{selectedUser.fullName}</span>
                                    </div>
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Email:</span>
                                        <span className="user-detail-value">{selectedUser.email}</span>
                                    </div>
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Số điện thoại:</span>
                                        <span className="user-detail-value">{selectedUser.phone || 'Chưa cập nhật'}</span>
                                    </div>
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Vai trò:</span>
                                        <span className="user-detail-value">
                                            <span className={`user-role-badge ${selectedUser.role}`}>
                                                {selectedUser.role === 'admin' && 'Quản trị viên'}
                                                {selectedUser.role === 'landlord' && 'Chủ trọ'}
                                                {(selectedUser.role === 'tenant' || selectedUser.role === 'user') && 'Người dùng'}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Trạng thái:</span>
                                        <span className="user-detail-value">
                                            <span className={`user-status-badge ${selectedUser.status}`}>
                                                {selectedUser.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                                            </span>
                                        </span>
                                    </div>
                                    <div className="user-detail-item">
                                        <span className="user-detail-label">Ngày tạo:</span>
                                        <span className="user-detail-value">{formatDate(selectedUser.createdAt)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Packages Section - Show for all roles */}
                            <div className="user-detail-section">
                                <h3 className="user-section-title">
                                    <i className="fas fa-box"></i> {t('userPackages.title')}
                                </h3>
                                {loadingPackages ? (
                                    <div className="user-loading-section">
                                        <i className="fas fa-spinner fa-spin"></i>
                                        <span>{t('userPackages.loading')}</span>
                                    </div>
                                ) : (
                                    <div className="user-packages-grid">
                                            {/* Property Package (for landlord) */}
                                            {selectedUser.role === 'landlord' && (
                                                <div className="user-package-card">
                                                    <h4>
                                                        <i className="fas fa-building"></i> {t('userPackages.propertyPackage')}
                                                    </h4>
                                                    {userPackages?.propertyPackage ? (
                                                        <div className="user-package-info">
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.packageName')}:</span>
                                                                <span className="user-package-value">{userPackages.propertyPackage.packageName}</span>
                                                            </div>
                                                            {userPackages.propertyPackage.priority && (
                                                                <div className="user-package-detail">
                                                                    <span className="user-package-label">{t('userPackages.priority')}:</span>
                                                                    <span className="user-package-value">
                                                                        {'⭐'.repeat(userPackages.propertyPackage.stars || 0)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.usedPosts')}:</span>
                                                                <span className="user-package-value">{userPackages.propertyPackage.usedPosts || 0} {t('userPackages.posts')}</span>
                                                            </div>
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.totalPushes')}:</span>
                                                                <span className="user-package-value">{userPackages.propertyPackage.totalPushes || 0} {t('userPackages.times')}</span>
                                                            </div>
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.usedPushes')}:</span>
                                                                <span className="user-package-value">{userPackages.propertyPackage.usedPushes || 0} {t('userPackages.times')}</span>
                                                            </div>
                                                            {userPackages.propertyPackage.purchaseDate && (
                                                                <div className="user-package-detail">
                                                                    <span className="user-package-label">{t('userPackages.purchaseDate')}:</span>
                                                                    <span className="user-package-value">
                                                                        {new Date(userPackages.propertyPackage.purchaseDate).toLocaleDateString('vi-VN')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.expiryDate')}:</span>
                                                                <span className={`user-package-value ${new Date(userPackages.propertyPackage.expiryDate) < new Date() ? 'expired' : ''}`}>
                                                                    {new Date(userPackages.propertyPackage.expiryDate).toLocaleDateString('vi-VN')}
                                                                    {new Date(userPackages.propertyPackage.expiryDate) < new Date() && ' ' + t('userPackages.expired')}
                                                                </span>
                                                            </div>
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.status')}:</span>
                                                                <span className={`user-package-status ${userPackages.propertyPackage.status || 'active'}`}>
                                                                    {userPackages.propertyPackage.status === 'active' ? t('userPackages.statusActive') :
                                                                     userPackages.propertyPackage.status === 'expired' ? t('userPackages.statusExpired') :
                                                                     userPackages.propertyPackage.status === 'cancelled' ? t('userPackages.statusCancelled') : 
                                                                     userPackages.propertyPackage.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="user-no-package">
                                                            <i className="fas fa-info-circle"></i>
                                                            <span>{t('userPackages.noPackage')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Post Package (for tenant/user/admin) */}
                                            {(selectedUser.role === 'tenant' || selectedUser.role === 'user' || selectedUser.role === 'admin') && (
                                                <div className="user-package-card">
                                                    <h4>
                                                        <i className="fas fa-newspaper"></i> {t('userPackages.postPackage')}
                                                    </h4>
                                                    {userPackages?.postPackage ? (
                                                        <div className="user-package-info">
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.packageName')}:</span>
                                                                <span className="user-package-value">{userPackages.postPackage.packageName}</span>
                                                            </div>
                                                            {userPackages.postPackage.priority && (
                                                                <div className="user-package-detail">
                                                                    <span className="user-package-label">{t('userPackages.priority')}:</span>
                                                                    <span className="user-package-value">
                                                                        {'⭐'.repeat(userPackages.postPackage.stars || 0)}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.totalPosts')}:</span>
                                                                <span className="user-package-value">{userPackages.postPackage.totalPosts} {t('userPackages.posts')}</span>
                                                            </div>
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.usedPosts')}:</span>
                                                                <span className="user-package-value">{userPackages.postPackage.usedPosts || 0} {t('userPackages.posts')}</span>
                                                            </div>
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.totalPushes')}:</span>
                                                                <span className="user-package-value">{userPackages.postPackage.totalPushes || 0} {t('userPackages.times')}</span>
                                                            </div>
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.usedPushes')}:</span>
                                                                <span className="user-package-value">{userPackages.postPackage.usedPushes || 0} {t('userPackages.times')}</span>
                                                            </div>
                                                            {userPackages.postPackage.purchaseDate && (
                                                                <div className="user-package-detail">
                                                                    <span className="user-package-label">{t('userPackages.purchaseDate')}:</span>
                                                                    <span className="user-package-value">
                                                                        {new Date(userPackages.postPackage.purchaseDate).toLocaleDateString('vi-VN')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.expiryDate')}:</span>
                                                                <span className={`user-package-value ${new Date(userPackages.postPackage.expiryDate) < new Date() ? 'expired' : ''}`}>
                                                                    {new Date(userPackages.postPackage.expiryDate).toLocaleDateString('vi-VN')}
                                                                    {new Date(userPackages.postPackage.expiryDate) < new Date() && ' ' + t('userPackages.expired')}
                                                                </span>
                                                            </div>
                                                            <div className="user-package-detail">
                                                                <span className="user-package-label">{t('userPackages.status')}:</span>
                                                                <span className={`user-package-status ${userPackages.postPackage.status || 'active'}`}>
                                                                    {userPackages.postPackage.status === 'active' ? t('userPackages.statusActive') :
                                                                     userPackages.postPackage.status === 'expired' ? t('userPackages.statusExpired') :
                                                                     userPackages.postPackage.status === 'cancelled' ? t('userPackages.statusCancelled') : 
                                                                     userPackages.postPackage.status}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="user-no-package">
                                                            <i className="fas fa-info-circle"></i>
                                                            <span>{t('userPackages.noPackage')}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                        <div className="modal-footer">
                            <button className="btn-secondary-user-management" onClick={() => setShowViewModal(false)}>
                                <i className="fas fa-times"></i> Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersManagement;
