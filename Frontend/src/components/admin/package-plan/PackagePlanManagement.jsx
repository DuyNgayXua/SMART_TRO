import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import SideBar from '../../common/adminSidebar';
import adminPackagePlanAPI from '../../../services/adminPackagePlanAPI';
import './PackagePlanManagement.css';
import '../admin-global.css';

const PackagePlanManagement = () => {
    // States
    const [packagePlans, setPackagePlans] = useState([]);
    const [filteredPackagePlans, setFilteredPackagePlans] = useState([]);
    const [propertiesPackages, setPropertiesPackages] = useState([]); // Danh sách loại tin
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'inactive'
    const [typeFilter, setTypeFilter] = useState('all'); // 'all', 'basic', 'vip', 'premium'
    const [isSearched, setIsSearched] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(12);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalType, setModalType] = useState('create'); // 'create', 'edit', 'delete'
    const [selectedPackagePlan, setSelectedPackagePlan] = useState(null);
    const [formData, setFormData] = useState({
        type: 'custom', // Loại gói: basic, vip, premium, custom
        displayName: '',
        description: '',
        price: '0',
        duration: 1,
        durationUnit: 'month',
        freePushCount: 0,
        propertiesLimits: [], // Array of {packageType: ObjectId, limit: Number}
        isActive: true
    });

    // Package type options
    const packageTypeOptions = [
        { value: 'basic', label: 'GÓI CƠ BẢN', color: '#28a745' },
        { value: 'vip', label: 'GÓI VIP', color: '#ffc107' },
        { value: 'premium', label: 'GÓI PREMIUM', color: '#dc3545' },
        { value: 'custom', label: 'TÙY CHỈNH', color: '#4385ffff' },
        { value: 'trial', label: 'GÓI DÙNG THỬ', color: '#141414ff' }
    ];

    // Duration unit options
    const durationUnitOptions = [
        { value: 'day', label: 'Ngày' },
        { value: 'month', label: 'Tháng' },
        { value: 'year', label: 'Năm' }
    ];

    // Post type labels
    const postTypeLabels = {
        tin_thuong: 'Tin thường',
        tin_vip_1: 'Tin VIP 1',
        tin_vip_2: 'Tin VIP 2',
        tin_vip_3: 'Tin VIP 3',
        tin_vip_noi_bat: 'Tin VIP nổi bật',
        tin_vip_dac_biet: 'Tin VIP đặc biệt'
    };

    // Load data on component mount
    useEffect(() => {
        fetchPackagePlans();
        fetchPropertiesPackages();

        // Cleanup on unmount
        return () => {
            document.body.classList.remove('modal-open-blur');
        };
    }, []);

    // Filter data when filters change (not search term)
    useEffect(() => {
        filterPackagePlans();
    }, [statusFilter, typeFilter, packagePlans]);

    // Fetch all package plans
    const fetchPackagePlans = async () => {
        try {
            setLoading(true);
            const response = await adminPackagePlanAPI.getPackagePlans();
            console.log('Fetched package plans:', response);

            if (response.success) {
                setPackagePlans(response.data || []);
            } else {
                toast.error(response.message || 'Lỗi khi tải danh sách gói tin');
            }
        } catch (error) {
            console.error('Error fetching package plans:', error);

            // Xử lý error từ backend
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(error.response.data.message);
            } else if (error.message) {
                toast.error(error.message);
            } else {
                toast.error('Lỗi khi tải danh sách gói tin');
            }
            setPackagePlans([]);
        } finally {
            setLoading(false);
        }
    };

    // Fetch properties packages for form
    const fetchPropertiesPackages = async () => {
        try {
            const response = await adminPackagePlanAPI.getPropertiesPackages();
           
            if (response.success) {
                setPropertiesPackages(response.data || []);
            }
        } catch (error) {
            console.error('Error fetching properties packages:', error);

            // Xử lý error từ backend
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(error.response.data.message);
            } else if (error.message) {
                toast.error(error.message);
            } else {
                toast.error('Lỗi khi tải danh sách loại tin');
            }
        }
    };

    // Filter package plans based on search term and filters
    const filterPackagePlans = (customSearchTerm = null, customStatusFilter = null, customTypeFilter = null) => {
        let filtered = [...packagePlans];

        // Use custom parameters or current state
        const currentSearchTerm = customSearchTerm !== null ? customSearchTerm : searchTerm;
        const currentStatusFilter = customStatusFilter !== null ? customStatusFilter : statusFilter;
        const currentTypeFilter = customTypeFilter !== null ? customTypeFilter : typeFilter;

        // Search filter
        if (currentSearchTerm) {
            filtered = filtered.filter(plan =>
                plan.displayName?.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
                plan.name?.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
                plan.description?.toLowerCase().includes(currentSearchTerm.toLowerCase())
            );
            setIsSearched(true);
        } else {
            setIsSearched(false);
        }

        // Status filter
        if (currentStatusFilter === 'active') {
            filtered = filtered.filter(plan => plan.isActive === true);
        } else if (currentStatusFilter === 'inactive') {
            filtered = filtered.filter(plan => plan.isActive === false);
        }

        // Type filter
        if (currentTypeFilter !== 'all') {
            filtered = filtered.filter(plan => plan.type === currentTypeFilter);
        }

        setFilteredPackagePlans(filtered);
        setCurrentPage(1); // Reset to first page when filtering
    };

    // Handle search
    const handleSearch = (e) => {
        e.preventDefault();
        filterPackagePlans();
    };

    // Handle Enter key press in search input
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            filterPackagePlans();
        }
    };

    // Clear search
    const clearSearch = () => {
        setSearchTerm('');
        setStatusFilter('all');
        setTypeFilter('all');
        // Gọi filterPackagePlans với các giá trị clear để cập nhật ngay lập tức
        filterPackagePlans('', 'all', 'all');
    };

    // Pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredPackagePlans.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredPackagePlans.length / itemsPerPage);

    // Format duration display
    const formatDuration = (packagePlan) => {
        // Sử dụng duration/durationUnit nếu có
        if (packagePlan.duration && packagePlan.durationUnit) {
            const unitLabels = {
                'day': 'ngày',
                'month': 'tháng',
                'year': 'năm'
            };
            return `${packagePlan.duration} ${unitLabels[packagePlan.durationUnit]}`;
        } else if (packagePlan.durationDays) {
            // Backward compatibility: use durationDays
            return `${packagePlan.durationDays} ngày`;
        } else {
            return '1 tháng'; // default fallback
        }
    };

    // Format number for form input (always show number, even 0)
    const formatNumberForInput = (num) => {
        if (num === 0 || num === '0') return '0';
        if (num === '' || num === null || num === undefined) return '';
        return parseInt(num, 10).toLocaleString('vi-VN');
    };


    // Handle form input changes
    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'price') {
            // Xử lý trường hợp đặc biệt khi nhập giá
            let numericValue = value.replace(/[^\d]/g, '');

            // Nếu người dùng nhập "0" hoặc giá trị đang là 0 thì vẫn giữ lại "0"
            if (numericValue === '' && value === '0') {
                numericValue = '0';
            }

            setFormData(prev => ({
                ...prev,
                [name]: numericValue === '' ? '' : parseInt(numericValue, 10)
            }));
        } else if (name === 'type') {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked :
                    type === 'number' ? (value === '' ? '' : parseFloat(value)) :
                        value
            }));
        }
    };


    // Handle propertiesLimits changes
    const handlePropertiesLimitChange = (packageTypeId, limit) => {
        setFormData(prev => {
            const newPropertiesLimits = [...prev.propertiesLimits];
            const existingIndex = newPropertiesLimits.findIndex(item => item.packageType === packageTypeId);

            if (existingIndex >= 0) {
                if (limit > 0) {
                    newPropertiesLimits[existingIndex].limit = limit;
                } else {
                    newPropertiesLimits.splice(existingIndex, 1);
                }
            } else if (limit > 0) {
                newPropertiesLimits.push({ packageType: packageTypeId, limit: limit });
            }

            return {
                ...prev,
                propertiesLimits: newPropertiesLimits
            };
        });
    };



    // Initialize default packages
    const handleInitializeDefault = async () => {
        try {
            setLoading(true);
            const response = await adminPackagePlanAPI.initializeDefaultPackages();

            if (response.success) {
                toast.success('Khởi tạo gói tin mặc định thành công!');
                await fetchPackagePlans(); // Reload data
            } else {
                toast.error(response.message || 'Lỗi khi khởi tạo gói tin mặc định');
            }
        } catch (error) {
            console.error('Error initializing default packages:', error);
            toast.error('Lỗi khi khởi tạo gói tin mặc định');
        } finally {
            setLoading(false);
        }
    };

    // Open modal
    const openModal = (type, packagePlan = null) => {
        setModalType(type);
        setSelectedPackagePlan(packagePlan);

        if (type === 'edit' && packagePlan) {
            // Convert propertiesLimits từ format backend về format phù hợp với form
            const convertedPropertiesLimits = (packagePlan.propertiesLimits || []).map(limit => {
                return {
                    packageType: limit.packageType?._id || limit.packageType, // Lấy _id nếu đã populate, hoặc giữ nguyên nếu là ObjectId
                    limit: limit.limit
                };
            });

            setFormData({
                type: packagePlan.type || 'custom',
                displayName: packagePlan.displayName || '',
                description: packagePlan.description || '',
                price: packagePlan.price !== undefined && packagePlan.price !== null ? packagePlan.price : '',
                duration: packagePlan.duration || (packagePlan.durationDays ? packagePlan.durationDays : 1),
                durationUnit: packagePlan.durationUnit || (packagePlan.durationDays ? 'day' : 'month'),
                freePushCount: packagePlan.freePushCount || 0,
                propertiesLimits: convertedPropertiesLimits,
                isActive: packagePlan.isActive !== false
            });
        } else if (type === 'create') {
            setFormData({
                type: 'custom',
                displayName: '',
                description: '',
                price: '0',
                duration: 1,
                durationUnit: 'month',
                freePushCount: 0,
                propertiesLimits: [],
                isActive: true
            });
        }

        setShowModal(true);
        // Add blur effect to body
        document.body.classList.add('modal-open-blur');
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setSelectedPackagePlan(null);
        setModalType('create');
        // Remove blur effect
        document.body.classList.remove('modal-open-blur');
    };

    // Submit form
    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Validate form
            if (!formData.displayName || !formData.displayName.trim()) {
                toast.error('Tên hiển thị không được rỗng');
                return;
            }

            // Validate displayName không chứa ký tự đặc biệt
            const specialCharsRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/;
            if (specialCharsRegex.test(formData.displayName)) {
                toast.error('Tên hiển thị không được chứa ký tự đặc biệt');
                return;
            }

            if (!formData.description || !formData.description.trim()) {
                toast.error('Mô tả không được rỗng');
                return;
            }

            if ((formData.price === '' || formData.price === null || formData.price === undefined) && formData.price !== '0') {
                toast.error('Giá không được để trống');
                return;
            }

            if (Number(formData.price) < 0) {
                toast.error('Giá phải lớn hơn hoặc bằng 0');
                return;
            }

            if (formData.freePushCount < 0) {
                toast.error('Lượt đẩy tin phải lớn hơn hoặc bằng 0');
                return;
            }

            // Validate duration cho tất cả các gói
            if (!formData.duration || formData.duration === '' || Number(formData.duration) <= 0) {
                toast.error('Thời hạn phải lớn hơn 0');
                return;
            }

            const submitData = {
                ...formData,
                price: parseFloat(formData.price),
                freePushCount: parseInt(formData.freePushCount),
                isActive: Boolean(formData.isActive) // Đảm bảo isActive là boolean
            };

            // Tất cả các gói đều phải có duration và durationUnit
            submitData.duration = parseInt(formData.duration);

            // Xử lý type và name field
            if (modalType === 'create') {
                // Khi tạo mới: luôn gửi type, không gửi name để backend tự tạo
                // Backend sẽ tự tạo unique name
            } else if (modalType === 'edit') {
                // Khi edit: vẫn gửi type để backend validation hoạt động đúng
                // Chỉ không gửi name để tránh conflict
                // submitData.type vẫn giữ nguyên
            }
            console.log(`submitData`, submitData);

            let response;
            if (modalType === 'create') {
                response = await adminPackagePlanAPI.createPackagePlan(submitData);
            } else if (modalType === 'edit') {
                response = await adminPackagePlanAPI.updatePackagePlan(selectedPackagePlan._id, submitData);
            }

            if (response.success) {
                toast.success(
                    modalType === 'create'
                        ? 'Tạo gói tin thành công!'
                        : 'Cập nhật gói tin thành công!'
                );
                closeModal();
                fetchPackagePlans();
            } else {
                toast.error(response.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            console.error('Error submitting form:', error);

            // Xử lý error từ backend
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(error.response.data.message);
            } else if (error.message) {
                toast.error(error.message);
            } else {
                toast.error('Có lỗi xảy ra khi lưu gói tin');
            }
        }
    };

    // Handle delete
    const handleDelete = async () => {
        try {
            if (!selectedPackagePlan) return;

            const response = await adminPackagePlanAPI.deletePackagePlan(selectedPackagePlan._id);

            if (response.success) {
                toast.success('Xóa gói tin thành công!');
                closeModal();
                fetchPackagePlans();
            } else {
                toast.error(response.message || 'Có lỗi xảy ra khi xóa');
            }
        } catch (error) {
            console.error('Error deleting package plan:', error);

            // Xử lý error từ backend
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(error.response.data.message);
            } else if (error.message) {
                toast.error(error.message);
            } else {
                toast.error('Có lỗi xảy ra khi xóa gói tin');
            }
        }
    };

    // Toggle status
    const toggleStatus = async (id, currentStatus) => {
        try {
            const response = await adminPackagePlanAPI.togglePackagePlanStatus(id, !currentStatus);

            if (response.success) {
                toast.success('Thay đổi trạng thái thành công!');
                fetchPackagePlans();
            } else {
                toast.error(response.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            console.error('Error toggling status:', error);

            // Xử lý error từ backend
            if (error.response && error.response.data && error.response.data.message) {
                toast.error(error.response.data.message);
            } else if (error.message) {
                toast.error(error.message);
            } else {
                toast.error('Có lỗi xảy ra khi thay đổi trạng thái');
            }
        }
    };

    // Format price
    const formatPrice = (price) => {
        if (price === 0) {
            return 'Miễn phí';
        }
        return new Intl.NumberFormat('vi-VN').format(price) + ' VNĐ';
    };

    // Get package type info
    const getPackageTypeInfo = (type) => {
        return packageTypeOptions.find(option => option.value === type) ||
            { label: type?.toUpperCase(), color: '#1c6cffff' };
    };

    // Get post type class and color from displayName
    const getPostTypeClass = (displayName) => {
        const name = displayName?.toUpperCase() || '';

        if (name.includes('TIN VIP ĐẶC BIỆT')) return 'tin-vip-dac-biet';
        if (name.includes('TIN VIP NỔI BẬT')) return 'tin-vip-noi-bat';
        if (name.includes('TIN VIP 3')) return 'tin-vip-3';
        if (name.includes('TIN VIP 2')) return 'tin-vip-2';
        if (name.includes('TIN VIP 1')) return 'tin-vip-1';
        if (name.includes('TIN THƯỜNG')) return 'tin-thuong';

        return 'tin-thuong'; // default
    };



    return (
        <div className="dashboard-container">
            <SideBar />
            <div className="dashboard-content">
                <div className="packages-management-container">
                    {/* Header Section */}
                    <div className="rooms-header">
                        <h1 className="rooms-title">Quản lý gói tin đăng</h1>
                        <div className="header-search">
                            <div className="search-box-properties-packages-plan">
                                <i className="fas fa-search search-icon"></i>
                                <input
                                    type="text"
                                    className="search-input"
                                    placeholder="Tìm kiếm theo tên gói, mô tả..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                />
                                {searchTerm && (
                                    <button
                                        className="clear-search-btn-properties-packages-plan"
                                        onClick={() => {
                                            setSearchTerm('');
                                            setIsSearched(false);
                                            filterPackagePlans();
                                        }}
                                    >
                                        <i className="fas fa-times"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status Tabs */}
                    <div className="status-tabs">
                        <button
                            className={`status-tab ${statusFilter === 'all' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('all')}
                        >
                            <i className="fas fa-list"></i>
                            Tất cả
                        </button>
                        <button
                            className={`status-tab ${statusFilter === 'active' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('active')}
                        >
                            <i className="fas fa-check-circle"></i>
                            Đang hoạt động
                        </button>
                        <button
                            className={`status-tab ${statusFilter === 'inactive' ? 'active' : ''}`}
                            onClick={() => setStatusFilter('inactive')}
                        >
                            <i className="fas fa-times-circle"></i>
                            Ngừng hoạt động
                        </button>
                    </div>

                    {/* Action Buttons and Type Filter */}
                    <div className="package-actions-bar">
                        <button
                            className="btn-add-package btn-primary"
                            onClick={() => openModal('create')}
                        >
                            <i className="fas fa-plus"></i>
                            Thêm gói tin mới
                        </button>

                        {packagePlans.length === 0 && (
                            <button
                                className="btn-initialize-default btn-success"
                                onClick={handleInitializeDefault}
                                disabled={loading}
                            >
                                <i className="fa fa-refresh"></i>
                                {loading ? 'Đang khởi tạo...' : 'Khởi tạo gói tin mặc định'}
                            </button>
                        )}

                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="form-select"
                        >
                            <option value="all">Tất cả loại gói</option>
                            {packageTypeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>

                        {(isSearched || statusFilter !== 'all' || typeFilter !== 'all') && (
                            <button
                                onClick={clearSearch}
                                className="btn-clear-package-plan"
                            >
                                <i className="fas fa-times"></i>
                                Xóa bộ lọc
                            </button>
                        )}
                    </div>

                    {/* Results Info */}
                    <div className="admin-results-info">
                        <span>
                            Hiển thị {currentItems.length} trong tổng số {filteredPackagePlans.length} gói tin
                            {isSearched && ` (từ khóa: "${searchTerm}")`}
                        </span>
                    </div>

                </div>

                {/* Loading */}
                {loading && (
                    <div className="admin-loading">
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                    </div>
                )}

                {/* Package Plans Grid */}
                {!loading && (
                    <div className="admin-grid">
                        {currentItems.length > 0 ? (
                            currentItems.map((packagePlan) => (
                                <div
                                    key={packagePlan._id}
                                    className="package-plan-card"
                                    style={{
                                        backgroundColor: getPackageTypeInfo(packagePlan.type || 'custom').color,
                                        borderColor: getPackageTypeInfo(packagePlan.type || 'custom').color,
                                    }}
                                >
                                    <div className={`package-plan-header ${packagePlan.type || 'custom'}`}>
                                        <div className="package-type-badge"
                                            style={{ backgroundColor: getPackageTypeInfo(packagePlan.type || 'custom').color }}>
                                            {packagePlan.displayName}
                                        </div>
                                        <div className="package-actions-plan">
                                            <>
                                                <button
                                                    onClick={() => openModal('edit', packagePlan)}
                                                    className="btn-edit-package-plan btn-sm btn-warning"
                                                    title="Chỉnh sửa"
                                                >
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button
                                                    onClick={() => openModal('delete', packagePlan)}
                                                    className="btn-delete-package-plan btn-sm btn-danger"
                                                    title="Xóa"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </>

                                        </div>
                                    </div>

                                    <div className="package-plan-body">

                                        <p className="package-description">{packagePlan.description}</p>

                                        <div className="package-price">
                                            <span className="price">{formatPrice(packagePlan.price)}</span>
                                            <span className="duration">/{formatDuration(packagePlan)}</span>

                                        </div>

                                        <div className="package-info">
                                            <div className="info-item">
                                                <span className="info-label">Lượt đẩy tin miễn phí:</span>
                                                <span className="info-value">{packagePlan.freePushCount}</span>
                                            </div>
                                        </div>

                                        <div className="post-limits">
                                            <h6>Giới hạn đăng tin:</h6>
                                            {packagePlan.propertiesLimits && packagePlan.propertiesLimits.length > 0 ? (
                                                packagePlan.propertiesLimits.map((limit, index) => (
                                                    <div key={index} className="post-limit-item">
                                                        <span 
                                                            className="post-type-name"
                                                            style={{
                                                                backgroundColor: limit.packageType?.color || '#6c757d',
                                                                color: '#fff',
                                                                padding: '2px 6px',
                                                                borderRadius: '3px',
                                                                fontSize: '12px'
                                                            }}
                                                        >
                                                            {limit.packageType?.displayName || 'Loại tin'}:
                                                        </span>
                                                        <span className="limit-number">{limit.limit}</span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="no-limits">Chưa có giới hạn tin</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="package-plan-footer">
                                        <span className={`status-badge ${packagePlan.isActive ? 'active' : 'inactive'}`}>
                                            {packagePlan.isActive ? 'Hoạt động' : 'Tạm ngừng'}
                                        </span>
                                        <div className="package-total-posts">
                                            Tổng tin: {packagePlan.totalPosts || 0}
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="no-results">
                                <i className="fas fa-box-open"></i>
                                <h3>Không tìm thấy gói tin nào</h3>
                                <p>
                                    {isSearched
                                        ? 'Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc'
                                        : 'Chưa có gói tin nào được tạo'
                                    }
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Pagination */}
                {!loading && totalPages > 1 && (
                    <div className="admin-pagination">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="btn btn-outline-primary"
                        >
                            <i className="fas fa-chevron-left"></i>
                            Trước
                        </button>

                        <div className="pagination-info">
                            Trang {currentPage} / {totalPages}
                        </div>

                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="btn btn-outline-primary"
                        >
                            Sau
                            <i className="fas fa-chevron-right"></i>
                        </button>
                    </div>
                )}

                {/* Modal */}
                {showModal && (
                    <div className="modal-overlay-package-plan" onClick={closeModal}>
                        <div className="modal-dialog modal-lg" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header-package-plan">
                                    <h3 className="modal-title-package-plan">
                                        {modalType === 'create' && 'Tạo gói tin mới'}
                                        {modalType === 'edit' && 'Chỉnh sửa gói tin'}
                                        {modalType === 'delete' && 'Xác nhận xóa'}
                                    </h3>
                                    <button
                                        className="btn-close-package-plan"
                                        onClick={closeModal}
                                    >
                                        <i class="fa fa-times"></i>
                                    </button>
                                </div>

                                {modalType === 'delete' ? (
                                    <div className="modal-body-package-plan-delete text-center">
                                        <div className="delete-icon">
                                            <i className="fas fa-exclamation-triangle text-danger"></i>
                                        </div>
                                        <h4>Xác nhận xóa gói tin</h4>
                                        <p>
                                            Bạn có chắc chắn muốn xóa gói tin <strong>{selectedPackagePlan?.displayName}</strong>?
                                        </p>
                                        <p className="text-muted">Hành động này không thể hoàn tác!</p>
                                        <div className="modal-actions">
                                            <button

                                                className="btn btn-secondary-package-plan"
                                                onClick={closeModal}
                                            >
                                                Hủy
                                            </button>
                                            <button

                                                className="btn btn-danger"
                                                onClick={handleDelete}
                                            >
                                                Xóa
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        <div className="modal-body-package-plan">

                                            <div className="row-package-plan">
                                                {/* Row 3: Package Type */}
                                                {/* Package Type */}
                                                <div className="col-md-6 mb-3">
                                                    <label className="form-label">
                                                        Loại gói tin

                                                    </label>
                                                    <select
                                                        name="type"
                                                        value={formData.type}
                                                        onChange={handleInputChange}
                                                        className="form-select"

                                                    >
                                                        {packageTypeOptions.map(option => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                                {/* Row 1: Tên hiển thị & Giá */}
                                                {/* Display Name */}
                                                <div className="row-package-plan-item">
                                                    <div className="col-md-6 mb-3">
                                                        <label className="form-label required">Tên hiển thị <span className="text-danger">*</span></label>
                                                        <input
                                                            type="text"
                                                            name="displayName"
                                                            value={formData.displayName}
                                                            onChange={handleInputChange}
                                                            className="form-control"
                                                            placeholder="VD: Gói VIP Premium"
                                                            required
                                                        />
                                                    </div>

                                                    {/* Price */}
                                                    <div className="col-md-6 mb-3">
                                                        <label className="form-label required">Giá (VNĐ) <span className="text-danger">*</span></label>
                                                        <input
                                                            type="text"
                                                            name="price"
                                                            value={
                                                                formData.price === 0 || formData.price === '0'
                                                                    ? '0'
                                                                    : formData.price !== null && formData.price !== undefined
                                                                        ? formatNumberForInput(formData.price)
                                                                        : ''
                                                            }
                                                            onChange={handleInputChange}
                                                            className="form-control"
                                                            placeholder="Nhập giá gói tin (nhập 0 cho gói miễn phí)"
                                                            required
                                                        />

                                                    </div>
                                                </div>

                                                {/* Row 2: Thời hạn & Lượt đẩy tin */}
                                                {/* Duration - Hiển thị cho tất cả loại gói */}
                                                <div className="row-package-plan-item-row-2">
                                                    <div className="col-md-3 mb-3">
                                                        <label className="form-label required">Thời hạn <span className="text-danger">*</span></label>
                                                        <input
                                                            type="number"
                                                            name="duration"
                                                            value={formData.duration}
                                                            onChange={handleInputChange}
                                                            className="form-control"
                                                            min="1"
                                                            required
                                                        />
                                                    </div>

                                                    <div className="col-md-3 mb-3">
                                                        <label className="form-label required">Đơn vị <span className="text-danger">*</span></label>
                                                        <select
                                                            name="durationUnit"
                                                            value={formData.durationUnit}
                                                            onChange={handleInputChange}
                                                            className="form-select"
                                                            required
                                                        >
                                                            {durationUnitOptions.map(option => (
                                                                <option key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>

                                                {/* Free Push Count */}
                                                <div className="row-package-plan-item">
                                                    <div className="col-md-6 mb-3">
                                                        <label className="form-label">Lượt đẩy tin miễn phí</label>
                                                        <input
                                                            type="number"
                                                            name="freePushCount"
                                                            value={formData.freePushCount}
                                                            onChange={handleInputChange}
                                                            className="form-control"
                                                            min="0"
                                                        />
                                                    </div>
                                                </div>



                                                <div className="row-package-plan-item-description">
                                                    {/* Description */}
                                                    <div className="col-12 mb-3">
                                                        <label className="form-label">Mô tả</label>
                                                        <textarea
                                                            name="description"
                                                            value={formData.description}
                                                            onChange={handleInputChange}
                                                            className="form-control-textarea"
                                                            rows="3"
                                                            placeholder="Mô tả chi tiết về gói tin..."
                                                        ></textarea>
                                                    </div>
                                                </div>
                                                {/* Properties Limits */}
                                                <div className="col-12 mb-3">
                                                    <label className="form-label">Giới hạn đăng tin theo loại</label>
                                                    <div className="post-limits-grid">
                                                        {propertiesPackages.map((packageType) => {
                                                            const currentLimit = formData.propertiesLimits.find(
                                                                item => item.packageType === packageType._id
                                                            )?.limit || 0;

                                                            return (
                                                                <div key={packageType._id} className="post-limit-input">
                                                                    <label className="form-label">{packageType.displayName}</label>
                                                                    <input
                                                                        type="number"
                                                                        value={currentLimit}
                                                                        onChange={(e) => handlePropertiesLimitChange(
                                                                            packageType._id,
                                                                            parseInt(e.target.value) || 0
                                                                        )}
                                                                        className="form-control"
                                                                        min="0"
                                                                        placeholder="0"
                                                                    />
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>



                                                {/* Active Status */}
                                                <div className="col-12 mb-3">
                                                    <div className="form-switch-wrapper">
                                                        <label className="form-label">Trạng thái hoạt động</label>
                                                        <div className="form-switch">
                                                            <input
                                                                type="checkbox"
                                                                name="isActive"
                                                                checked={formData.isActive}
                                                                onChange={handleInputChange}
                                                                className="form-switch-input"
                                                                id="isActiveSwitchCheck"
                                                            />
                                                            <label className="form-switch-label" htmlFor="isActiveSwitchCheck">
                                                                <span className="form-switch-button"></span>
                                                                <span className="form-switch-text">
                                                                    {formData.isActive ? 'Bật' : 'Tắt'}
                                                                </span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="modal-footer">
                                            <button
                                                type="button"
                                                className="btn btn-secondary-package-plan"
                                                onClick={closeModal}
                                            >
                                                Hủy
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                            >
                                                {modalType === 'create' ? 'Tạo gói tin' : 'Cập nhật'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PackagePlanManagement;
