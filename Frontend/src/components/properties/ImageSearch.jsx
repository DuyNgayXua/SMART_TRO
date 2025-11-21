/**
 * ImageSearch Component - Tìm kiếm trọ bằng hình ảnh
 */
import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';
import imageSearchAPI from '../../services/imageSearchAPI.js';
import './ImageSearch.css';

const ImageSearch = ({ onSearchResults, isOpen, onClose }) => {
    const { t } = useTranslation();
    const fileInputRef = useRef(null);
    
    // States
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    // Handle file selection
    const handleFileSelect = useCallback((file) => {
        // Cleanup previous preview
        if (previewUrl) {
            imageSearchAPI.cleanupImagePreview(previewUrl);
        }

        // Validate file
        const validation = imageSearchAPI.validateImageFile(file);
        
        if (!validation.isValid) {
            validation.errors.forEach(error => toast.error(error));
            return;
        }

        // Set new file and preview
        setSelectedFile(file);
        const newPreviewUrl = imageSearchAPI.createImagePreview(file);
        setPreviewUrl(newPreviewUrl);
        
        toast.success(`Đã chọn hình ảnh: ${validation.fileInfo.name} (${validation.fileInfo.sizeFormatted})`);

    }, [previewUrl]);

    // Handle file input change
    const handleFileInputChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleFileSelect(file);
        }
    };

    // Handle drag events
    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    }, []);

    // Handle drop
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    }, [handleFileSelect]);

    // Handle search
    const handleSearch = async () => {
        if (!selectedFile) {
            toast.error('Vui lòng chọn hình ảnh để tìm kiếm');
            return;
        }

        try {
            setIsSearching(true);
            
            const result = await imageSearchAPI.searchByImage(selectedFile);
            
            if (result.success) {
                // Pass results to parent component with correct structure
                if (onSearchResults) {
                    onSearchResults({
                        data: {
                            properties: result.data.properties,
                            pagination: result.data.pagination,
                            uploadedImage: result.data.uploadedImage
                        },
                        searchType: 'image'
                    });
                }
                
                toast.success(result.message);
                
                // Close modal after successful search
                handleClose();
                
            } else {
                toast.error(result.message || 'Có lỗi xảy ra khi tìm kiếm');
            }

        } catch (error) {
            console.error('Search error:', error);
            toast.error('Lỗi khi tìm kiếm hình ảnh');
        } finally {
            setIsSearching(false);
        }
    };

    // Handle close
    const handleClose = () => {
        // Cleanup
        if (previewUrl) {
            imageSearchAPI.cleanupImagePreview(previewUrl);
        }
        
        setSelectedFile(null);
        setPreviewUrl(null);
        setDragActive(false);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        
        if (onClose) {
            onClose();
        }
    };

    // Handle remove file
    const handleRemoveFile = () => {
        if (previewUrl) {
            imageSearchAPI.cleanupImagePreview(previewUrl);
        }
        
        setSelectedFile(null);
        setPreviewUrl(null);
        
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Cleanup on component unmount
    React.useEffect(() => {
        return () => {
            if (previewUrl) {
                imageSearchAPI.cleanupImagePreview(previewUrl);
            }
        };
    }, [previewUrl]);

    if (!isOpen) return null;

    return (
        <div className="image-search-modal">
            <div className="modal-overlay-image-search-modal" onClick={handleClose} />
            
            <div className="modal-content-image-search-modal">
                <div className="modal-header-image-search-modal">
                    <h3>
                        <i className="fa fa-camera"></i>
                        Tìm kiếm bằng hình ảnh
                    </h3>
                    <button 
                        className="close-btn-current-package" 
                        onClick={handleClose}
                        disabled={isSearching}
                    >
                        <i className="fa fa-times"></i>
                    </button>
                </div>

                <div className="modal-body-image-search-modal">
                    <div className="search-description">
                        <p>
                            <i className="fa fa-search"></i>
                            Tải lên hình ảnh phòng trọ/căn nhà hoặc nội thất để hệ thống gợi ý các phòng trọ có hình ảnh tương tự.
                        </p>
                    </div>

                    {/* File Upload Area */}
                    <div 
                        className={`file-upload-area ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        {!selectedFile ? (
                            <div className="upload-placeholder">
                                <div className="upload-icon">
                                    <i className="fa fa-cloud-upload"></i>
                                </div>
                                <h4>Kéo thả hình ảnh vào đây</h4>
                                <p>hoặc</p>
                                <button 
                                    type="button"
                                    className="btn-select-file"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isSearching}
                                >
                                    <i className="fa fa-folder-open"></i>
                                    Chọn file từ máy tính
                                </button>
                                <p className="file-requirements">
                                    <small>
                                        <i className="fa fa-exclamation-triangle"></i>
                                        Chỉ chấp nhận JPG, PNG, WEBP. Tối đa 5MB.
                                    </small>
                                </p>
                            </div>
                        ) : (
                            <div className="file-preview">
                                <div className="preview-image-search-modal">
                                    <img src={previewUrl} alt="Preview" />
                                    <div className="preview-overlay">
                                        <button 
                                            className="remove-image-new-property"
                                            onClick={handleRemoveFile}
                                            disabled={isSearching}
                                            title="Xóa hình ảnh"
                                        >
                                            <i className="fa fa-times"></i>
                                        </button>
                                    </div>
                                </div>
                              
                            </div>
                        )}

                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileInputChange}
                            style={{ display: 'none' }}
                            disabled={isSearching}
                        />
                    </div>

                    {/* Search Instructions */}
                    <div className="search-instructions">
                        <h4>
                            <i className="fa fa-lightbulb-o"></i>
                            Mẹo để có kết quả tốt nhất:
                        </h4>
                        <ul>
                            <li>Sử dụng hình ảnh rõ nét, ánh sáng tốt</li>
                            <li>Chụp toàn cảnh căn phòng để AI phân tích tốt hơn</li>
                            <li>Tránh ảnh mờ, tối hoặc bị che khuất</li>
                           
                        </ul>
                    </div>
                </div>

                <div className="modal-footer">
                    <button 
                        className="btn-cancel-image-search-modal"
                        onClick={handleClose}
                        disabled={isSearching}
                    >
                        <i className="fa fa-times"></i>
                        Hủy bỏ
                    </button>
                    
                    <button 
                        className="btn-search-image-search-modal"
                        onClick={handleSearch}
                        disabled={!selectedFile || isSearching}
                    >
                        {isSearching ? (
                            <>
                                <i className="fa fa-spinner fa-spin"></i>
                                Đang tìm kiếm...
                            </>
                        ) : (
                            <>
                                <i className="fa fa-search"></i>
                                Tìm kiếm ngay
                            </>
                        )}
                    </button>
                </div>
            </div>

          
        </div>
    );
};

export default ImageSearch;
