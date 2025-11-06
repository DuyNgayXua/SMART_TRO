import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import './PropertySlider.css';

const PropertySlider = ({ properties }) => {
    const navigate = useNavigate();
    const [currentIndex, setCurrentIndex] = useState(0);
    const sliderRef = useRef(null);

    const handleViewDetails = (propertyId) => {
        // Mở link trong tab mới để giữ nguyên chatbot
        window.open(`/properties/${propertyId}`, '_blank');
    };

    const handlePrevSlide = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            scrollToSlide(currentIndex - 1);
        }
    };

    const handleNextSlide = () => {
        if (currentIndex < properties.length - 1) {
            setCurrentIndex(currentIndex + 1);
            scrollToSlide(currentIndex + 1);
        }
    };

    const scrollToSlide = (index) => {
        if (sliderRef.current) {
            const slideWidth = sliderRef.current.querySelector('.property-card-slide')?.offsetWidth || 0;
            const gap = 20;
            sliderRef.current.scrollTo({
                left: index * (slideWidth + gap),
                behavior: 'smooth'
            });
        }
    };

    if (!properties || properties.length === 0) {
        return <div className="no-properties">Không có thuộc tính nào để hiển thị.</div>;
    }

    // Nếu chỉ có 1 property thì hiển thị bình thường
    if (properties.length === 1) {
        const property = properties[0];
        return (
            <div className="single-property-container">
                <div className="property-card-slider">
                    <div className="property-imaged-slider">
                        {property.images && property.images.length > 0 ? (
                            <img
                                src={property.images[0]}
                                alt={property.title}
                                onError={(e) => {
                                    e.target.src = '/immio.jpg';
                                }}
                            />
                        ) : (
                            <div className="no-image">
                                <i className="fas fa-image"></i>
                                <span>Không có hình ảnh</span>
                            </div>
                        )}
                        {property.isPromoted && <div className="promoted-badge">Nổi bật</div>}
                    </div>

                    <div className="property-content">
                        <h3 className="property-title">{property.title}</h3>

                        <div className="property-location">
                            <i className="fas fa-map-marker-alt"></i>
                            <span>
                                {property.detailAddress && `${property.detailAddress}, `}
                                {property.ward && `${property.ward}, `}
                                {property.province && `${property.province}`}
                            </span>
                        </div>

                        <div className="property-details-slider">
                            <div className="property-price">
                                <i className="fas fa-dollar-sign"></i>
                                {property.promotionPrice && property.promotionPrice > 0 ? (
                                    <div className="price-with-promotion-slider">
                                        <span className="original-price-slider">{property.rentPrice ? property.rentPrice.toLocaleString('vi-VN') : 'Liên hệ'} VNĐ/tháng</span>
                                        <span className="promotion-price-slider">{property.promotionPrice.toLocaleString('vi-VN')} VNĐ/tháng</span>
                                    </div>
                                ) : (
                                    <span>{property.rentPrice ? property.rentPrice.toLocaleString('vi-VN') : 'Liên hệ'} VNĐ/tháng</span>
                                )}
                            </div>

                            <div className="property-details-slider-item">
                                <div className="property-area">
                                    <i className="fas fa-expand-arrows-alt"></i>
                                    <span>{property.area || 'N/A'} m²</span>
                                </div>
                                <div className="property-maxoccupancy">
                                    <i className="fas fa-users"></i>
                                    <span>{property.maxOccupants || 'N/A'} người</span>
                                </div>
                            </div>
                        </div>

                        {property.amenities && property.amenities.length > 0 && (
                            <div className="property-amenities">
                                <div className="amenities-list">
                                    {property.amenities.slice(0, 3).map((amenity, index) => (
                                        <span key={index} className="amenity-tag">
                                            {typeof amenity === 'string' ? amenity : amenity.name || amenity.text || amenity._id || 'Tiện ích'}
                                        </span>
                                    ))}
                                    {property.amenities.length > 3 && (
                                        <span className="amenity-tag more">+{property.amenities.length - 3}</span>
                                    )}
                                </div>
                            </div>
                        )}

                        <button
                            className="view-details-btn"
                            onClick={() => handleViewDetails(property._id)}
                        >
                            <i className="fas fa-eye"></i>
                            Xem chi tiết
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Nếu có nhiều hơn 1 property thì hiển thị với slider
    return (
        <div className="property-slider-container">
            <div className="slider-header">
                <span className="slider-counter">
                    {currentIndex + 1} / {properties.length}
                </span>
            </div>
            
            <div className="slider-wrapper">
                <button 
                    className={`slider-btn-chat prev ${currentIndex === 0 ? 'disabled' : ''}`}
                    onClick={handlePrevSlide}
                    disabled={currentIndex === 0}
                >
                    <FaChevronLeft />
                </button>
                
                <div className="properties-slider" ref={sliderRef}>
                {properties.map((property) => (
                    <div key={property._id} className="property-card-slide slider-card">
                        <div className="property-imaged-slider">
                            {property.images && property.images.length > 0 ? (
                                <img
                                    src={property.images[0]}
                                    alt={property.title}
                                    onError={(e) => {
                                        e.target.src = '/immio.jpg';
                                    }}
                                />
                            ) : (
                                <div className="no-image">
                                    <i className="fas fa-image"></i>
                                    <span>Không có hình ảnh</span>
                                </div>
                            )}
                            {property.isPromoted && <div className="promoted-badge">Nổi bật</div>}
                        </div>

                        <div className="property-content">
                            <h3 className="property-title">{property.title}</h3>

                            <div className="property-location">
                                <i className="fas fa-map-marker-alt"></i>
                                <span>
                                    {property.detailAddress && `${property.detailAddress}, `}
                                    {property.ward && `${property.ward}, `}
                                    {property.province && `${property.province}`}
                                </span>
                            </div>

                            <div className="property-details-slider">
                                <div className="property-price">
                                    <i className="fas fa-dollar-sign"></i>
                                    {property.promotionPrice && property.promotionPrice > 0 ? (
                                        <div className="price-with-promotion-slider">
                                            <span className="original-price-slider">{property.rentPrice ? property.rentPrice.toLocaleString('vi-VN') : 'Liên hệ'} VNĐ/tháng</span>
                                            <span className="promotion-price-slider">{property.promotionPrice.toLocaleString('vi-VN')} VNĐ/tháng</span>
                                        </div>
                                    ) : (
                                        <span>{property.rentPrice ? property.rentPrice.toLocaleString('vi-VN') : 'Liên hệ'} VNĐ/tháng</span>
                                    )}
                                </div>

                                <div className="property-details-slider-item">
                                    <div className="property-area">
                                        <i className="fas fa-expand-arrows-alt"></i>
                                        <span>{property.area || 'N/A'} m²</span>
                                    </div>
                                    <div className="property-maxoccupancy">
                                        <i className="fas fa-users"></i>
                                        <span>{property.maxOccupants || 'N/A'} người</span>
                                    </div>
                                </div>
                            </div>

                            {property.amenities && property.amenities.length > 0 && (
                                <div className="property-amenities">
                                    <div className="amenities-list">
                                        {property.amenities.slice(0, 3).map((amenity, index) => (
                                            <span key={index} className="amenity-tag">
                                                {typeof amenity === 'string' ? amenity : amenity.name || amenity.text || amenity._id || 'Tiện ích'}
                                            </span>
                                        ))}
                                        {property.amenities.length > 3 && (
                                            <span className="amenity-tag more">+{property.amenities.length - 3}</span>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                className="view-details-btn"
                                onClick={() => handleViewDetails(property._id)}
                            >
                                <i className="fas fa-eye"></i>
                                Xem chi tiết
                            </button>
                        </div>
                    </div>
                ))}
                </div>
                
                <button 
                    className={`slider-btn-chat next ${currentIndex === properties.length - 1 ? 'disabled' : ''}`}
                    onClick={handleNextSlide}
                    disabled={currentIndex === properties.length - 1}
                >
                    <FaChevronRight />
                </button>
            </div>
            
            <div className="slider-dots">
                {properties.map((_, index) => (
                    <button
                        key={index}
                        className={`dot ${index === currentIndex ? 'active' : ''}`}
                        onClick={() => {
                            setCurrentIndex(index);
                            scrollToSlide(index);
                        }}
                    />
                ))}
            </div>
        </div>
    );
};

export default PropertySlider;