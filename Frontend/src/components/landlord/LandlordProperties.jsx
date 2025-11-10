import React from 'react';
import { useNavigate } from 'react-router-dom';
import './LandlordProperties.css';

const LandlordProperties = () => {
    const navigate = useNavigate();

    const managementItems = [
        {
            title: 'Quản lý phòng',
            description: 'Thêm, sửa, xóa thông tin phòng trọ',
            icon: 'fa-door-open',
            path: '/admin/rooms',
            color: '#667eea'
        },
        {
            title: 'Quản lý tiện nghi',
            description: 'Quản lý các tiện nghi của phòng trọ',
            icon: 'fa-star',
            path: '/admin/amenities',
            color: '#f59e0b'
        },
        {
            title: 'Quản lý người thuê',
            description: 'Xem và quản lý thông tin người thuê',
            icon: 'fa-users',
            path: '/admin/tenants',
            color: '#10b981'
        },
        {
            title: 'Quản lý hợp đồng',
            description: 'Quản lý hợp đồng thuê phòng',
            icon: 'fa-file-contract',
            path: '/admin/contracts',
            color: '#3b82f6'
        },
        {
            title: 'Quản lý thanh toán',
            description: 'Theo dõi và quản lý các khoản thanh toán',
            icon: 'fa-money-bill-wave',
            path: '/admin/payments',
            color: '#ef4444'
        }
    ];

    return (
        <div className="landlord-properties-container">
            <div className="landlord-header">
                <h1>
                    <i className="fa fa-building"></i> Quản lý trọ
                </h1>
                <p>Quản lý toàn bộ thông tin phòng trọ của bạn</p>
            </div>

            <div className="management-grid">
                {managementItems.map((item, index) => (
                    <div 
                        key={index} 
                        className="management-card"
                        onClick={() => navigate(item.path)}
                        style={{ borderTop: `4px solid ${item.color}` }}
                    >
                        <div className="card-icon" style={{ color: item.color }}>
                            <i className={`fa ${item.icon}`}></i>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                        <button 
                            className="card-button"
                            style={{ background: item.color }}
                        >
                            Truy cập <i className="fa fa-arrow-right"></i>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LandlordProperties;
