import React, { useState, useEffect, useRef } from 'react';
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { myPropertiesAPI } from '../../../services/myPropertiesAPI';
import { locationAPI } from '../../../services/locationAPI';
import amenitiesAPI from '../../../services/amenitiesAPI';
import adminPackagePlanAPI from '../../../services/adminPackagePlanAPI';
import { processFilesForUpload, validateFile, formatFileSize, createFilePreview } from '../../../utils/fileUtils';
import dayjs from 'dayjs';
import './EditPropertyModal.css';
import '../new-property/RejectedFiles.css';
import '../new-property/FileValidation.css';

// Import TrackAsia GL JS
import trackasiagl from 'trackasia-gl';
import 'trackasia-gl/dist/trackasia-gl.css';

const EditPropertyModal = ({ property, onClose, onSuccess }) => {
  console.log("EditPropertyModal property prop:", property);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [rejectedFiles, setRejectedFiles] = useState({ images: [], videos: [] });
  
  // File validation states
  const [fileValidation, setFileValidation] = useState({ images: [], videos: [] });
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const lastAddressRef = useRef(null);
  const lastCoordsRef = useRef(null);

  // TrackAsia map refs
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markerRef = useRef(null);

  // TrackAsia API configuration
  const TRACKASIA_API_KEY = process.env.REACT_APP_TRACKASIA_API_KEY || 'public_key';
  const TRACKASIA_BASE_URL = 'https://maps.track-asia.com';

  // Default coordinates (Đà Nẵng)
  const defaultCenter = {
    lat: 16.056204,
    lng: 108.168202
  };


  // Location data (cập nhật theo schema mới: chỉ có province và ward)
  const [locationData, setLocationData] = useState({
    provinces: [],
    wards: [],
    loadingProvinces: false,
    loadingWards: false,
    geocoding: false
  });

  // Amenities data
  const [amenitiesData, setAmenitiesData] = useState({
    amenities: [],
    loading: false,
    error: null
  });

  // Package data
  const [packageData, setPackageData] = useState({
    userPackageInfo: null,
    availablePostTypes: [],
    loadingPackage: false,
    loadingPostTypes: false
  });

  // Selected package and post type
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedPostType, setSelectedPostType] = useState(null);
  const [originalPostType, setOriginalPostType] = useState(null); // Lưu post type gốc

  // Options data
  const categories = [
    { value: 'phong_tro', label: 'Phòng trọ' },
    { value: 'can_ho', label: 'Căn hộ' },
    { value: 'nha_nguyen_can', label: 'Nhà nguyên căn' },
    { value: 'chung_cu_mini', label: 'Chung cư mini' },
    { value: 'homestay', label: 'Homestay' }
  ];

  const maxOccupantsOptions = [
    { value: '1', label: '1 người' },
    { value: '2', label: '2 người' },
    { value: '3', label: '3 người' },
    { value: '4', label: '4 người' },
    { value: '5+', label: '5+ người' }
  ];

  // Load amenities from API
  useEffect(() => {
    const loadAmenities = async () => {
      try {
        setAmenitiesData(prev => ({ ...prev, loading: true, error: null }));

        const response = await amenitiesAPI.getAllAmenities();
        console.log('Amenities API response:', response);

        // Handle different response structures
        let amenitiesArray = [];
        if (Array.isArray(response)) {
          amenitiesArray = response;
        } else if (response?.data && Array.isArray(response.data)) {
          amenitiesArray = response.data;
        } else if (response?.data?.amenities && Array.isArray(response.data.amenities)) {
          amenitiesArray = response.data.amenities;
        } else if (response?.amenities && Array.isArray(response.amenities)) {
          amenitiesArray = response.amenities;
        } else {
          console.warn('Unexpected amenities API response structure:', response);
          amenitiesArray = [];
        }

        // Transform to expected format
        const transformedAmenities = amenitiesArray.map(amenity => ({
          value: amenity._id,
          label: amenity.name,
          key: amenity.key,
          icon: amenity.icon
        }));

        setAmenitiesData({
          amenities: transformedAmenities,
          loading: false,
          error: null
        });

      } catch (error) {
        console.error('Error loading amenities:', error);
        setAmenitiesData({
          amenities: [],
          loading: false,
          error: 'Không thể tải danh sách tiện ích'
        });
      }
    };

    loadAmenities();
  }, []);

  // Load package data
  useEffect(() => {
    const loadPackageData = async () => {
      try {
        setPackageData(prev => ({ ...prev, loadingPackage: true }));
        
        // Kiểm tra gói tin từ property trước
        let packageToUse = null;
        let availablePostTypesToUse = [];
        
        if (property?.packageInfo && property.packageInfo.plan) {
          // Kiểm tra gói của property có hết hạn chưa
          const propertyExpiryDate = property.packageInfo.expiryDate;
          const now = new Date();
          const isPropertyPackageExpired = propertyExpiryDate && new Date(propertyExpiryDate) < now;
          
          if (!isPropertyPackageExpired && property.packageInfo.isActive) {
            console.log('Using property package info (still active):', property.packageInfo);
            
            // Sử dụng gói tin từ property - cần load thông tin plan đầy đủ
            console.log('Property package plan:', property.packageInfo.plan);
            
            // Load thông tin đầy đủ về gói tin từ user package để lấy limits
            const userPackageResponse = await myPropertiesAPI.getCurrentUserPackage();
            let actualPackageInfo = null;
            
            if (userPackageResponse.success && userPackageResponse.data) {
              // Kiểm tra xem user có đang sử dụng cùng gói không
              if (userPackageResponse.data.packageId === property.packageInfo.plan._id) {
                actualPackageInfo = userPackageResponse.data;
              }
            }
            
            if (actualPackageInfo) {
              // Sử dụng thông tin từ user package (có đầy đủ limits)
              packageToUse = {
                ...actualPackageInfo,
                // Ghi đè thông tin từ property nếu property còn hạn
                packageId: property.packageInfo.plan._id,
                packageName: property.packageInfo.plan.name,
                displayName: property.packageInfo.plan.displayName,
                packageType: property.packageInfo.plan.type,
                expiryDate: property.packageInfo.expiryDate,
                startDate: property.packageInfo.startDate,
                isActive: property.packageInfo.isActive
              };
            } else {
              // Fallback: tạo package info cơ bản từ property
              packageToUse = {
                packageId: property.packageInfo.plan._id,
                packageName: property.packageInfo.plan.name,
                displayName: property.packageInfo.plan.displayName,
                packageType: property.packageInfo.plan.type,
                expiryDate: property.packageInfo.expiryDate,
                startDate: property.packageInfo.startDate,
                isActive: property.packageInfo.isActive,
                // Tạo limit item cho post type hiện tại với logic đặc biệt
                propertiesLimits: [{
                  packageType: property.packageInfo.postType,
                  limit: 1, // Chỉ cho phép tin hiện tại
                  used: 0   // Vì tin này đã tồn tại, coi như chưa sử dụng slot mới
                }]
              };
            }
            
            availablePostTypesToUse = packageToUse.propertiesLimits || [];
            
            console.log('Final package to use:', packageToUse);
            console.log('Available post types to use:', availablePostTypesToUse);
            
            setPackageData(prev => ({ 
              ...prev, 
              userPackageInfo: packageToUse,
              availablePostTypes: availablePostTypesToUse,
              loadingPackage: false 
            }));
            setSelectedPackage(packageToUse);
            
            return; // Không cần load user package nữa
          }
        }
        
        // Nếu không có gói tin từ property hoặc đã hết hạn, load user package
        const userPackageResponse = await myPropertiesAPI.getCurrentUserPackage();
        console.log('User package info:', userPackageResponse);
        
        if (userPackageResponse.success) {
          const userPackage = userPackageResponse.data;
          setPackageData(prev => ({ 
            ...prev, 
            userPackageInfo: userPackage,
            loadingPackage: false 
          }));
          console.log('Selected package set to user package:', userPackage);
          setSelectedPackage(userPackage);
          
          // Load available post types for this package
          if (userPackage && userPackage.propertiesLimits) {
            setPackageData(prev => ({ 
              ...prev, 
              availablePostTypes: userPackage.propertiesLimits,
              loadingPostTypes: false 
            }));
          }
        }
      } catch (error) {
        console.error('Error loading package data:', error);
        setPackageData(prev => ({ 
          ...prev, 
          loadingPackage: false, 
          loadingPostTypes: false 
        }));
      }
    };

    loadPackageData();
  }, [property]);

  const houseRulesList = [
    { value: 'no_smoking', label: 'Không hút thuốc' },
    { value: 'no_pets', label: 'Không nuôi thú cưng' },
    { value: 'no_parties', label: 'Không tổ chức tiệc' },
    { value: 'quiet_hours', label: 'Giữ yên tĩnh sau giờ quy định' },
    { value: 'no_overnight_guests', label: 'Không có khách qua đêm' },
    { value: 'keep_clean', label: 'Giữ vệ sinh khu vực chung' },
    { value: 'remove_shoes', label: 'Cởi giày trước khi vào nhà' }
  ];


  // Handle post type selection
  const handlePostTypeSelect = (postType) => {
    setSelectedPostType(postType);
  };

  // Check if can select post type (not expired and has limit)
  const canSelectPostType = (postType) => {
    if (!selectedPackage) return false;
    
    // Check if package is expired
    const now = new Date();
    const isPackageExpired = selectedPackage.expiryDate && new Date(selectedPackage.expiryDate) < now;
    if (isPackageExpired) return false;
    
    // Check if this is the current post type (allow keeping same)
    if (originalPostType && postType.packageType?._id === originalPostType._id) {
      return true; // Luôn cho phép giữ post type hiện tại
    }
    
    // Check if has remaining limit
    const remaining = getRemainingPosts(postType);
    return remaining > 0;
  };

  // Get remaining posts for a post type
  const getRemainingPosts = (postType) => {
    if (!postType) return 0;
    
    const limit = postType.limit || 0;
    const used = postType.used || 0;
    const remaining = Math.max(0, limit - used);
    
    // Nếu đây là post type hiện tại và không có slot trống, vẫn cho phép (không tốn slot mới)
    if (originalPostType && postType.packageType?._id === originalPostType._id && remaining === 0) {
      return 1; // Giả lập có 1 slot để hiển thị
    }
    
    return remaining;
  };

  useEffect(() => {
    if (property) {
      // Process amenities - handle both populated objects and ID strings .
      const processedAmenities = property.amenities ?
        property.amenities.map(amenity => {
          const id = typeof amenity === 'object' ? amenity._id : amenity;

          return id;
        }) : [];

      // Kiểm tra xem có coordinates gốc từ DB không
      const hasValidCoordinates = property.coordinates && 
        property.coordinates.lat && 
        property.coordinates.lng &&
        property.coordinates.lat !== 16.0583 && // Không phải default coordinates
        property.coordinates.lng !== 108.2772;

      setHasOriginalCoordinates(hasValidCoordinates);
      setIsManuallyModified(false); // Reset flag khi load property mới

      console.log("Property coordinates from DB:", property.coordinates);
      console.log("Has original coordinates:", hasValidCoordinates);

      setFormData({
        title: property.title || '',
        category: property.category || 'phong_tro',
        contactName: property.contactName || '',
        contactPhone: property.contactPhone || '',
        coordinates: property.coordinates || { lat: 16.0583, lng: 108.2772 },
        description: property.description || '',
        rentPrice: property.rentPrice || '',
        promotionPrice: property.promotionPrice || '',
        deposit: property.deposit || '',
        area: property.area || '',
        electricPrice: property.electricPrice || '',
        waterPrice: property.waterPrice || '',
        maxOccupants: property.maxOccupants || '1',
        availableDate: property.availableDate ? dayjs(property.availableDate).format('YYYY-MM-DD') : '',

        // Tiện ích - Handle populated amenities (array of objects) or IDs (array of strings)
        amenities: processedAmenities,
        fullAmenities: property.fullAmenities || false,
        timeRules: property.timeRules || '',

        // Nội quy
        houseRules: property.houseRules || [],

        // Địa chỉ (theo schema mới: chỉ province và ward)
        province: property.province || '',
        provinceId: '', // Sẽ được set trong loadLocationData
        ward: property.ward || '',
        detailAddress: property.detailAddress || '',
        coordinates: property.coordinates || { lat: 16.0583, lng: 108.2772 },

        // Media
        images: property.images || [],
        video: property.video || null,
        existingImages: property.images || [], // Track existing images
        newImages: [], // Track new uploaded images
        removedImages: [], // Track removed images
        
        // Package info
        packageInfo: property.packageInfo || null,
        postType: property.packageInfo?.postType || null
      });

      // Set original post type for comparison
      if (property.packageInfo?.postType) {
        setOriginalPostType(property.packageInfo.postType);
        setSelectedPostType(property.packageInfo.postType);
      }

      // Lưu coordinates gốc vào ref để so sánh
      if (hasValidCoordinates) {
        lastCoordsRef.current = property.coordinates;
      }

      loadLocationData(property);
    }
  }, [property]);

  // Update selected post type when package data loads and we have original post type used
  useEffect(() => {
    if (packageData.userPackageInfo && originalPostType && packageData.availablePostTypes.length > 0) {
      // Find the matching post type in current package
      const matchingPostType = packageData.availablePostTypes.find(
        pt => pt.packageType?._id === originalPostType._id
      );
      if (matchingPostType) {
        setSelectedPostType(matchingPostType);
        console.log('Auto-selected current post type:', matchingPostType);
      }
    }
  }, [packageData.userPackageInfo, packageData.availablePostTypes, originalPostType]);

  // Auto-select post type from property packageInfo when component loads
  useEffect(() => {
    if (property?.packageInfo?.postType && packageData.availablePostTypes.length > 0 && !selectedPostType) {
      const currentPostTypeId = typeof property.packageInfo.postType === 'string' 
        ? property.packageInfo.postType 
        : property.packageInfo.postType._id;
      
      console.log('Current post type ID from property:', currentPostTypeId);
      
      const matchingPostType = packageData.availablePostTypes.find(
        pt => pt.packageType._id === currentPostTypeId
      );
      
      if (matchingPostType) {
        setSelectedPostType(matchingPostType);
        console.log('Auto-selected post type from property:', matchingPostType);
      } else {
        // Nếu đang sử dụng gói từ property và không tìm thấy match, tạo một post type item
        if (property.packageInfo.plan && property.packageInfo.postType) {
          const propertyPostType = {
            packageType: property.packageInfo.postType,
            limit: 999,
            used: 0
          };
          setSelectedPostType(propertyPostType);
          console.log('Auto-created post type from property info:', propertyPostType);
        }
      }
    }
  }, [property, packageData.availablePostTypes, selectedPostType]);

  const loadLocationData = async (property) => {
    try {
      // Load provinces
      setLocationData(prev => ({ ...prev, loadingProvinces: true }));
      const provinces = await locationAPI.getProvinces();
      const provincesData = provinces.data || [];

      setLocationData(prev => ({
        ...prev,
        provinces: provincesData,
        loadingProvinces: false
      }));

      // Nếu có province thì load wards (theo schema mới)
      if (property.province) {
        // Tìm provinceId từ tên province
        const provinceData = provincesData.find(p => p.name === property.province);
        if (provinceData) {
          setFormData(prev => ({ ...prev, provinceId: provinceData.code }));

          setLocationData(prev => ({ ...prev, loadingWards: true }));
          const wardsRes = await locationAPI.getWards(property.province);
          const wardsData = wardsRes.data || [];

          setLocationData(prev => ({
            ...prev,
            wards: wardsData,
            loadingWards: false
          }));

          console.log('Loaded wards for province:', property.province, wardsData);
          
          // Tự động select ward nếu property có ward
          if (property.ward && wardsData.length > 0) {
            const matchingWard = wardsData.find(w => w.name === property.ward);
            if (matchingWard) {
              console.log('Auto-selected ward:', matchingWard);
              // Ward đã được set trong formData từ trước, chỉ cần log để confirm
            } else {
              console.log('Ward not found in loaded data:', property.ward);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error loading location data:', error);
      setLocationData(prev => ({
        ...prev,
        loadingProvinces: false,
        loadingWards: false
      }));
    }
  };

  // Load wards when province changes (theo schema mới)
  useEffect(() => {
    const loadWards = async () => {
      // Sử dụng provinceId để đồng bộ với disabled condition
      if (!formData.provinceId || !formData.province) {
        setLocationData(prev => ({ ...prev, wards: [] }));
        setFormData(prev => ({ ...prev, ward: '' }));
        // Reset manual flag khi không có tỉnh
        setIsManuallyModified(false);
        return;
      }

      try {
        setLocationData(prev => ({ ...prev, loadingWards: true }));
        const wards = await locationAPI.getWards(formData.province);
        const wardsData = wards.data || [];
        
        setLocationData(prev => ({
          ...prev,
          wards: wardsData,
          loadingWards: false
        }));
        
        // Chỉ reset ward nếu ward hiện tại không tồn tại trong danh sách wards mới
        const currentWard = formData.ward;
        const wardExists = wardsData.find(w => w.name === currentWard);
        
        if (!wardExists && currentWard) {
          console.log('Current ward not found in new province, resetting:', currentWard);
          setFormData(prev => ({ ...prev, ward: '' }));
        } else if (wardExists) {
          console.log('Current ward found in new province:', currentWard);
        }
        // Reset manual flag khi thay đổi tỉnh để cho phép geocoding tự động
        setIsManuallyModified(false);
      } catch (error) {
        console.error('Error loading wards:', error);
        setLocationData(prev => ({ ...prev, loadingWards: false }));
      }
    };

    // Trigger load wards khi có đủ provinceId và province name
    if (formData.provinceId && formData.province) {
      loadWards();
    }
  }, [formData.provinceId, formData.province]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      if (name === 'fullAmenities') {
        setFormData(prev => ({
          ...prev,
          fullAmenities: checked,
          amenities: checked ? amenitiesData.amenities.map(item => item.value) : []
        }));
      } else if (name === 'amenities') {
        setFormData(prev => ({
          ...prev,
          amenities: checked
            ? [...prev.amenities, value]
            : prev.amenities.filter(item => item !== value)
        }));
      } else if (name === 'houseRules') {
        setFormData(prev => ({
          ...prev,
          houseRules: checked
            ? [...prev.houseRules, value]
            : prev.houseRules.filter(item => item !== value)
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          [name]: checked
        }));
      }
    } else {
      // Reset manual modification flag khi user thay đổi địa chỉ (theo schema mới)
      if (['detailAddress', 'province', 'ward'].includes(name)) {
        console.log("Address field changed:", name, "->", value);
        setIsManuallyModified(false);
      }

      // Xử lý province: lưu tên tỉnh (theo vietnamlabs.com API)
      if (name === 'province') {
        const selectedProvince = locationData.provinces.find(p => p.code === value);
        setFormData(prev => ({
          ...prev,
          province: selectedProvince ? selectedProvince.name : '',
          provinceId: value,
          ward: '' // Reset ward khi thay đổi tỉnh
        }));
        return;
      }

      // Xử lý ward: lưu tên ward (theo vietnamlabs.com API)
      if (name === 'ward') {
        const selectedWard = locationData.wards.find(w => w.code === value);
        setFormData(prev => ({
          ...prev,
          ward: selectedWard ? selectedWard.name : value
        }));
        return;
      }

      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };
  const getFileName = (img) => {
    if (!img) return "";
    if (typeof img === "string") {
      return img.split("/").pop(); // lấy phần sau cùng trong URL
    }
    if (img.name) return img.name; // ảnh mới (File object)
    if (img.url) return img.url.split("/").pop(); // ảnh object có url
    return "";
  };


  const ConfirmToast = ({ message, onConfirm, onCancel }) => (
    <div>
      <p>{message}</p>
      <div style={{ marginTop: "8px", display: "flex", gap: "8px" }}>
        <button
          onClick={() => {
            toast.dismiss(); // đóng toast
            onConfirm();
          }}
          style={{
            background: "#4CAF50",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Ghi đè
        </button>
        <button
          onClick={() => {
            toast.dismiss();
            onCancel();
          }}
          style={{
            background: "#f44336",
            color: "#fff",
            border: "none",
            padding: "6px 12px",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Hủy
        </button>
      </div>
    </div>
  );








  // Remove existing image
  const handleRemoveExistingImage = (index) => {
    const imageToRemove = formData.existingImages[index];
    setFormData(prev => ({
      ...prev,
      existingImages: prev.existingImages.filter((_, i) => i !== index),
      removedImages: [...prev.removedImages, imageToRemove]
    }));
  };

  // Remove new image
  const handleRemoveNewImage = (index) => {
    const imageToRemove = formData.newImages[index];

    setFormData(prev => ({
      ...prev,
      newImages: prev.newImages.filter((_, i) => i !== index)
    }));

    // Clear rejected files state và errors nếu ảnh bị remove
    if (imageToRemove) {
      setRejectedFiles(prev => ({
        ...prev,
        images: prev.images?.filter(rejected => rejected.originalname !== imageToRemove.name) || []
      }));

      // Clear error nếu không còn ảnh bị reject
      setErrors(prev => {
        const remainingRejected = rejectedFiles.images?.filter(rejected => rejected.originalname !== imageToRemove.name) || [];
        if (remainingRejected.length === 0) {
          const { newImages, ...otherErrors } = prev;
          return otherErrors;
        }
        return prev;
      });
    }
  };



  // Format date for backend
  const formatDateForBackend = (dateString) => {
    if (!dateString) return '';
    const date = dayjs(dateString);
    if (date.isValid()) {
      return date.format('DD-MM-YYYY');
    }
    return dateString;
  };


  // Hàm format số thành VNĐ style
  const formatNumber = (value) => {
    if (!value) return "";
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  // Hàm loại bỏ ký tự không phải số
  const parseNumber = (value) => {
    return value.replace(/\./g, "");
  };

  // Xử lý change
  const handlePriceChange = (e) => {
    const { name, value } = e.target;
    // bỏ dấu chấm trước khi set
    const rawValue = parseNumber(value);
    if (!/^\d*$/.test(rawValue)) return; // chỉ cho nhập số

    setFormData({
      ...formData,
      [name]: rawValue, // giữ số thực (chưa format)
    });
  };

  // Tạo full address từ các trường

  const getFullAddressPayload = async (formData, locationData) => {
    try {
      // Đơn giản hóa theo cấu trúc mới: chỉ có province và ward
      const provinceName = formData.province || "";
      const wardName = formData.ward || "";

      return {
        street: formData.detailAddress || "",
        ward: wardName,
        province: provinceName,
        country: "Vietnam"
      };
    } catch (err) {
      console.error("Error building full address payload:", err);
      return null;
    }
  };




  // Geocode address
  const geocodeAddressConst = async (addressPayload) => {
    if (!addressPayload) return null;

    try {
      setLocationData(prev => ({ ...prev, geocoding: true }));

      console.log("fullAddress payload:", addressPayload);
      const res = await locationAPI.geocodeAddress(addressPayload);
      console.log("res payload:", res);

      // Kiểm tra response từ backend
      const coords = res?.data?.coordinates;
      if (coords?.lat && coords?.lng) {
        return { lat: coords.lat, lng: coords.lng };
      }
      return null;
    } catch (err) {
      console.error("Geocoding error:", err);
      return null;
    } finally {
      setLocationData(prev => ({ ...prev, geocoding: false }));
    }
  };


  // Flag để theo dõi xem có coordinates từ DB hay không
  const [hasOriginalCoordinates, setHasOriginalCoordinates] = useState(false);
  const [isManuallyModified, setIsManuallyModified] = useState(false);

  useEffect(() => {
    if (formData.detailAddress && formData.province && formData.ward) {
      const timer = setTimeout(async () => {
        // Chỉ geocoding nếu:
        // 1. Không có coordinates gốc từ DB, HOẶC  
        // 2. Địa chỉ đã thay đổi và không phải chỉnh thủ công marker
        if (!hasOriginalCoordinates || (!isManuallyModified && formData.detailAddress !== property?.detailAddress)) {
          const addressPayload = await getFullAddressPayload(formData, locationData);
          const payloadString = JSON.stringify(addressPayload);

          if (addressPayload && payloadString !== lastAddressRef.current) {
            lastAddressRef.current = payloadString;

            console.log("Geocoding payload (Edit):", addressPayload);
            const res = await geocodeAddressConst(addressPayload);

            if (res?.lat && res?.lng) {
              lastCoordsRef.current = res;
              setFormData(prev => ({ ...prev, coordinates: res }));
              console.log("Updated coordinates from geocoding (Edit):", res);
            } else if (lastCoordsRef.current) {
              console.log("Using last valid coordinates (Edit):", lastCoordsRef.current);
              setFormData(prev => ({ ...prev, coordinates: lastCoordsRef.current }));
            } else {
              console.log("No valid coordinates, keeping current (Edit):", formData.coordinates);
            }
          }
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [formData.detailAddress, formData.ward, formData.province, locationData, hasOriginalCoordinates, isManuallyModified]);



  // Helper function để xử lý rejected files một cách đồng nhất
  const handleRejectedFiles = (rejectedFilesData, showToast = true) => {
    if (!rejectedFilesData ||
      (!rejectedFilesData.images?.length && !rejectedFilesData.videos?.length)) {
      return false; // Không có files bị reject
    }

    console.log('Files rejected - blocking update:', rejectedFilesData);
    setRejectedFiles(rejectedFilesData);

    // Chỉ hiển thị toast cho ảnh bị từ chối (theo yêu cầu user)
    if (showToast && rejectedFilesData.images?.length > 0) {
      let rejectedMessage = '';

      rejectedFilesData.images.forEach((img, index) => {
        rejectedMessage += `${index + 1}. "${img.originalname}" - ${img.reason}\n`;
      });



      // Luôn log thông tin video bị reject để debug (không toast nhưng vẫn hiển thị trong UI)
      if (rejectedFilesData.videos?.length > 0) {
        console.log('Videos rejected:', rejectedFilesData.videos.map(v => `${v.originalname}: ${v.reason}`));
      }

      toast.error(rejectedMessage.trim(), {
        position: "top-center",
        autoClose: 20000,
        hideProgressBar: false,
      });
    }

    return true; // Có files bị reject
  };

  // Hàm xử lý lỗi tập trung
  const showError = (message) => {
    toast.error(message || "Có lỗi xảy ra khi cập nhật tin đăng", {
      position: "top-center",
      autoClose: 7000,
      hideProgressBar: false,
    });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      // Validate package and post type selection
      const now = new Date();
      const isPackageExpired = selectedPackage?.expiryDate && new Date(selectedPackage.expiryDate) < now;
      
      if (!isPackageExpired && !selectedPostType) {
        toast.error("Vui lòng chọn loại tin đăng");
        setLoading(false);
        return;
      }

      // Validation data (theo schema mới: chỉ province và ward)
      const provinceData = locationData.provinces?.find(
        (p) => p.name === formData.province
      );
      const wardData = locationData.wards?.find(
        (w) => w.name === formData.ward
      );
      
      console.log('Submit validation - Province:', formData.province, 'Ward:', formData.ward);
      console.log('Available provinces:', locationData.provinces?.length);
      console.log('Available wards:', locationData.wards?.length);
      console.log('Found province:', provinceData);
      console.log('Found ward:', wardData);

      // ---- Tạo FormData ----
      const formDataToSend = new FormData();

      // Append các field text
      formDataToSend.append("title", formData.title || "");
      formDataToSend.append("contactName", formData.contactName || "");
      formDataToSend.append("contactPhone", formData.contactPhone || "");
      formDataToSend.append("description", formData.description || "");
      formDataToSend.append("rentPrice", formData.rentPrice || "");
      formDataToSend.append("promotionPrice", formData.promotionPrice || "");
      formDataToSend.append("deposit", formData.deposit || "");
      formDataToSend.append("area", formData.area || "");
      formDataToSend.append("electricPrice", formData.electricPrice || "");
      formDataToSend.append("waterPrice", formData.waterPrice || "");
      formDataToSend.append("maxOccupants", formData.maxOccupants || "");
      formDataToSend.append("timeRules", formData.timeRules || "");
      formDataToSend.append("province", formData.province || "");
      formDataToSend.append("ward", formData.ward || "");
      formDataToSend.append("detailAddress", formData.detailAddress || "");
      formDataToSend.append("availableDate", formatDateForBackend(formData.availableDate));
      formDataToSend.append("fullAmenities", formData.fullAmenities);

      // JSON stringify cho mảng
      formDataToSend.append("amenities", JSON.stringify(formData.amenities || []));
      formDataToSend.append("category", JSON.stringify(formData.category || []));
      formDataToSend.append("houseRules", JSON.stringify(formData.houseRules || []));
      formDataToSend.append("removedImages", JSON.stringify(formData.removedImages || []));

      // Append coordinates
      if (formData.coordinates) {
        formDataToSend.append("coordinates", JSON.stringify(formData.coordinates));
      }

      // Package and post type handling
      if (selectedPackage && selectedPostType) {
        // Check if this is different from original
        const isNewPostType = !originalPostType || 
          selectedPostType.packageType?._id !== originalPostType?._id;
        
        if (isNewPostType) {
          // Validate if can select this post type
          console.log('Validating new post type:', selectedPostType);
          console.log('Can select:', canSelectPostType(selectedPostType));
          console.log('Remaining posts:', getRemainingPosts(selectedPostType));
          
          if (!canSelectPostType(selectedPostType)) {
            const remaining = getRemainingPosts(selectedPostType);
            const postTypeName = selectedPostType.packageType?.displayName || 'loại tin này';
            toast.error(`Bạn đã hết lượt đăng ${postTypeName}. Còn lại: ${remaining} lượt`);
            setLoading(false);
            return;
          }
        }
        
        formDataToSend.append("packageId", selectedPackage.packageId);
        formDataToSend.append("postTypeId", selectedPostType.packageType._id);
        formDataToSend.append("isNewPostType", isNewPostType);
      }

      // Append ảnh mới (tối đa 5)
      if (formData.newImages?.length > 0) {
        formData.newImages.forEach((img) => {
          if (img.file) {
            formDataToSend.append("images", img.file);
          }
        });
      }


      // Append video (chỉ 1 file, < 50MB). Nếu có thay đổi thì gửi, không thì giữ nguyên
      if (formData.video?.file) {
        if (formData.video.file.size > 50 * 1024 * 1024) {
          toast.error("Video không được lớn hơn 50MB");
          setLoading(false);
          return;
        }
        formDataToSend.append("video", formData.video.file);
      } else if (formData.removeVideo) {
        // nếu user chọn xoá video
        formDataToSend.append("removeVideo", "true");
      }

      console.log("Existing images:", formData.newImages);
      console.log("Existing video:", formData.video);
      console.log("Payload FormData gửi lên:", Object.fromEntries(formDataToSend.entries()));

      // Hiển thị toast thông báo đang xử lý
      toast.info('Đang xử lý cập nhật tin đăng... Vui lòng đợi (có thể mất 1-2 phút do AI moderation)', {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: false,
      });

      const response = await myPropertiesAPI.updateProperty(property._id, formDataToSend);

      // Đóng toast loading
      toast.dismiss();

      console.log('Full API response:', response);
      console.log('Result success:', response.success);
      console.log('Result data:', response.data);

      if (response.success) {
        const hasRejectedFiles = handleRejectedFiles(response.data?.rejectedFiles);
        if (hasRejectedFiles) return;

        toast.success("Cập nhật tin đăng thành công!");
        onSuccess();
      } else {
        // ===== Trường hợp API trả về lỗi ====
        if (response.errors) {
          setErrors(response.errors);

          // rejectedFiles
          const hasRejectedFiles = handleRejectedFiles(response.rejectedFiles, false);
          if (hasRejectedFiles) {
            const rejectedErrors = { ...response.errors };
            if (response.rejectedFiles.images?.length > 0) {
              rejectedErrors.newImages = `${response.rejectedFiles.images.length} ảnh bị từ chối do vi phạm nội quy.`;
            }
            if (response.rejectedFiles.videos?.length > 0) {
              const videoReasons = response.rejectedFiles.videos
                .map(v => `"${v.originalname}": ${v.reason}`)
                .join('; ');
              rejectedErrors.video = `Video bị từ chối - ${videoReasons}.`;
            }
            setErrors(rejectedErrors);
          }

          showError(response.message || "");
        } else {
          showError(response.message);
        }
      }
    } catch (error) {
      console.error("Error updating property:", error);

      if (error.response) {
        const data = error.response.data;

        if (error.response.status === 400 && data.errors) {
          setErrors(data.errors);

          const hasRejectedFiles = handleRejectedFiles(data.rejectedFiles, false);
          let errorMessage = data.message || "";
          if (hasRejectedFiles && data.rejectedFiles.images?.length > 0) {
            errorMessage += "\nCó ảnh vi phạm nội quy cần thay thế.";
          }
           if (hasRejectedFiles && data.rejectedFiles.videos?.length > 0) {
            errorMessage += "\nCó video vi phạm nội quy cần thay thế.";
          }
          showError(errorMessage);
        } else {
          showError(data?.message);
        }
      } else {
        showError("Lỗi kết nối tới server");
      }
    } finally {
      setLoading(false);
    }
  };

  // Initialize TrackAsia map
  const initializeMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;

    const coordinates = formData.coordinates || defaultCenter;

    const map = new trackasiagl.Map({
      container: mapContainerRef.current,
      style: `${TRACKASIA_BASE_URL}/styles/v2/streets.json?key=${TRACKASIA_API_KEY}`,
      center: [coordinates.lng, coordinates.lat], // TrackAsia uses [lng, lat]
      zoom: 15,
      attributionControl: true,
      logoPosition: 'bottom-left'
    });

    mapRef.current = map;

    // Add navigation controls (zoom, rotate)
    map.addControl(new trackasiagl.NavigationControl(), 'top-right');

    // Add marker
    const marker = new trackasiagl.Marker({
      color: '#FF0000',
      scale: 1.2,
      draggable: true
    })
      .setLngLat([coordinates.lng, coordinates.lat])
      .addTo(map);

    markerRef.current = marker;

    // Handle marker drag events
    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      const newCoords = { lat: lngLat.lat, lng: lngLat.lng };
      console.log("Manual marker drag:", newCoords);
      setIsManuallyModified(true);
      setFormData(prev => ({
        ...prev,
        coordinates: newCoords
      }));
    });

    // Handle map click events
    map.on('click', (e) => {
      const clickedCoords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      console.log("Map clicked:", clickedCoords);
      
      setIsManuallyModified(true);
      setFormData(prev => ({
        ...prev,
        coordinates: clickedCoords
      }));

      // Update marker position
      marker.setLngLat([clickedCoords.lng, clickedCoords.lat]);
    });
  };

  // Update map when coordinates change
  const updateMapLocation = (newCoords) => {
    if (mapRef.current && markerRef.current && newCoords?.lat && newCoords?.lng) {
      const map = mapRef.current;
      const marker = markerRef.current;

      // Smooth animation to new location
      map.flyTo({
        center: [newCoords.lng, newCoords.lat],
        zoom: 15,
        duration: 1000
      });

      marker.setLngLat([newCoords.lng, newCoords.lat]);
    }
  };

  // Handle modal show/hide và TrackAsia Maps
  useEffect(() => {
    if (property) {
      // Initialize map after a short delay to ensure modal is rendered
      const timer = setTimeout(() => {
        initializeMap();
      }, 100);
      return () => clearTimeout(timer);
    }

    return () => {
      // Clean up map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, [property, formData.coordinates]);

  // Update map when coordinates change
  useEffect(() => {
    if (formData.coordinates && mapRef.current) {
      updateMapLocation(formData.coordinates);
    }
  }, [formData.coordinates]);

  // Handle modal close with cleanup
  const handleClose = () => {
    // Clean up map before closing
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    }
    onClose();
  };

  // Image upload handler with validation and compression
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const existingCount = formData.existingImages?.length || 0;
    const newCount = formData.newImages?.length || 0;

    // Kiểm tra tổng số ảnh không vượt quá 5
    if (existingCount + newCount + files.length > 5) {
      toast.error("Bạn chỉ được chọn tối đa 5 ảnh");
      e.target.value = null;
      return;
    }

    setIsProcessingFiles(true);
    
    try {
      // Validate và process files
      const processResult = await processFilesForUpload(files, (progress) => {
        console.log(`Đang xử lý ${progress.current}/${progress.total}: ${progress.fileName}`);
      });

      // Hiển thị grouped warnings và errors
      if (processResult.groupedWarnings.length > 0) {
        toast.info(processResult.groupedWarnings.join('\n'), { autoClose: 5000 });
      }

      // Nếu có lỗi, không cho upload
      if (processResult.hasErrors) {
        toast.error(processResult.groupedErrors.join('\n'));
        e.target.value = null;
        return;
      }

      const processedFiles = processResult.files;

      // Lấy danh sách tên ảnh đã có (cả ảnh cũ lẫn ảnh mới)
      const existingFileNames = [
        ...(formData.existingImages?.map(img => getFileName(img)) || []),
        ...(formData.newImages?.map(img => getFileName(img)) || [])
      ];

      const duplicateFiles = processedFiles.filter(f => existingFileNames.includes(f.name));

      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles.map(f => f.name).join(", ");

        toast.warn(
          <ConfirmToast
            message={`Ảnh ${duplicateNames} đã tồn tại. Bạn có muốn ghi đè không?`}
            onConfirm={() => {
              // Xóa ảnh trùng
              setFormData(prev => ({
                ...prev,
                existingImages: prev.existingImages?.filter(
                  img => !duplicateFiles.some(f => getFileName(img) === f.name)
                ) || [],
                newImages: prev.newImages?.filter(
                  img => !duplicateFiles.some(f => getFileName(img) === f.name)
                ) || []
              }));

              // Thêm ảnh mới đã được xử lý
              addProcessedImages(processedFiles, processResult.validationResults);
              e.target.value = null;
            }}
            onCancel={() => {
              e.target.value = null;
            }}
          />,
          { autoClose: false }
        );
        return;
      }

      // Thêm ảnh mới đã được xử lý
      addProcessedImages(processedFiles, processResult.validationResults);

    } catch (error) {
      console.error('Error processing files:', error);
      toast.error('Lỗi xử lý file: ' + error.message);
    } finally {
      setIsProcessingFiles(false);
      e.target.value = null;
    }
  };

  // Helper function to add processed images
  const addProcessedImages = (processedFiles, validationResults) => {
    const newValidations = [];
    
    processedFiles.forEach((file, index) => {
      const validation = validationResults[index];
      newValidations.push(createFilePreview(file, validation));
      
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          newImages: [
            ...(prev.newImages || []),
            { 
              file, 
              url: event.target.result, 
              name: file.name,
              originalSize: validationResults[index]?.originalSize || file.size,
              compressed: validationResults[index]?.compressed || false
            }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });

    // Update file validation state
    setFileValidation(prev => ({
      ...prev,
      images: [...prev.images, ...newValidations]
    }));
  };

  // Video upload handler with validation
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate video file
    const validation = validateFile(file);
    
    // Hiển thị lỗi nếu có
    if (!validation.isValid) {
      toast.error(validation.errors.join('\n'));
      e.target.value = null;
      return;
    }

    // Hiển thị warnings nếu có
    if (validation.warnings.length > 0) {
      toast.info(validation.warnings.join('\n'), { autoClose: 5000 });
    }

    // Nếu đã có video trùng tên
    if (formData.video && formData.video.name === file.name) {
      toast.warn(
        <ConfirmToast
          message={`Video "${file.name}" đã tồn tại. Bạn có muốn ghi đè không?`}
          onConfirm={() => {
            addVideoFile(file, validation);
          }}
          onCancel={() => {
            e.target.value = null;
          }}
        />,
        { autoClose: false }
      );
    } else {
      // Nếu chưa có video → thêm mới
      addVideoFile(file, validation);
    }

    // Reset input
    e.target.value = null;
  };

  // Helper function to add video file
  const addVideoFile = (file, validation) => {
    // Giải phóng URL cũ nếu có
    if (formData.video?.url) {
      URL.revokeObjectURL(formData.video.url);
    }

    const newUrl = URL.createObjectURL(file);

    setFormData(prev => ({
      ...prev,
      video: {
        file,
        url: newUrl,
        name: file.name,
        size: file.size,
        formattedSize: formatFileSize(file.size)
      },
      removeVideo: false
    }));

    // Update validation state
    setFileValidation(prev => ({
      ...prev,
      videos: [createFilePreview(file, validation)]
    }));
  };

  return (
    <div className="modal-overlay-edit-property" onClick={handleClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            Chỉnh sửa tin đăng</h3>
          <button className="close-btn-current-package" onClick={handleClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-content-edit-property">

             {/* Package and Post Type Selection */}
            <div className="form-group">
              <h4>Gói tin *</h4>
              
              {/* Thông tin gói hiện tại */}
              {selectedPackage && (
                <div className="current-package-info">
                  <div className="package-header-new-property">
                    <h5>
                      <i className="fa fa-info-circle"></i>
                      Gói hiện tại: <strong>{selectedPackage.displayName || selectedPackage.packageName}</strong>
                    </h5>
                    <span className="package-expiry">
                      Hết hạn: {new Date(selectedPackage.expiryDate).toLocaleDateString('vi-VN')}
                    </span>
                   
                  </div>
                </div>
              )}

              {/* Post Type Selection section */}
              {packageData.availablePostTypes && packageData.availablePostTypes.length > 0 && (
                <div className="post-type-selection">
                  <div className="form-group">
                    <h4>Loại tin đăng *</h4>
                    {(() => {
                      const now = new Date();
                      const isExpired = selectedPackage?.expiryDate && new Date(selectedPackage.expiryDate) < now;
                      return isExpired;
                    })() ? (
                      <div className="package-expired-notice">
                        <i className="fa fa-clock-o"></i>
                        <span>Vui lòng gia hạn gói để thay đổi loại tin đăng.</span>
                        <div style={{  fontSize: '14px', color: '#000000ff', fontWeight: 'bold' }}>
                          Loại tin hiện tại: <strong>
                            {originalPostType?.displayName || 'Không xác định'}
                          </strong>
                        </div>
                      </div>
                    ) : (
                      <div className="select-wrapper">
                        <select
                          name="postType"
                          value={selectedPostType?.packageType?._id || ''}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            if (selectedId) {
                              const selectedPostType = packageData.availablePostTypes.find(
                                pt => pt.packageType._id === selectedId
                              );
                              if (selectedPostType && canSelectPostType(selectedPostType)) {
                                handlePostTypeSelect(selectedPostType);
                              }
                            } else {
                              setSelectedPostType(null);
                            }
                            
                            // Clear error khi chọn
                            if (errors.postType) {
                              setErrors(prev => ({ ...prev, postType: '' }));
                            }
                          }}
                          className={`post-type-select ${errors.postType ? 'error' : ''}`}
                          style={{
                            color: selectedPostType?.packageType?.color || '#333',
                            fontWeight: selectedPostType?.packageType?.priority <= 3 ? '600' : '600',
                            fontSize: '16px'
                          }}
                        >
                          <option value="" style={{ color: '#999', fontSize: '16px !important' }}>Chọn loại tin đăng</option>
                          {packageData.availablePostTypes.map((postType, index) => {
                            const canSelect = canSelectPostType(postType);
                            const actualRemaining = Math.max(0, (postType.limit || 0) - (postType.used || 0));
                            const isCurrent = originalPostType && postType.packageType?._id === originalPostType?._id;
                            
                            // Tính số sao dựa trên priority
                            const stars = postType.packageType.priority && postType.packageType.priority <= 6 
                              ? Math.min(5 - postType.packageType.priority + 1, 5) 
                              : 0;
                            const starsText = stars > 0 ? ' ' + '★'.repeat(stars) : '';

                            // Hiển thị thông tin chi tiết
                            let displayText = `${postType.packageType.displayName}${starsText}`;
                            let statusText = '';
                            
                            if (isCurrent) {
                              statusText = ' - Hiện tại';
                            } else if (actualRemaining > 0) {
                              statusText = ` (${actualRemaining} còn lại)`;
                            } else {
                              statusText = ' - Hết lượt';
                            }

                            return (
                              <option
                                key={index}
                                value={postType.packageType._id}
                                disabled={!canSelect}
                                style={{
                                  color: !canSelect ? '#ccc' : (postType.packageType.color || '#333'),
                                  fontWeight: stars > 0 ? '600' : '600',
                                  backgroundColor: !canSelect ? '#f5f5f5' : 'white'
                                }}
                              >
                                {displayText}{statusText}
                              </option>
                            );
                          })}
                        </select>
                       
                      </div>
                    )}
                    
                    {errors.postType && <span className="error-text">{errors.postType}</span>}
                  </div>
                </div>
              )}

              {/* Loading states */}
              {packageData.loadingPackage && (
                <div style={{ textAlign: 'center', padding: '20px' }}>
                  <i className="fa fa-spinner fa-spin"></i> Đang tải thông tin gói...
                </div>
              )}
            </div>

            {/* Thông tin chủ nhà */}
            <div className="form-section">
              <h4>Thông tin chủ nhà</h4>

              <div className="form-group">
                <label>Tiêu đề *</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title || ''}
                  onChange={handleInputChange}
                  className={errors.title ? 'error' : ''}
                />
                {errors.title && <span className="error-text">{errors.title}</span>}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Danh mục thuê *</label>
                  <select
                    name="category"
                    value={formData.category || 'phong_tro'}
                    onChange={handleInputChange}
                    className={errors.category ? 'error' : ''}
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {errors.category && <span className="error-text">{errors.category}</span>}
                </div>

                <div className="form-group">
                  <label>Tên người liên hệ *</label>
                  <input
                    type="text"
                    name="contactName"
                    value={formData.contactName || ''}
                    onChange={handleInputChange}
                    className={errors.contactName ? 'error' : ''}
                  />
                  {errors.contactName && <span className="error-text">{errors.contactName}</span>}
                </div>
              </div>

              <div className="form-group">
                <label>Số điện thoại *</label>
                <input
                  type="tel"
                  name="contactPhone"
                  value={formData.contactPhone || ''}
                  onChange={handleInputChange}
                  placeholder="VD: 0123456789"
                  className={errors.contactPhone ? 'error' : ''}
                />
                {errors.contactPhone && <span className="error-text">{errors.contactPhone}</span>}
              </div>

              <div className="form-group">
                <label>Mô tả *</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  rows="4"
                  className={errors.description ? 'error' : ''}
                />
                {errors.description && <span className="error-text">{errors.description}</span>}
              </div>
            </div>

           

            {/* Thông tin cơ bản & giá */}
            <div className="form-section">
              <h4>Thông tin cơ bản & giá</h4>

              <div className="form-row">
                <div className="form-group">
                  <label>Giá thuê (VNĐ/tháng) *</label>
                  <input
                    type="text"
                    name="rentPrice"
                    value={formatNumber(formData.rentPrice) || ''}
                    onChange={handlePriceChange}
                    className={errors.rentPrice ? 'error' : ''}
                  />
                  {errors.rentPrice && <span className="error-text">{errors.rentPrice}</span>}
                </div>

                <div className="form-group">
                  <label>Giá khuyến mãi (VNĐ/tháng)</label>
                  <input
                    type="text"
                    name="promotionPrice"
                    value={formatNumber(formData.promotionPrice) || ''}
                    onChange={handlePriceChange}
                    className={errors.promotionPrice ? 'error' : ''}
                  />
                  {errors.promotionPrice && <span className="error-text">{errors.promotionPrice}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tiền cọc (VNĐ)</label>
                  <input
                    type="text"
                    name="deposit"
                    value={formatNumber(formData.deposit) || ''}
                    onChange={handlePriceChange}
                    className={errors.deposit ? 'error' : ''}
                  />
                  {errors.deposit && <span className="error-text">{errors.deposit}</span>}
                </div>

                <div className="form-group">
                  <label>Diện tích (m²) *</label>
                  <input
                    type="number"
                    name="area"
                    value={formData.area || ''}
                    onChange={handleInputChange}
                    className={errors.area ? 'error' : ''}
                  />
                  {errors.area && <span className="error-text">{errors.area}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Giá điện (VNĐ/kWh)</label>
                  <input
                    type="text"
                    name="electricPrice"
                    value={formatNumber(formData.electricPrice) || ''}
                    onChange={handlePriceChange}
                    className={errors.electricPrice ? 'error' : ''}
                  />
                  {errors.electricPrice && <span className="error-text">{errors.electricPrice}</span>}
                </div>

                <div className="form-group">
                  <label>Giá nước (VNĐ/m³)</label>
                  <input
                    type="text"
                    name="waterPrice"
                    value={formatNumber(formData.waterPrice) || ''}
                    onChange={handlePriceChange}
                    className={errors.waterPrice ? 'error' : ''}
                  />
                  {errors.waterPrice && <span className="error-text">{errors.waterPrice}</span>}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Tối đa người ở</label>
                  <select
                    name="maxOccupants"
                    value={formData.maxOccupants || '1'}
                    onChange={handleInputChange}
                  >
                    {maxOccupantsOptions.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Ngày có thể vào ở</label>
                  <input
                    type="date"
                    name="availableDate"
                    value={formData.availableDate || ''}
                    onChange={handleInputChange}
                    min={dayjs().format('YYYY-MM-DD')}
                    className={errors.availableDate ? 'error' : ''}
                  />
                  {errors.availableDate && <span className="error-text">{errors.availableDate}</span>}
                </div>
              </div>
            </div>

            {/* Tiện ích */}
            <div className="form-section">
              <h4>Tiện ích cho thuê</h4>

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    name="fullAmenities"
                    checked={formData.fullAmenities || false}
                    onChange={handleInputChange}
                  />
                  <span className='full-amenities-span'>Full tiện ích</span>
                </label>

              </div>

              <div className="amenities-grid">
                {amenitiesData.loading && (
                  <div className="loading-amenities">
                    <i className="fa fa-spinner fa-spin"></i> Đang tải tiện ích...
                  </div>
                )}

                {amenitiesData.error && (
                  <div className="error-amenities">
                    <i className="fa fa-exclamation-triangle"></i> {amenitiesData.error}
                  </div>
                )}

                {!amenitiesData.loading && !amenitiesData.error && amenitiesData.amenities.map((amenity) => {
                  const isChecked = formData.amenities?.includes(amenity.value) || false;


                  return (
                    <label
                      key={amenity.value}
                      className={`amenity-item ${formData.fullAmenities ? "disabled" : ""}`}
                    >
                      <input
                        type="checkbox"
                        name="amenities"
                        value={amenity.value}
                        checked={isChecked}
                        onChange={handleInputChange}
                        disabled={formData.fullAmenities}
                      />
                      {amenity.icon && <i className={amenity.icon}></i>}
                      <span className="amenity-text">{amenity.label}</span>
                    </label>
                  );
                })}
              </div>
              {errors.amenities && <span className="error-text">{errors.amenities}</span>}

              <div className="form-section">
                <h4>Quy định giờ giấc</h4>
                <textarea
                  name="timeRules"
                  value={formData.timeRules || ''}
                  onChange={handleInputChange}
                  rows="3"
                />
              </div>
              {errors.timeRules && <span className="error-text">{errors.timeRules}</span>}
            </div>

            {/* Nội quy */}
            <div className="form-section">
              <h4>Nội quy</h4>
              <div className="house-rules-grid">
                {houseRulesList.map(rule => (
                  <label key={rule.value}>
                    <input
                      type="checkbox"
                      name="houseRules"
                      value={rule.value}
                      checked={formData.houseRules?.includes(rule.value) || false}
                      onChange={handleInputChange}
                    />
                    {rule.label}
                  </label>
                ))}
              </div>
              {errors.houseRules && <span className="error-text">{errors.houseRules}</span>}
            </div>

            {/* Địa chỉ */}
            <div className="form-section">
              <h4>Địa chỉ</h4>

              <div className="form-row">
                <div className="form-group">
                  <label>Tỉnh/Thành phố *</label>
                  <select
                    name="province"
                    value={formData.provinceId || ''}
                    onChange={handleInputChange}
                    className={errors.province ? 'error' : ''}
                    disabled={locationData.loadingProvinces}
                  >
                    <option value="">
                      {locationData.loadingProvinces ? 'Đang tải...' : 'Chọn tỉnh/thành phố'}
                    </option>
                    {locationData.provinces.map(province => (
                      <option key={province.code} value={province.code}>
                        {province.name}
                      </option>
                    ))}
                  </select>
                  {errors.province && <span className="error-text">{errors.province}</span>}
                </div>

                <div className="form-group">
                  <label>Phường/Xã *</label>
                  <select
                    name="ward"
                    value={(() => {
                      const matchingWard = locationData.wards.find(w => w.name === formData.ward);
                      console.log('Ward selection - formData.ward:', formData.ward);
                      console.log('Available wards:', locationData.wards.map(w => w.name));
                      console.log('Matching ward:', matchingWard);
                      return matchingWard?.code || '';
                    })()}
                    onChange={handleInputChange}
                    className={errors.ward ? 'error' : ''}
                    disabled={locationData.loadingWards || !formData.provinceId || !formData.province}
                  >
                    <option value="">
                      {locationData.loadingWards ? 'Đang tải...' :
                        (!formData.provinceId || !formData.province) ? 'Chọn tỉnh trước' : 'Chọn phường/xã'}
                    </option>
                    {locationData.wards.map(ward => (
                      <option
                        key={ward.code}
                        value={ward.code}
                        title={ward.mergedFrom && ward.mergedFrom.length > 1
                          ? `Trước sáp nhập: ${ward.mergedFrom.join(', ')}`
                          : ''
                        }
                        className={ward.mergedFrom && ward.mergedFrom.length > 1 ? 'ward-option-merged' : ''}
                      >
                        {ward.name}
                        {ward.mergedFrom && ward.mergedFrom.length > 1 && ' 🔄'}
                      </option>
                    ))}
                  </select>
                  {errors.ward && <span className="error-text">{errors.ward}</span>}
                </div>
              </div>

              {/* Hiển thị thông tin merged cho ward đã chọn */}
              {formData.ward && (() => {
                const selectedWard = locationData.wards.find(w => w.name === formData.ward);
                if (selectedWard && selectedWard.mergedFrom && selectedWard.mergedFrom.length > 1) {
                  return (
                    <div className="ward-merged-info" style={{ marginBottom: '15px' }}>
                      <small className="merged-from-text">
                        <i className="fa fa-info-circle"></i>
                        <strong>Từ:</strong> {selectedWard.mergedFrom.join(', ')}
                      </small>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="form-row full-width">
                <div className="form-group">
                  <label>Địa chỉ chi tiết *</label>
                  <input
                    type="text"
                    name="detailAddress"
                    value={formData.detailAddress || ''}
                    onChange={handleInputChange}
                    placeholder="VD: Hẻm 566 Nguyễn Thái Sơn"
                    className={errors.detailAddress ? 'error' : ''}
                  />
                  {errors.detailAddress && <span className="error-text">{errors.detailAddress}</span>}
                </div>
              </div>

              {/* TrackAsia Map */}
              <div className="form-group">
                <h4>Vị trí trên bản đồ</h4>
                <div className="coordinates-info">
                  <div className="coordinate-display">
                    <div className="coordinate-item">
                      <i className="fa fa-map-marker"></i>
                      <span>Vĩ độ: <strong>{formData.coordinates?.lat?.toFixed(6) || 'N/A'}</strong></span>
                    </div>
                    <div className="coordinate-item">
                      <i className="fa fa-compass"></i>
                      <span>Kinh độ: <strong>{formData.coordinates?.lng?.toFixed(6) || 'N/A'}</strong></span>
                    </div>
                    <div className="coordinate-item">
                      <i className={`fa ${isManuallyModified ? 'fa-hand' : 'fa-magic'}`} style={{ color: isManuallyModified ? '#007bff' : '#007bff' }}></i>
                      <span>Trạng thái: <strong style={{ color: isManuallyModified ? '#28a745' : '#007bff' }}>
                        {isManuallyModified ? 'Đã chỉnh thủ công' : 'Tự động geocoding'}
                      </strong></span>
                    </div>
                  </div>
                  <p className="address-hint">💡 Nhấp vào bản đồ hoặc kéo marker để chọn vị trí chính xác</p>
                </div>

                <div
                  ref={mapContainerRef}
                  className="trackasia-map-container"
                  style={{
                    height: '250px',
                    width: '100%'
                  }}
                />
              </div>
            </div>

            {/* Hình ảnh và video */}
            <div className="form-section">
              <h4>Hình ảnh và video</h4>

              <div className="form-group">
                <label>Hình ảnh hiện tại</label>
                {formData.existingImages?.length > 0 && (
                  <div className="image-preview-grid">
                    {formData.existingImages.map((img, index) => {
                      // Kiểm tra xem ảnh này có bị từ chối không (dựa trên URL)
                      const isRejected = rejectedFiles.images?.some(rejected =>
                        rejected.url === img || rejected.originalname === img
                      );
                      const rejectedInfo = rejectedFiles.images?.find(rejected =>
                        rejected.url === img || rejected.originalname === img
                      );

                      return (
                        <div key={index} className={`image-preview ${isRejected ? 'rejected' : ''}`}>
                          <img
                            src={img}
                            alt={`Existing ${index}`}
                            style={{
                              filter: isRejected ? 'blur(3px) grayscale(50%) opacity(0.6)' : 'none',
                              transition: 'filter 0.3s ease'
                            }}
                          />
                          {isRejected && (
                            <div className="rejection-overlay">
                              <div className="rejection-icon">⚠️</div>
                              <div className="rejection-text">Bị từ chối</div>
                              <div className="rejection-reason">{rejectedInfo?.reason}</div>
                            </div>
                          )}
                          <button
                            type="button"
                            className="remove-image-new-property"
                            onClick={() => handleRemoveExistingImage(index)}
                          >
                            <i className="fa fa-times"></i>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>

              <div className="form-group">
                <label>Thêm hình ảnh mới</label>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  disabled={isProcessingFiles}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFiles}
                >
                  {isProcessingFiles ? (
                    <>
                      <i className="fa fa-spinner fa-spin"></i>
                      Đang xử lý ảnh...
                    </>
                  ) : (
                    <>
                      <i className="fa fa-upload"></i>
                      Chọn hình ảnh
                    </>
                  )}
                </button>

                {formData.newImages?.length > 0 && (
                  <div className="image-preview-grid" style={{ marginTop: '10px' }}>
                    {formData.newImages.map((img, index) => {
                      // Kiểm tra xem ảnh này có bị từ chối không
                      const isRejected = rejectedFiles.images?.some(rejected => rejected.originalname === img.name);
                      const rejectedInfo = rejectedFiles.images?.find(rejected => rejected.originalname === img.name);

                      return (
                        <div key={index} className={`image-preview ${isRejected ? 'rejected' : ''}`}>
                          <img
                            src={img.url}
                            alt={`New ${index}`}
                            style={{
                              filter: isRejected ? 'blur(3px) grayscale(50%) opacity(0.6)' : 'none',
                              transition: 'filter 0.3s ease'
                            }}
                          />
                          {isRejected && (
                            <div className="rejection-overlay">
                              <div className="rejection-icon">⚠️</div>
                              <div className="rejection-text">Bị từ chối</div>
                              <div className="rejection-reason">{rejectedInfo?.reason}</div>
                            </div>
                          )}
                          <button
                            type="button"
                            className="remove-image-new-property"
                            onClick={() => {
                              handleRemoveNewImage(index);
                              // Xóa validation info tương ứng
                              setFileValidation(prev => ({
                                ...prev,
                                images: prev.images.filter((_, i) => i !== index)
                              }));
                              // Xóa khỏi rejected files nếu có
                              if (isRejected) {
                                setRejectedFiles(prev => ({
                                  ...prev,
                                  images: prev.images.filter(rejected => rejected.originalname !== img.name)
                                }));
                              }
                            }}
                          >
                            <i className="fa fa-times"></i>
                          </button>

                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Hiển thị lỗi ảnh mới nếu có */}
                {errors.newImages && <span className="error-text">{errors.newImages}</span>}
              </div>

              <div className="form-group" style={{ position: "relative" }}>
                <label>Video</label>

                {formData.video && (() => {
                  const videoName = formData.video.name || formData.video.file?.name || 'video';
                  const isRejected = rejectedFiles.videos?.some(rejected => rejected.originalname === videoName);
                  const rejectedInfo = rejectedFiles.videos?.find(rejected => rejected.originalname === videoName);

                  return (
                    <div
                      className={`video-preview ${isRejected ? 'rejected' : ''}`}
                      style={{
                        marginBottom: "10px",
                        position: "relative",
                        display: "inline-block",
                      }}
                    >
                      <video
                        key={formData.video?.url}
                        controls
                        style={{
                          maxWidth: "200px",
                          height: "auto",
                          filter: isRejected ? 'blur(3px) grayscale(50%) opacity(0.6)' : 'none',
                          transition: 'filter 0.3s ease'
                        }}
                      >
                        <source
                          src={typeof formData.video === "string" ? formData.video : formData.video.url}
                          type={formData.video.file?.type || "video/mp4"}
                        />
                      </video>

                      {isRejected && (
                        <div className="rejection-overlay" style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(201, 42, 42, 0.8)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          color: 'white',
                          fontWeight: 'bold',
                          borderRadius: '4px',
                          maxWidth: '200px'
                        }}>
                          <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚠️</div>
                          <div style={{ fontSize: '12px', textTransform: 'uppercase' }}>Bị từ chối</div>
                          <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'center', padding: '0 8px' }}>{rejectedInfo?.reason}</div>
                        </div>
                      )}

                      {/* Nút Xóa video ở góc phải */}
                      <button
                        type="button"
                        className="remove-video"
                        style={{
                          position: "absolute",
                          top: "5px",
                          right: "5px",
                          borderRadius: "50%",
                          width: "40px",
                          height: "40px",
                          padding: 0,
                          alignItems: "center",
                        }}
                        onClick={() => {
                          const videoNameToRemove = formData.video?.name || formData.video?.file?.name;

                          setFormData((prev) => ({
                            ...prev,
                            video: null,
                            removeVideo: true, // gửi flag cho backend
                          }));

                          // Clear validation info
                          setFileValidation(prev => ({
                            ...prev,
                            videos: []
                          }));

                          // Clear rejected files và errors cho video
                          setRejectedFiles(prev => ({
                            ...prev,
                            videos: prev.videos?.filter(rejected => rejected.originalname !== videoNameToRemove) || []
                          }));

                          // Clear video error nếu không còn video bị reject
                          setErrors(prev => {
                            const remainingRejectedVideos = rejectedFiles.videos?.filter(rejected => rejected.originalname !== videoNameToRemove) || [];
                            if (remainingRejectedVideos.length === 0) {
                              const { video, ...otherErrors } = prev;
                              return otherErrors;
                            }
                            return prev;
                          });
                        }}
                      >
                        <i className="fa fa-times" style={{ fontSize: "20px", alignItems: "center", marginLeft: "5px" }}></i>
                      </button>

                      {/* Video validation info */}
                      {fileValidation.videos.length > 0 && fileValidation.videos[0] && (
                        <div className={`file-validation-info ${
                          fileValidation.videos[0].validation.errors.length > 0 ? 'has-errors' : 
                          fileValidation.videos[0].validation.warnings.length > 0 ? 'has-warnings' : ''
                        }`} style={{ marginTop: '10px' }}>
                          
                          {fileValidation.videos[0].validation.warnings.map((warning, wIndex) => (
                            <div key={wIndex} className="validation-message">
                              <i className="fa fa-exclamation-triangle"></i>
                              {warning}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Nút chọn video (luôn hiển thị) */}
                <input
                  type="file"
                  ref={videoInputRef}
                  onChange={handleVideoUpload}
                  accept="video/*"
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <i className="fa fa-video-camera"></i>{" "}
                  {formData.video ? "Thay đổi video" : "Chọn video"}
                </button>

                {/* Hiển thị lỗi video nếu có */}
                {errors.video && <span className="error-text">{errors.video}</span>}
              </div>


            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
            >
              Hủy
            </button>
            <button
              type="submit"
              className={`btn btn-primary ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              <i className="fa fa-save"></i>
              {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


export default EditPropertyModal;