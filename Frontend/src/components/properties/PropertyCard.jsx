import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFavorites } from '../../contexts/FavoritesContext';
import { propertyDetailAPI } from '../../services/propertyDetailAPI';
import { viewTrackingUtils } from '../../utils/viewTrackingUtils';
import {
    FaHeart, FaRegHeart, FaCamera, FaHome, FaFire, FaStar, FaCrown,
    FaExpand, FaUsers, FaMapMarkerAlt, FaEye, FaClock, FaUser, FaPhone,
    FaWifi, FaCar, FaSnowflake, FaTv, FaUtensils, FaShower, FaBed,
    FaCouch, FaLock, FaShieldAlt, FaMotorcycle
} from 'react-icons/fa';
import './PropertyCard.css';

const PropertyCard = ({ property, onPropertyClick, onFavoriteToggle, isLoggedIn }) => {

    const navigate = useNavigate();
    const { isFavorited } = useFavorites();

    // Helper function để xử lý URL avatar Google
    const getAvatarUrl = (avatar) => {
        if (avatar && avatar.includes('googleusercontent.com')) {
            // Cải thiện chất lượng ảnh Google
            const baseUrl = avatar.split('=')[0];
            const newUrl = `${baseUrl}=s200-c`;
           
            return newUrl;
        }
        return avatar || 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
    };

    // Format price
    const formatPrice = (price) => {
        return new Intl.NumberFormat('vi-VN').format(price);
    };

    // Format large numbers for stats (views, comments, favorites)
    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
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

    // Get post type styling từ packageInfo.postType
    const getPostTypeStyle = () => {
        const postType = property.packageInfo?.postType;
        if (!postType) return {};

        const priority = postType.priority || 10;
        
        return {
            color: postType.color || '#000000',
            textTransform: postType.textStyle || 'none',
            fontWeight: priority <= 2 ? 'bold' : 'normal'
        };
    };

    // Get post type badge với stars
    const getPostTypeBadge = () => {
        const postType = property.packageInfo?.postType;
        if (!postType) return null;

        // Tính số sao từ priority trực tiếp từ API
        const priority = postType.priority || 10;
        const stars = priority <= 6 ? Math.max(0, Math.min(5, 6 - priority)) : 0;
        const starIcons = Array.from({ length: stars }, (_, i) => (
            <FaStar key={i} className="star-icon" />
        ));

        return (
            <div className="post-type-badge-property-card" style={{ color: postType.color || '#6c757d' }}>
                
                {stars > 0 && (
                    <div className="post-type-stars">
                        {starIcons}
                    </div>
                )}
            </div>
        );
    };

    // Handle card click
    const handleCardClick = async () => {
        // Record view when user clicks on card
        try {
            // Only record if not already viewed in this session
            if (!viewTrackingUtils.hasBeenViewed(property._id)) {
                await propertyDetailAPI.recordPropertyView(property._id);
                viewTrackingUtils.markAsViewedWithTimestamp(property._id);
            }
        } catch (error) {
            console.error('Error recording view:', error);
            // Continue navigation even if view recording fails
        }

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
            const currentStatus = property.isFavorited || isFavorited(property._id);
            onFavoriteToggle(property._id, currentStatus);
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
            <div className="property-info-card">
                <div className="property-header">
                    <div className="title-section">
                          {getPostTypeBadge()}
                        <h3 
                            className="property-title-card" 
                            title={property.title}
                            style={getPostTypeStyle()}
                        >
                            {property.title}
                        </h3>
                      
                    </div>
                    <div className="property-price-card">
                        {property.promotionPrice && property.promotionPrice > 0 ? (
                            <>
                                {/* Giá gốc bị gạch ngang */}
                                <span className="price-value original-price">
                                    {formatPrice(property.rentPrice)}
                                </span>
                                {/* Giá khuyến mãi */}
                                <span className="price-value promotion-price">
                                    {formatPrice(property.promotionPrice)}
                                </span>
                                <span className="price-unit">VNĐ/tháng</span>
                            </>
                        ) : (
                            <>
                                <span className="price-value">
                                    {formatPrice(property.rentPrice)}
                                </span>
                                <span className="price-unit">VNĐ/tháng</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="property-card-detail">
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
                                    Cọc: {formatPrice(property.deposit)} VNĐ
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="property-location">
                        
                        <FaMapMarkerAlt />
                        <span title={`${property.detailAddress}, ${property.ward}, ${property.province}`}>
                            {property.detailAddress ?
                                `${property.detailAddress}, ${property.ward}, ${property.province}` :
                                `${property.ward}, ${property.province}`
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
                        <div className="meta-item-card">
                            <FaEye />
                            <span>{formatNumber(property.views || 0)} lượt xem</span>
                        </div>
                    </div>
                </div>

                {/* Property Footer */}
                <div className="property-footer">
                    <div className="owner-info">
                        <div className="owner-avatar">
                            {property.owner?.avatar ? (
                                <img
                                    src={getAvatarUrl(property.owner.avatar)}
                                    alt={property.owner.fullName}
                                    crossOrigin="anonymous"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                       
                                        e.target.src = 'https://res.cloudinary.com/dapvuniyx/image/upload/v1755712519/avatar_gj5yhw.jpg';
                                    }}
                                />
                            ) : null}
                            <FaUser style={{ display: property.owner?.avatar ? 'none' : 'block' }} />
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
                            {property.owner?.phone || 'Liên hệ'}
                        </button>

                        {/* Favorite button - Next to contact button */}
                        {isLoggedIn && (
                            <button
                                className={`favorite-btn ${(property.isFavorited || isFavorited(property._id)) ? 'favorited' : ''}`}
                                onClick={handleFavoriteClick}
                                title={(property.isFavorited || isFavorited(property._id)) ? 'Bỏ yêu thích' : 'Yêu thích'}
                            >
                                {(property.isFavorited || isFavorited(property._id)) ? (
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
