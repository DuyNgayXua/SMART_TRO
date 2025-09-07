import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    FaHeart, FaRegHeart, FaCamera, FaHome, FaFire, FaStar, FaCrown,
    FaExpand, FaUsers, FaMapMarkerAlt, FaEye, FaClock, FaUser, FaPhone,
    FaWifi, FaCar, FaSnowflake, FaTv, FaUtensils, FaShower, FaBed,
    FaCouch, FaLock, FaShieldAlt, FaMotorcycle
} from 'react-icons/fa';
import './PropertyCard.css';

const PropertyCard = ({ property, onPropertyClick, onFavoriteToggle, isLoggedIn }) => {
    const navigate = useNavigate();
    // Format price
    const formatPrice = (price) => {
        if (price >= 1000000) {
            return `${(price / 1000000).toFixed(1)} triệu`;
        }
        return new Intl.NumberFormat('vi-VN').format(price);
    };

    // Format date
    const formatDate = (dateString) => {
        const now = new Date();
        const date = new Date(dateString);

        // Reset time to 00:00:00 for accurate day comparison
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const postDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

        const diffTime = today.getTime() - postDate.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'hôm nay';
        if (diffDays === 1) return 'hôm qua';
        if (diffDays > 0 && diffDays <= 7) return `${diffDays} ngày trước`;
        if (diffDays < 0) return 'hôm nay'; // Future date, treat as today

        return date.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const statusConfig = {
            hot: { class: 'status-hot', text: 'HOT', icon: FaFire },
            new: { class: 'status-new', text: 'MỚI', icon: FaStar },
            vip: { class: 'status-vip', text: 'VIP', icon: FaCrown }
        };

        if (statusConfig[status]) {
            const config = statusConfig[status];
            const IconComponent = config.icon;
            return (
                <span className={`property-badge ${config.class}`}>
                    <IconComponent />
                    {config.text}
                </span>
            );
        }
        return null;
    };

    // Handle card click
    const handleCardClick = () => {
        if (onPropertyClick) {
            onPropertyClick(property._id);
        } else {
            navigate(`/properties/${property._id}`);
        }
    };

    // Handle favorite click
    const handleFavoriteClick = (e) => {
        e.stopPropagation();
        if (onFavoriteToggle) {
            onFavoriteToggle(property._id, property.isFavorited);
        }
    };

    return (
        <div className="property-card-list" onClick={handleCardClick}>
            {/* Property Image */}
            <div className="property-image-list">
                {property.images && property.images.length > 0 ? (
                    <div className="image-grid">
                        {/* If video exists, show video first, then 4 images */}
                        {property.video ? (
                            <>
                                {/* Main video */}
                                <div className="main-image">
                                    <video
                                        src={property.video}
                                        controls
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            borderRadius: '4px'
                                        }}
                                        onError={(e) => {
                                            console.error('Video load error:', e);
                                        }}
                                    />
                                </div>

                                {/* Small images grid - show first 4 images */}
                                {property.images.length > 0 && (
                                    <div className="small-images">
                                        {property.images.slice(0, 4).map((image, index) => (
                                            <div key={index} className="small-image">
                                                <img
                                                    src={image}
                                                    alt={`${property.title} ${index + 1}`}
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        e.target.src = '/images/placeholder.jpg';
                                                    }}
                                                />
                                                {/* Show +count on last image if more than 4 total images */}
                                                {index === 3 && property.images.length > 4 && (
                                                    <div className="more-images">
                                                        <span>+{property.images.length - 4}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* No video - original logic: 1 main image + 4 small images */}
                                <div className="main-image">
                                    <img
                                        src={property.images[0]}
                                        alt={property.title}
                                        loading="lazy"
                                        onError={(e) => {
                                            e.target.src = '/images/placeholder.jpg';
                                        }}
                                    />
                                </div>

                                {/* Small images grid */}
                                {property.images.length > 1 && (
                                    <div className="small-images">
                                        {property.images.slice(1, 5).map((image, index) => (
                                            <div key={index} className="small-image">
                                                <img
                                                    src={image}
                                                    alt={`${property.title} ${index + 2}`}
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        e.target.src = '/images/placeholder.jpg';
                                                    }}
                                                />
                                                {/* Show +count on last image if more than 5 total */}
                                                {index === 3 && property.images.length > 5 && (
                                                    <div className="more-images">
                                                        <span>+{property.images.length - 5}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Media count badge - show total media count */}
                        <div className="image-count">
                            <FaCamera />
                            {property.video ?
                                `1 video + ${property.images.length} ảnh` :
                                `${property.images.length} ảnh`
                            }
                        </div>
                    </div>
                ) : (
                    <div className="no-image">
                        <FaHome />
                        <span>Chưa có ảnh</span>
                    </div>
                )}

                {/* Status badges */}
                <div className="property-badges">
                    {getStatusBadge(property.priority)}
                </div>

            </div>

            {/* Property Info */}
            <div className="property-info">
                <div className="property-header">
                    <h3 className="property-title" title={property.title}>
                        {property.title}
                    </h3>
                    <div className="property-price">
                        <span className="price-value">
                            {formatPrice(property.rentPrice)}
                        </span>
                        <span className="price-unit">VNĐ/tháng</span>
                    </div>
                </div>

                <div className="property-details">
                    <div className="detail-row">
                        <div className="detail-item-card">
                            <FaExpand />
                            <span>{property.area}m²</span>
                        </div>
                        <div className="detail-item-card">
                            <FaUsers />
                            <span>Tối đa {property.maxOccupants} người</span>
                        </div>
                        {property.deposit && (
                            <div className="detail-item-card">
                                <span style={{ color: '#e08600ff', fontWeight: '700' }}>
                                    Cọc: {formatPrice(property.deposit)}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="property-location">
                        <FaMapMarkerAlt />
                        <span title={`${property.location?.detailAddress}, ${property.location?.wardName}, ${property.location?.districtName}, ${property.location?.provinceName}`}>
                            {property.location?.detailAddress ?
                                `${property.location.detailAddress}, ${property.location?.wardName}, ${property.location?.districtName}, ${property.location?.provinceName}` :
                                `${property.location?.wardName}, ${property.location?.districtName}, ${property.location?.provinceName}`
                            }
                        </span>
                    </div>

                    {/* Description preview */}
                    {property.description && (
                        <div className="property-description">
                            <span>{property.description.length > 100 ?
                                `${property.description.substring(0, 100)}...` :
                                property.description
                            }</span>
                        </div>
                    )}

                    {/* Amenities preview */}
                    {property.amenities && property.amenities.length > 0 && (
                        <div className="property-amenities">
                            {property.amenities.slice(0, 2).map((amenity, index) => {
                                // Kiểm tra amenity là object hay chỉ là ID string
                                if (typeof amenity === 'object' && amenity.name && amenity.icon) {

                                    return (
                                        <span key={index} className="amenity-item">
                                            <i className={amenity.icon}></i>
                                            {amenity.name}
                                        </span>
                                    );
                                } else {
                                    // Nếu chỉ là ID string, hiển thị fallback
                                    return (
                                        <span key={index} className="amenity-item">
                                            <FaHome />
                                            Tiện ích
                                        </span>
                                    );
                                }
                            })}
                            {property.amenities.length > 2 && (
                                <span className="amenity-more">
                                    ...
                                </span>
                            )}
                        </div>
                    )}

                    {/* Property meta */}
                    <div className="property-meta">
                        <div className="meta-item">
                            <FaEye />
                            <span>{property.views || 0} lượt xem</span>
                        </div>

                    </div>
                </div>

                {/* Property Footer */}
                <div className="property-footer">
                    <div className="owner-info">
                        <div className="owner-avatar">
                            {property.owner?.avatar ? (
                                <img src={property.owner.avatar} alt={property.owner.fullName} />
                            ) : (
                                <FaUser />
                            )}
                        </div>
                        <div className="owner-details">
                            <span className="owner-name">{property.owner?.fullName || 'Chủ trọ'}</span>
                            <span className="post-time">
                                {property.createdAt ?
                                    `Đăng ${formatDate(property.createdAt)}` :
                                    'Vừa đăng'
                                }
                            </span>
                        </div>
                    </div>

                    <div className="property-actions">
                        <button
                            className="btn-contact"
                            onClick={(e) => {
                                e.stopPropagation();
                                // Handle contact
                            }}
                        >
                            <FaPhone />
                            {property.owner?.phoneNumber || 'Liên hệ'}
                        </button>

                        {/* Favorite button - Next to contact button */}
                        {isLoggedIn && (
                            <button
                                className={`favorite-btn ${property.isFavorited ? 'favorited' : ''}`}
                                onClick={handleFavoriteClick}
                                title={property.isFavorited ? 'Bỏ yêu thích' : 'Yêu thích'}
                            >
                                {property.isFavorited ? (
                                    <FaHeart className="favorite-icon filled" />
                                ) : (
                                    <FaRegHeart className="favorite-icon" />
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PropertyCard;
export { PropertyCard };
