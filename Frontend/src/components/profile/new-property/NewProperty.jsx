import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { toast } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";

import { postAPI } from '../../../services/propertiesAPI';
import { locationAPI } from '../../../services/locationAPI';
import amenitiesAPI from '../../../services/amenitiesAPI';
import userPackageAPI from '../../../services/userPackageAPI';
import { processFilesForUpload, validateFileWithDimensions, formatFileSize, createFilePreview } from '../../../utils/fileUtils';
import './../ProfilePages.css';
import './NewProperty.css';
import './DirectionsPanel.css';
import './RejectedFiles.css';
import './PackagePostTypeSelector.css';
import './TrackAsiaMap.css';
import './FileValidation.css';

import trackasiagl from 'trackasia-gl';
import '@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css';
import 'trackasia-gl/dist/trackasia-gl.css';


// TrackAsia GL JS configuration
// No need for icon configuration as TrackAsia uses built-in markers

//Gửi object address đến backend để geocode
const geocodeAddress = async (addressObject) => {

  try {
    const res = await locationAPI.geocodeAddress(addressObject);
    // console.log("Geocode via backend:", res.data);

    if (res.data && res.data.coordinates && res.data.coordinates.lat && res.data.coordinates.lng) {
      return { lat: res.data.coordinates.lat, lng: res.data.coordinates.lng };
    }
    return null;
  } catch (error) {
    console.error("Geocode error (frontend):", error);
    return null;
  }
};

const NewProperty = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const lastAddressRef = useRef("");

  // Ref để nhớ toạ độ cuối cùng hợp lệ
  const lastCoordsRef = useRef(null);
  // Ref để theo dõi xem coordinates có được set thủ công không
  const isManuallySetRef = useRef(false);
  // Ref để lưu tọa độ thủ công
  const manualCoordsRef = useRef(null);
  // Ref cho TrackAsia map
  const mapRef = useRef(null);
  const mapContainerRef = useRef(null);
  const markerRef = useRef(null);
  const directionsRef = useRef(null);
  const currentLocationMarkerRef = useRef(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);

  // Cấu hình dayjs
  dayjs.extend(relativeTime);
  dayjs.locale("vi");


  // TrackAsia API configuration
  const TRACKASIA_API_KEY = process.env.REACT_APP_TRACKASIA_API_KEY || 'public_key';
  const TRACKASIA_BASE_URL = 'https://maps.track-asia.com';


  const defaultCenter = {
    lat: 16.056204,
    lng: 108.168202
  };


  // Form state
  const [formData, setFormData] = useState({
    // Thông tin chủ nhà
    title: '',
    category: 'phong_tro',
    contactName: '',
    contactPhone: '',
    description: '',

    // Thông tin cơ bản & giá
    rentPrice: '',
    promotionPrice: '',
    deposit: '',
    area: '',
    electricPrice: '',
    waterPrice: '',
    maxOccupants: '1',
    availableDate: '',

    // Tiện ích
    amenities: [],
    fullAmenities: false,
    timeRules: '',

    // Nội quy
    houseRules: [],

    // Địa chỉ (đồng bộ với Property schema mới)
    province: '',
    provinceId: '',
    ward: '',
    detailAddress: '',
    coordinates: defaultCenter,

    // Media
    images: [],
    video: null,

    // Package & Post Type
    postType: '',

    // Trạng thái
    isForRent: true
  });

  const [errors, setErrors] = useState({});
  const [rejectedFiles, setRejectedFiles] = useState({ images: [], videos: [] });
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File validation states
  const [fileValidation, setFileValidation] = useState({ images: [], videos: [] });
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isManuallySet, setIsManuallySet] = useState(false);

  // Location data from API (cập nhật cho cấu trúc mới)
  const [locationData, setLocationData] = useState({
    provinces: [],
    wards: [],
    loadingProvinces: false,
    loadingWards: false,
    geocoding: false
  });

  // Amenities data from API
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);

  // Package data
  const [packageInfo, setPackageInfo] = useState(null);
  const [availablePostTypes, setAvailablePostTypes] = useState([]);
  const [loadingPackage, setLoadingPackage] = useState(false);

  // Directions panel state
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  const [directionsOrigin, setDirectionsOrigin] = useState('');
  const [directionsDestination, setDirectionsDestination] = useState('');
  const [routeInfo, setRouteInfo] = useState(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [isGettingCurrentLocation, setIsGettingCurrentLocation] = useState(false);



  // Helper function to find file by name
  const findFileByName = (filename, fileList) => {
    return fileList.find(file => file.name === filename);
  };


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

  const houseRulesList = [
    { value: 'no_smoking', label: 'Không hút thuốc' },
    { value: 'no_pets', label: 'Không nuôi thú cưng' },
    { value: 'no_parties', label: 'Không tổ chức tiệc' },
    { value: 'quiet_hours', label: 'Giữ yên tĩnh sau giờ quy định' },
    { value: 'no_overnight_guests', label: 'Không có khách qua đêm' },
    { value: 'keep_clean', label: 'Giữ vệ sinh khu vực chung' },
    { value: 'remove_shoes', label: 'Cởi giày trước khi vào nhà' }
  ];





  // Show toast when there are media errors (images or videos)
  useEffect(() => {
    let errorMessage = '';

    if (errors.images) {
      errorMessage += errors.images;
    }

    if (errors.video) {
      if (errorMessage) {
        errorMessage += '\n\n' + errors.video;
      } else {
        errorMessage = errors.video;
      }
    }

    if (errorMessage) {
      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 10000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    }
  }, [errors.images, errors.video]);

  // Load package data from API
  useEffect(() => {
    loadPackageData();
  }, []);



  const loadPackageData = async () => {
    try {
      setLoadingPackage(true);

      // Lấy thông tin gói hiện tại
      const packageResponse = await userPackageAPI.getCurrentPackage();
      console.log("Current package response:", packageResponse);
      if (packageResponse.success) {
        setPackageInfo(packageResponse.data);
      }

      // Lấy danh sách loại tin có thể đăng
      const postTypesResponse = await userPackageAPI.getAvailablePostTypes();
      console.log("Available post types response:", postTypesResponse);
      if (postTypesResponse.success) {
        setAvailablePostTypes(postTypesResponse.data);
      }

    } catch (error) {
      console.error('Error loading package data:', error);
      toast.error('Không thể tải thông tin gói tin');
    } finally {
      setLoadingPackage(false);
    }
  };

  // Load amenities from API
  useEffect(() => {
    const loadAmenities = async () => {
      try {
        setLoadingAmenities(true);
        const response = await amenitiesAPI.getAllAmenities();

        if (response.success) {
          // Check if data is array or if data is nested
          const amenitiesData = Array.isArray(response.data)
            ? response.data
            : Array.isArray(response.data.amenities)
              ? response.data.amenities
              : [];

          // Transform data to match the expected format
          const transformedAmenities = amenitiesData.map(amenity => ({
            value: amenity._id,
            label: amenity.name,
            icon: amenity.icon
          }));


          setAmenitiesList(transformedAmenities);
        } else {
          console.error('API response not successful:', response);
          toast.error('Không thể tải danh sách tiện ích');
        }
      } catch (error) {
        console.error('Error loading amenities:', error);
        toast.error('Không thể tải danh sách tiện ích');
      } finally {
        setLoadingAmenities(false);
      }
    };

    loadAmenities();
  }, []);

  // Handle modal show/hide và TrackAsia Maps
  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open');
      // Initialize map after modal is rendered - increased delay to 1s to ensure DOM is fully ready
      const timer = setTimeout(() => {
        initializeMap();
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      document.body.classList.remove('modal-open');
      // Clean up map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        directionsRef.current = null;
        currentLocationMarkerRef.current = null;
      }
    }

    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showModal]);

  // Update map when coordinates change
  useEffect(() => {
    if (formData.coordinates && mapRef.current) {
      updateMapLocation(formData.coordinates);
    }
  }, [formData.coordinates]);

  // Load provinces when component mounts
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        setLocationData(prev => ({ ...prev, loadingProvinces: true }));
        const provinces = await locationAPI.getProvinces();
        console.log('Loaded provinces:', provinces);

        setLocationData(prev => ({
          ...prev,
          provinces: provinces.data || [],
          loadingProvinces: false
        }));
      } catch (error) {
        console.error('Error loading provinces:', error);
        setLocationData(prev => ({ ...prev, loadingProvinces: false }));
      }
    };

    loadProvinces();
  }, []);

  // Load wards when province changes (cập nhật cho cấu trúc mới)
  useEffect(() => {
    const loadWards = async () => {
      if (!formData.province || !formData.provinceId) {
        setLocationData(prev => ({ ...prev, wards: [] }));
        setFormData(prev => ({ ...prev, ward: '' }));
        // Reset manual flag khi không có tỉnh
        isManuallySetRef.current = false;
        setIsManuallySet(false);
        manualCoordsRef.current = null;
        return;
      }

      try {
        setLocationData(prev => ({ ...prev, loadingWards: true }));
        // Sử dụng tên tỉnh để load wards (theo vietnamlabs.com API)
        const wards = await locationAPI.getWards(formData.province);
        setLocationData(prev => ({
          ...prev,
          wards: wards.data || [],
          loadingWards: false
        }));
        setFormData(prev => ({ ...prev, ward: '' }));
        // Reset manual flag khi thay đổi tỉnh để cho phép geocoding tự động
        isManuallySetRef.current = false;
        setIsManuallySet(false);
        manualCoordsRef.current = null;
      } catch (error) {
        console.error('Error loading wards:', error);
        setLocationData(prev => ({ ...prev, loadingWards: false }));
      }
    };

    loadWards();
  }, [formData.province, formData.provinceId]);



  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      if (name === 'fullAmenities') {
        setFormData(prev => ({
          ...prev,
          fullAmenities: checked,
          amenities: checked ? amenitiesList.map(item => item.value) : []
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
    } else if (name === 'availableDate') {
      if (value) {
        const inputDate = dayjs(value);
        const today = dayjs();

        if (inputDate.isBefore(today, 'day')) {
          setErrors(prev => ({
            ...prev,
            [name]: 'Ngày không được nhỏ hơn ngày hiện tại'
          }));
        } else {
          setErrors(prev => ({
            ...prev,
            [name]: ''
          }));
        }
      }

      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    } else if (name === 'province') {
      // Khi chọn tỉnh, lưu cả tên và ID
      const selectedProvince = locationData.provinces.find(p => p.code === value);
      setFormData(prev => ({
        ...prev,
        province: selectedProvince ? selectedProvince.name : '',
        provinceId: value,
        ward: '' // Reset ward khi thay đổi tỉnh
      }));
    } else if (name === 'ward') {
      // Khi chọn ward, lưu tên ward (theo Property schema)
      const selectedWard = locationData.wards.find(w => w.code === value);
      setFormData(prev => ({
        ...prev,
        ward: selectedWard ? selectedWard.name : value
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

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



  // --- Auto-update coordinates when address changes ---
  useEffect(() => {
    if (formData.detailAddress && formData.province && formData.ward) {
      const timer = setTimeout(async () => {
        const addressPayload = await getFullAddressPayload(formData, locationData);

        const payloadString = JSON.stringify(addressPayload);

        if (addressPayload && payloadString !== lastAddressRef.current) {
          lastAddressRef.current = payloadString;

          console.log("Geocoding payload:", addressPayload);
          const coords = await geocodeAddress(addressPayload);
          console.log("Geocoded coords:", coords);

          // Chỉ cập nhật coordinates nếu chưa được set thủ công
          if (coords && coords.lat && coords.lng && !isManuallySetRef.current) {
            lastCoordsRef.current = coords;
            setFormData(prev => ({
              ...prev,
              coordinates: coords
            }));
            console.log("Updated coordinates from geocoding:", coords);
          } else if (lastCoordsRef.current && !isManuallySetRef.current) {
            console.log("Using last valid coordinates:", lastCoordsRef.current);
            setFormData(prev => ({
              ...prev,
              coordinates: lastCoordsRef.current
            }));
          } else if (isManuallySetRef.current) {
            console.log("Coordinates manually set, skipping geocoding update");
          } else {
            console.log("No valid coordinates, keeping current:", formData.coordinates);
            // Không cập nhật coordinates nếu không có coords hợp lệ
          }
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [formData.detailAddress, formData.ward, formData.province, locationData]);





  // Convert date format for backend
  const formatDateForBackend = (dateString) => {
    if (!dateString) return '';
    const date = dayjs(dateString);
    if (date.isValid()) {
      return date.format('DD-MM-YYYY');
    }
    return dateString;
  };

  // Component confirm toast
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




  // Image upload handler với validation và compression
  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);

    // kiểm tra tổng ảnh
    if (formData.images.length + files.length > 5) {
      toast.error("Bạn chỉ được chọn tối đa 5 ảnh.");
      e.target.value = null;
      return;
    }

    setIsProcessingFiles(true);

    try {
      // Validate và process files
      const processResult = await processFilesForUpload(files, (progress) => {
        // Có thể hiển thị progress nếu cần
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

      // Kiểm tra file trùng lặp
      const processedFiles = processResult.files;
      const existingFileNames = formData.images.map(img => img.name);
      const duplicateFiles = processedFiles.filter(f => existingFileNames.includes(f.name));

      if (duplicateFiles.length > 0) {
        const duplicateNames = duplicateFiles.map(f => f.name).join(", ");

        toast.warn(
          <ConfirmToast
            message={`Ảnh ${duplicateNames} đã tồn tại. Bạn có muốn ghi đè không?`}
            onConfirm={() => {
              // Xóa ảnh trùng trước
              setFormData(prev => ({
                ...prev,
                images: prev.images.filter(
                  img => !duplicateFiles.some(f => f.name === img.name)
                ),
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

      // Clear lỗi và rejected files
      if (errors.images) {
        setErrors(prev => ({ ...prev, images: '' }));
      }
      if (rejectedFiles.images?.length > 0) {
        setRejectedFiles(prev => ({ ...prev, images: [] }));
      }

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
          images: [...prev.images, {
            file,
            url: event.target.result,
            name: file.name,
            originalSize: validationResults[index]?.originalSize || file.size,
            compressed: validationResults[index]?.compressed || false
          }]
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




  // Video upload handler với validation
  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate video file with comprehensive validation
    const validation = await validateFileWithDimensions(file);

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

    // Clear lỗi và rejected files
    if (errors.video) {
      setErrors(prev => ({ ...prev, video: '' }));
    }
    if (rejectedFiles.videos?.length > 0) {
      setRejectedFiles(prev => ({ ...prev, videos: [] }));
    }
  };

  // Helper function to add video file
  const addVideoFile = (file, validation) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData(prev => ({
        ...prev,
        video: {
          file,
          url: event.target.result,
          name: file.name,
          size: file.size,
          formattedSize: formatFileSize(file.size)
        }
      }));
    };
    reader.readAsDataURL(file);

    // Update validation state
    setFileValidation(prev => ({
      ...prev,
      videos: [createFilePreview(file, validation)]
    }));
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

  // Package helper functions
  const handlePostTypeSelect = (postTypeId) => {
    if (!postTypeId) {
      setFormData(prev => ({ ...prev, postType: '' }));
      return;
    }

    const selectedType = availablePostTypes.find(type => type.postType._id === postTypeId);

    if (selectedType && selectedType.remainingCount <= 0) {
      toast.warn('Bạn đã hết lượt đăng loại tin này');
      return;
    }

    // Đơn giản hóa: chỉ cập nhật formData, không dùng ref phức tạp
    setFormData(prev => ({
      ...prev,
      postType: postTypeId
    }));
  };

  const handleUpgradeClick = async () => {
    try {
      // Chuyển sang trang my-posts với param để hiển thị modal chọn gói
      navigate('/profile/my-posts?showUpgradeModal=true');
    } catch (error) {
      console.error('Error navigating to my-posts:', error);
      toast.error('Không thể chuyển trang');
    }
  };

  const formatPostTypeName = (displayName) => {
    // Trả về displayName từ API trực tiếp (đã được format sẵn)
    return displayName || 'Tin đăng';
  };

  const getPostTypeInfo = (postType) => {
    // Nếu truyền vào là string (backward compatibility)
    if (typeof postType === 'string') {
      const name = postType.toLowerCase();
      if (name.includes('tin vip đặc biệt')) return { stars: 5, color: '#8b0000' };
      if (name.includes('tin vip nổi bật')) return { stars: 4, color: '#dc3545' };
      if (name.includes('tin vip 1')) return { stars: 3, color: '#e83e8c' };
      if (name.includes('tin vip 2')) return { stars: 2, color: '#fd7e14' };
      if (name.includes('tin vip 3')) return { stars: 1, color: '#27ae60' };
      if (name.includes('tin thường')) return { stars: 0, color: '#6c757d' };
      return { stars: 0, color: '#6c757d' };
    }

    // Tính số sao dựa trên priority từ API (linh động)
    // Priority càng thấp = VIP càng cao = nhiều sao hơn
    const priority = postType?.priority || postType?.packageType?.priority || 10;
    const stars = priority <= 6 ? Math.max(0, Math.min(5, 6 - priority)) : 0;

    // Màu sắc theo thứ bậc VIP (dựa trên số sao từ priority)
    const colorMap = {
      5: '#8b0000', // Đỏ đậm - VIP đặc biệt (priority 1)
      4: '#dc3545', // Đỏ - VIP nổi bật (priority 2) 
      3: '#e83e8c', // Hồng - VIP 1 (priority 3)
      2: '#fd7e14', // Cam - VIP 2 (priority 4)
      1: '#27ae60', // Xanh lá - VIP 3 (priority 5)
      0: '#6c757d'  // Xám - Thường (priority 6+)
    };

    return {
      stars: Math.max(0, stars),
      color: colorMap[stars] || '#6c757d'
    };
  };


  const hasAnyPostsLeft = availablePostTypes.some(type => type.remainingCount > 0);
  console.log("Has any posts left:", hasAnyPostsLeft);




  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    console.log('Form submitted with formData:', formData);

    try {
      // Kiểm tra gói có hết hạn không
      if (packageInfo?.packageType === 'expired') {
        toast.error('Gói tin đã hết hạn. Vui lòng gia hạn gói để đăng tin.');
        setIsSubmitting(false);
        return;
      }

      // Kiểm tra xem có được phép đăng tin không
      if (!hasAnyPostsLeft) {
        toast.error('Bạn đã hết lượt đăng tin. Vui lòng nâng cấp gói.');
        setIsSubmitting(false);
        return;
      }

      // Kiểm tra postType được chọn
      if (!formData.postType || formData.postType.trim() === '') {
        console.error('PostType validation failed:', formData.postType);
        setErrors(prev => ({ ...prev, postType: 'Vui lòng chọn loại tin đăng' }));
        toast.error('Vui lòng chọn loại tin đăng');
        setIsSubmitting(false);
        return;
      }

      // Kiểm tra lượt còn lại của loại tin được chọn
      const selectedPostType = availablePostTypes.find(type => type.postType._id === formData.postType);

      if (!selectedPostType || selectedPostType.remainingCount <= 0) {
        toast.error('Loại tin được chọn đã hết lượt đăng');
        setIsSubmitting(false);
        return;
      }



      toast.info('Đang xử lý đăng tin...', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
      });

      // Đảm bảo coordinates luôn có giá trị hợp lệ - ưu tiên tọa độ thủ công
      let finalCoordinates;

      // Nếu có tọa độ thủ công, sử dụng tọa độ đó
      if (isManuallySetRef.current && manualCoordsRef.current) {
        finalCoordinates = manualCoordsRef.current;

      } else if (formData.coordinates && formData.coordinates.lat && formData.coordinates.lng) {
        finalCoordinates = formData.coordinates;

      } else {
        // Nếu coordinates không hợp lệ, thử geocode lại

        const addressPayload = await getFullAddressPayload(formData, locationData);
        if (addressPayload) {

          const coords = await geocodeAddress(addressPayload);
          if (coords && coords.lat && coords.lng) {
            finalCoordinates = coords;

          }
        }
      }

      // Nếu vẫn không có coordinates hợp lệ, sử dụng coordinates mặc định
      if (!finalCoordinates || !finalCoordinates.lat || !finalCoordinates.lng) {
        finalCoordinates = defaultCenter;

        toast.warn("Không thể xác định vị trí chính xác, sử dụng vị trí mặc định. Bạn có thể chỉnh sửa sau.");
      }

      const dataToSubmit = {
        ...formData,
        availableDate: formatDateForBackend(formData.availableDate),
        coordinates: finalCoordinates, // Đảm bảo coordinates được gửi ở root level
        postType: formData.postType, // Sử dụng formData.postType đã validated
        // Đảm bảo gửi đúng format theo Property schema mới
        province: formData.province, // Tên tỉnh
        provinceId: formData.provinceId, // ID tỉnh
        ward: formData.ward, // Tên phường/xã
        // Giữ location object để backward compatibility (nếu cần)
        location: {
          province: formData.province,
          ward: formData.ward,
          detailAddress: formData.detailAddress,
          coordinates: finalCoordinates
        }
      }; console.log('Data to submit:', dataToSubmit);


      const result = await postAPI.createPost(dataToSubmit);

      if (result.success) {
        if (result.data?.rejectedFiles) {
          setRejectedFiles(result.data.rejectedFiles);
          // Hiển thị toast với thông tin chi tiết về files bị từ chối
          if (result.data.rejectedFiles.images?.length > 0 || result.data.rejectedFiles.videos?.length > 0) {
            let rejectedMessage = 'Đăng tin thành công, nhưng một số file bị từ chối:\n';

            if (result.data.rejectedFiles.images?.length > 0) {
              rejectedMessage += '\nẢnh bị từ chối:\n';
              result.data.rejectedFiles.images.forEach((img, index) => {
                rejectedMessage += `${index + 1}. "${img.originalname}" - ${img.reason}\n`;
              });
            }

            if (result.data.rejectedFiles.videos?.length > 0) {
              rejectedMessage += '\nVideo bị từ chối:\n';
              result.data.rejectedFiles.videos.forEach((vid, index) => {
                rejectedMessage += `${index + 1}. "${vid.originalname}" - ${vid.reason}\n`;
              });
            }

            // Thêm thông tin số lượt còn lại từ server
            const selectedPostType = availablePostTypes.find(type => type.postType._id === formData.postType);
            const postTypeName = selectedPostType ? formatPostTypeName(selectedPostType.postType.displayName) : 'tin đăng';

            if (result.data?.postType) {
              const remainingAfterPost = Math.max(0, result.data.postType.allowedLimit - result.data.postType.usedCount);
              rejectedMessage += `\n\nLoại tin: ${postTypeName} (còn ${remainingAfterPost} lượt)`;
            }

            toast.warn(rejectedMessage.trim(), {
              position: "top-center",
              autoClose: 15000,
              hideProgressBar: false,
            });
          } else {
            toast.success(`Đăng tin thành công! "${formData.title}" - Trạng thái: Chờ admin duyệt`, {
              position: "top-right",
              autoClose: 5000,
              hideProgressBar: false,
            });
          }
        } else {
          console.log('No rejectedFiles in response or rejectedFiles is undefined/null');

          // Hiển thị thông báo thành công với thông tin số lượt còn lại từ server
          const selectedPostType = availablePostTypes.find(type => type.postType._id === formData.postType);
          const postTypeName = selectedPostType ? formatPostTypeName(selectedPostType.postType.displayName) : 'tin đăng';

          let successMessage = `Đăng tin thành công! "${formData.title}" - Trạng thái: Chờ admin duyệt`;
          if (result.data?.postType) {
            const remainingAfterPost = Math.max(0, result.data.postType.allowedLimit - result.data.postType.usedCount);
            successMessage += `\n\nLoại tin: ${postTypeName} (còn ${remainingAfterPost} lượt)`;
          }

          toast.success(successMessage, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
          });
        }

        setShowModal(false);

        // Delay để toast hiển thị trước khi redirect
        setTimeout(() => {
          // Redirect về MyProperties
          navigate('/profile/my-posts');
        }, 2000);

        // Không reset form nếu có files bị từ chối để user có thể chỉnh sửa
        if (!result.data?.rejectedFiles?.images?.length && !result.data?.rejectedFiles?.videos?.length) {
          // Reset form chỉ khi không có files bị từ chối
          setFormData({
            title: '',
            category: 'phong_tro',
            contactName: '',
            contactPhone: '',
            description: '',
            rentPrice: '',
            promotionPrice: '',
            deposit: '',
            area: '',
            electricPrice: '',
            waterPrice: '',
            maxOccupants: '1',
            availableDate: '',
            amenities: [],
            fullAmenities: false,
            timeRules: '',
            houseRules: [],
            province: '',
            provinceId: '',
            ward: '',
            detailAddress: '',
            coordinates: defaultCenter,
            images: [],
            video: null,
            postType: '',
            isForRent: true
          });

          setErrors({});
          setRejectedFiles({ images: [], videos: [] });

          if (fileInputRef.current) fileInputRef.current.value = '';
          if (videoInputRef.current) videoInputRef.current.value = '';
        }

        // Reset manual coordinate flags
        isManuallySetRef.current = false;
        setIsManuallySet(false);
        manualCoordsRef.current = null;
        lastAddressRef.current = "";
        lastCoordsRef.current = null;

        // Cập nhật remainingCount dựa trên thông tin từ server (chính xác hơn)
        if (formData.postType && result.data?.postType) {
          const serverPostTypeInfo = result.data.postType;
          const newRemainingCount = Math.max(0, serverPostTypeInfo.allowedLimit - serverPostTypeInfo.usedCount);

          setAvailablePostTypes(prev =>
            prev.map(item =>
              item.postType._id === formData.postType
                ? {
                  ...item,
                  remainingCount: newRemainingCount,
                  usedCount: serverPostTypeInfo.usedCount,
                  totalLimit: serverPostTypeInfo.allowedLimit
                }
                : item
            )
          );

          console.log('Post type limit updated from server:', {
            postTypeId: formData.postType,
            usedCount: serverPostTypeInfo.usedCount,
            allowedLimit: serverPostTypeInfo.allowedLimit,
            newRemainingCount: newRemainingCount
          });
        }

        // Reload package data để đảm bảo data chính xác từ server
        // (Backend sẽ tự động tính toán lại remainingCount dựa trên số tin đã đăng)
        loadPackageData();

      } else {
        if (result.errors) {
          setErrors(result.errors);

          // Xử lý rejected files từ validation error trong success case
          if (result.rejectedFiles) {
            console.log('Rejected files from validation error (success case):', result.rejectedFiles);
            setRejectedFiles(result.rejectedFiles);
            console.log('Updated rejectedFiles state from validation error (success case)');
          }

          const errorCount = Object.keys(result.errors).length;
          toast.error(`${result.message || 'Dữ liệu không hợp lệ'}\nCó ${errorCount} lỗi cần sửa. Vui lòng kiểm tra lại form.`, {
            position: "top-right",
            autoClose: 7000,
            hideProgressBar: false,
          });

          setTimeout(() => {
            const firstErrorField = document.querySelector('.error');
            if (firstErrorField) {
              firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
              firstErrorField.focus();
            }
          }, 100);
        } else {
          toast.error(`${result.message || 'Có lỗi xảy ra khi đăng tin'}`, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
          });
        }
      }
    } catch (error) {
      console.error('Error creating post:', error);

      if (error.response) {
        const responseData = error.response.data;

        if (error.response.status === 400 && responseData.errors) {
          setErrors(responseData.errors);

          // Xử lý rejected files từ validation error
          if (responseData.rejectedFiles) {
            console.log('📥 Rejected files from validation error:', responseData.rejectedFiles);
            console.log('📥 Images rejected:', responseData.rejectedFiles.images);
            console.log('📥 Videos rejected:', responseData.rejectedFiles.videos);
            setRejectedFiles(responseData.rejectedFiles);
            console.log('📥 Updated rejectedFiles state from validation error');
          }

          const errorCount = Object.keys(responseData.errors).length;

          toast.error(`${responseData.message || 'Dữ liệu không hợp lệ'}\nCó ${errorCount} lỗi cần sửa. Vui lòng kiểm tra lại form.`, {
            position: "top-right",
            autoClose: 7000,
            hideProgressBar: false,
          });

          setTimeout(() => {
            const firstErrorField = document.querySelector('.error');
            if (firstErrorField) {
              firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
              firstErrorField.focus();
            }
          }, 100);
        } else {
          let errorMessage = 'Lỗi server: ';
          if (error.response.status === 401) {
            errorMessage += 'Vui lòng đăng nhập lại';
          } else if (error.response.status === 413) {
            errorMessage += 'File upload quá lớn';
          } else {
            errorMessage += responseData?.message || 'Lỗi không xác định từ server';
          }

          toast.error(errorMessage, {
            position: "top-right",
            autoClose: 5000,
            hideProgressBar: false,
          });
        }
      } else if (error.request) {
        toast.error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối internet.', {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        });
      } else {
        toast.error(`Lỗi không xác định: ${error.message}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Initialize TrackAsia map
  const initializeMap = () => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new trackasiagl.Map({
      container: mapContainerRef.current,
      style: `${TRACKASIA_BASE_URL}/styles/v2/streets.json?key=${TRACKASIA_API_KEY}`, // TrackAsia Maps API với style đẹp
      center: [formData.coordinates.lng, formData.coordinates.lat], // TrackAsia uses [lng, lat]
      zoom: 13,
      attributionControl: true,
      logoPosition: 'bottom-left'
    });

    mapRef.current = map;

    // Add navigation controls (zoom, rotate)
    map.addControl(new trackasiagl.NavigationControl(), 'top-right');

    // Add geolocate control
    map.addControl(
      new trackasiagl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true
        },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-right'
    );

    // TrackAsia Directions - Direct API integration
    let origin = null;
    let destination = null;
    let startMarker = null;
    let endMarker = null;    // Add marker
    const marker = new trackasiagl.Marker({
      color: '#FF0000', // Marker màu đỏ cho địa chỉ bất động sản
      scale: 1.2
    })
      .setLngLat([formData.coordinates.lng, formData.coordinates.lat])
      .addTo(map);

    markerRef.current = marker;

    // Handle map click events - với chức năng chọn điểm đi/đến
    map.on('click', async (e) => {
      const clickedCoords = { lat: e.lngLat.lat, lng: e.lngLat.lng };
      const coords = [e.lngLat.lng, e.lngLat.lat];
      console.log("Map clicked:", clickedCoords, "coords:", coords);

      // Check if Shift key is pressed for route planning mode
      if (e.originalEvent.shiftKey) {
        // Route planning mode
        if (!origin) {
          origin = coords;
          if (startMarker) startMarker.remove();
          startMarker = new trackasiagl.Marker({ color: 'green' })
            .setLngLat(coords)
            .addTo(map);
        } else if (!destination) {
          destination = coords;
          if (endMarker) endMarker.remove();
          endMarker = new trackasiagl.Marker({ color: 'red' })
            .setLngLat(coords)
            .addTo(map);

        } else {
          // Reset khi click lần 3
          origin = coords;
          destination = null;
          if (startMarker) startMarker.remove();
          if (endMarker) endMarker.remove();
          if (map.getLayer('route-line')) {
            map.removeLayer('route-line');
            map.removeSource('route-line');
          }
          if (map.getLayer('route-line-casing')) {
            map.removeLayer('route-line-casing');
            map.removeSource('route-line-casing');
          }
          startMarker = new trackasiagl.Marker({ color: 'green' })
            .setLngLat(coords)
            .addTo(map);
          toast.info('Đặt lại điểm xuất phát mới\n Shift + Click để chọn điểm đến', {
            position: "top-center",
            autoClose: 3000
          });
          console.log("Đặt lại điểm xuất phát mới");
        }
      } else {
        // Normal mode - set property location
        // Đánh dấu là đã được set thủ công
        isManuallySetRef.current = true;
        setIsManuallySet(true);
        manualCoordsRef.current = clickedCoords;

        setFormData(prev => ({
          ...prev,
          coordinates: clickedCoords
        }));

        // Update marker position
        marker.setLngLat([clickedCoords.lng, clickedCoords.lat]);

        // Cập nhật lastCoordsRef để lưu tọa độ hợp lệ
        lastCoordsRef.current = clickedCoords;

        console.log("Coordinates manually set to:", clickedCoords);
      }
    });


  };

  // Hàm lấy vị trí hiện tại và vẽ đường đi
  const getDirectionsFromCurrentLocation = async () => {
    if (!formData.coordinates?.lat || !formData.coordinates?.lng) {
      toast.error('Vui lòng chọn địa chỉ bất động sản trước', {
        position: "top-center",
        autoClose: 3000
      });
      return;
    }

    setIsGettingCurrentLocation(true);
    setIsCalculatingRoute(true);

    try {
      // Lấy vị trí hiện tại
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation is not supported by this browser'));
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position),
          (error) => reject(error),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000 // Cache for 1 minute
          }
        );
      });

      const currentLocation = [position.coords.longitude, position.coords.latitude];
      const destination = [formData.coordinates.lng, formData.coordinates.lat];

      console.log('Current location:', currentLocation);
      console.log('Destination:', destination);

      toast.info('Đã lấy vị trí hiện tại, đang tính đường đi...', {
        position: "top-center",
        autoClose: 2000
      });

      // Vẽ route từ vị trí hiện tại đến địa chỉ
      await drawRouteFromTo(currentLocation, destination);

    } catch (error) {
      console.error('Error getting current location:', error);

      let errorMessage = 'Không thể lấy vị trí hiện tại. ';

      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage += 'Bạn đã từ chối chia sẻ vị trí. Vui lòng cho phép truy cập vị trí trong cài đặt trình duyệt.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage += 'Thông tin vị trí không khả dụng.';
          break;
        case error.TIMEOUT:
          errorMessage += 'Yêu cầu lấy vị trí đã hết thời gian chờ.';
          break;
        default:
          errorMessage += error.message || 'Lỗi không xác định.';
          break;
      }

      toast.error(errorMessage, {
        position: "top-center",
        autoClose: 5000
      });
    } finally {
      setIsGettingCurrentLocation(false);
      setIsCalculatingRoute(false);
    }
  };

  // Hàm vẽ route giữa 2 điểm
  const drawRouteFromTo = async (origin, destination) => {
    console.log("drawRouteFromTo called with origin:", origin, "destination:", destination);
    const map = mapRef.current;
    console.log("Drawing route from", origin, "to", destination);
    console.log("Map instance:", map);
    if (!map) return;


    // TrackAsia format: latitude,longitude (khác với MapBox)
    const originStr = `${origin[1]},${origin[0]}`; // lat,lng
    console.log("Origin string (lat,lng):", originStr);
    const destinationStr = `${destination[1]},${destination[0]}`; // lat,lng

    const url = `${TRACKASIA_BASE_URL}/route/v2/directions/json?new_admin=true&origin=${originStr}&destination=${destinationStr}&mode=motorcycling&key=${TRACKASIA_API_KEY}`;
    console.log("TrackAsia Directions URL:", url);
    console.log("Origin coordinates (lat,lng):", originStr);
    console.log("Destination coordinates (lat,lng):", destinationStr);

    try {
      const response = await fetch(url);
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Response Error:', errorText);
        throw new Error(`TrackAsia Directions API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log("TrackAsia Directions Response:", data);

      // Kiểm tra chi tiết response structure
      if (!data) {
        console.error('Empty response from API');
        throw new Error('Empty response from TrackAsia API');
      }

      if (!data.routes) {
        console.error('No routes property in response:', data);
        throw new Error('Invalid response format: missing routes');
      }

      if (!Array.isArray(data.routes) || data.routes.length === 0) {
        console.error('No routes found. Full response:', data);

        // Kiểm tra có error message từ API không
        if (data.error || data.message) {
          throw new Error(`TrackAsia API: ${data.error || data.message}`);
        }

        throw new Error('Không tìm thấy đường đi giữa hai điểm này. Vui lòng thử lại với vị trí khác.');
      }

      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        console.log("Route object:", route);

        // TrackAsia API trả về overview_polyline thay vì geometry
        if (!route.overview_polyline || !route.overview_polyline.points) {
          console.error('No overview_polyline in route:', route);
          throw new Error('Route không có thông tin polyline');
        }

        // Decode polyline thành coordinates
        const encodedPolyline = route.overview_polyline.points;
        console.log("Encoded polyline:", encodedPolyline);

        // Tạo geometry từ polyline đã decode
        const decodedCoordinates = decodePolyline(encodedPolyline);
        console.log("Decoded coordinates:", decodedCoordinates);

        const routeGeometry = {
          type: 'LineString',
          coordinates: decodedCoordinates
        };        // Xóa route cũ nếu có (cả layer và source) - với error handling
        try {
          if (map.getLayer('route-line-casing')) {
            map.removeLayer('route-line-casing');
          }
          if (map.getLayer('route-line')) {
            map.removeLayer('route-line');
          }
          if (map.getSource('route-line')) {
            map.removeSource('route-line');
          }
        } catch (removeError) {
          console.warn('Error removing old route layers/source:', removeError);
          // Continue execution even if removal fails
        }

        // Thêm route mới
        map.addSource('route-line', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: routeGeometry
          }
        });

        // Add route line casing (viền trắng)
        map.addLayer({
          id: 'route-line-casing',
          type: 'line',
          source: 'route-line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ffffff',
            'line-width': 8,
            'line-opacity': 0.8
          }
        });

        // Add route line (màu chính)
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route-line',
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#007cbf',
            'line-width': 6,
            'line-opacity': 1
          }
        });

        // Xóa marker vị trí hiện tại cũ nếu có
        if (currentLocationMarkerRef.current) {
          currentLocationMarkerRef.current.remove();
        }

        // Thêm marker cho vị trí hiện tại (màu xanh)
        const currentLocationMarker = new trackasiagl.Marker({ color: 'green' })
          .setLngLat(origin)
          .addTo(map);

        currentLocationMarkerRef.current = currentLocationMarker;

        // Fit map để hiển thị toàn bộ route
        const coordinates = routeGeometry.coordinates;
        console.log("Route coordinates:", coordinates);
        const bounds = coordinates.reduce(function (bounds, coord) {
          return bounds.extend(coord);
        }, new trackasiagl.LngLatBounds(coordinates[0], coordinates[0]));

        map.fitBounds(bounds, {
          padding: { top: 50, bottom: 50, left: 50, right: 50 }
        });

        // Lấy thông tin từ legs (giống Google Maps)
        const leg = route.legs[0]; // Lấy leg đầu tiên
        console.log("Route leg:", leg);

        const routeData = {
          distance: leg.distance.text,
          duration: leg.duration.text,
          startAddress: leg.start_address,
          endAddress: leg.end_address,
          steps: leg.steps.map(step => ({
            instruction: step.html_instructions || step.instructions,
            distance: step.distance.text,
            duration: step.duration.text,
            maneuver: step.maneuver || 'straight'
          })),
          origin: origin,
          destination: destination
        };

        setRouteInfo(routeData);

        toast.success(`Đã vẽ đường đi thành công!\nKhoảng cách: ${routeData.distance}\nThời gian: ${routeData.duration}`, {
          position: "top-center",
          autoClose: 5000
        });

      } else {
        throw new Error('No routes found');
      }
    } catch (error) {
      console.error('Error drawing route:', error);
      toast.error('Lỗi khi vẽ đường đi: ' + error.message, {
        position: "top-center",
        autoClose: 3000
      });
    }
  };

  // Clear route và reset markers  
  const clearRoute = () => {
    const map = mapRef.current;
    if (!map) return;

    // Remove route layers first, then source - with error handling
    try {
      if (map.getLayer('route-line-casing')) {
        map.removeLayer('route-line-casing');
      }
      if (map.getLayer('route-line')) {
        map.removeLayer('route-line');
      }
      if (map.getSource('route-line')) {
        map.removeSource('route-line');
      }
    } catch (removeError) {
      console.warn('Error removing route layers/source in clearRoute:', removeError);
      // Continue execution even if removal fails
    }

    // Remove current location marker
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.remove();
      currentLocationMarkerRef.current = null;
    }

    // Reset route info
    setRouteInfo(null);

    toast.info('Đã xóa đường đi', {
      position: "top-center",
      autoClose: 2000
    });
  };

  // Function to get maneuver icon
  const getManeuverIcon = (maneuver, instruction = '') => {
    const instructionLower = instruction.toLowerCase();

    // Kiểm tra từ khóa trong instruction trước
    if (instructionLower.includes('rẽ trái') || instructionLower.includes('quay trái') || instructionLower.includes('left')) {
      return 'fa-arrow-left';
    }
    if (instructionLower.includes('rẽ phải') || instructionLower.includes('quay phải') || instructionLower.includes('right')) {
      return 'fa-arrow-right';
    }
    if (instructionLower.includes('đi thẳng') || instructionLower.includes('tiếp tục') || instructionLower.includes('straight') || instructionLower.includes('continue')) {
      return 'fa-arrow-up';
    }
    if (instructionLower.includes('quay đầu') || instructionLower.includes('u-turn') || instructionLower.includes('uturn')) {
      return 'fa-undo';
    }
    if (instructionLower.includes('vòng xoay') || instructionLower.includes('roundabout')) {
      return 'fa-refresh';
    }
    if (instructionLower.includes('hợp nhất') || instructionLower.includes('merge')) {
      return 'fa-code-fork';
    }
    if (instructionLower.includes('đích') || instructionLower.includes('destination') || instructionLower.includes('arrive')) {
      return 'fa-flag-checkered';
    }

    // Fallback to maneuver type
    const iconMap = {
      'turn-left': 'fa-arrow-left',
      'turn-right': 'fa-arrow-right',
      'turn-slight-left': 'fa-long-arrow-left',
      'turn-slight-right': 'fa-long-arrow-right',
      'turn-sharp-left': 'fa-arrow-left',
      'turn-sharp-right': 'fa-arrow-right',
      'uturn-left': 'fa-undo',
      'uturn-right': 'fa-undo',
      'continue': 'fa-arrow-up',
      'straight': 'fa-arrow-up',
      'merge': 'fa-code-fork',
      'on-ramp': 'fa-long-arrow-right',
      'off-ramp': 'fa-long-arrow-left',
      'fork-left': 'fa-code-fork',
      'fork-right': 'fa-code-fork',
      'roundabout-left': 'fa-refresh',
      'roundabout-right': 'fa-refresh'
    };

    return iconMap[maneuver] || 'fa-arrow-up';
  };

  // Function to decode Google polyline
  const decodePolyline = (encoded) => {
    const coordinates = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const deltaLng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += deltaLng;

      coordinates.push([lng / 1e5, lat / 1e5]); // [longitude, latitude] for MapBox format
    }

    return coordinates;
  };

  // Get current location
  const getCurrentLocation = () => {
    setGettingLocation(true);

    if (!navigator.geolocation) {
      toast.error('Trình duyệt không hỗ trợ định vị', {
        position: "top-center",
        autoClose: 3000
      });
      setGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCoords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        // Đánh dấu là đã được set thủ công
        isManuallySetRef.current = true;
        setIsManuallySet(true);
        manualCoordsRef.current = newCoords;

        setFormData(prev => ({
          ...prev,
          coordinates: newCoords
        }));

        setGettingLocation(false);

        toast.success('Đã cập nhật vị trí hiện tại', {
          position: "top-center",
          autoClose: 3000
        });
      },
      (error) => {
        let errorMessage = 'Không thể lấy vị trí hiện tại. ';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += 'Bạn đã từ chối chia sẻ vị trí.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += 'Thông tin vị trí không khả dụng.';
            break;
          case error.TIMEOUT:
            errorMessage += 'Yêu cầu lấy vị trí đã hết thời gian chờ.';
            break;
          default:
            errorMessage += 'Lỗi không xác định.';
            break;
        }

        toast.error(errorMessage, {
          position: "top-center",
          autoClose: 5000
        });
        setGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // Cache for 1 minute
      }
    );
  };

  // Update map center and marker when coordinates change
  const updateMapLocation = (newCoords) => {
    if (mapRef.current && markerRef.current) {
      const map = mapRef.current;
      const marker = markerRef.current;

      // Smooth animation to new location
      map.flyTo({
        center: [newCoords.lng, newCoords.lat],
        zoom: 15,
        duration: 1000 // Animation duration in milliseconds
      });

      marker.setLngLat([newCoords.lng, newCoords.lat]);

      // Update pulse animation if exists
      if (map.getSource('marker-pulse')) {
        map.getSource('marker-pulse').setData({
          type: 'FeatureCollection',
          features: [{
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [newCoords.lng, newCoords.lat]
            }
          }]
        });
      }
    }
  };





  return (
    <div className="profile-page">
      <div className="page-header">
        <h2>
          <i className="fa fa-plus-circle"></i>
          {t('profile.newPost.title') || 'Đăng tin mới'}
        </h2>
        <p>{t('profile.newPost.subtitle') || 'Tạo tin đăng cho thuê phòng trọ'}</p>
      </div>

      <div className="content-card-new-property">
        <button
          className="btn btn-primary btn-lg"
          onClick={() => setShowModal(true)}
        >
          <i className="fa fa-plus"></i>
          Tạo tin đăng mới
        </button>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay-new-property" onClick={() => setShowModal(false)}>
          <div className="post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo tin đăng mới</h3>
              <button className="close-btn-current-package" onClick={() => setShowModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="post-form">
              <div className="form-content-new-property">
                {/* Thông tin gói và chọn loại tin */}
                <div className="form-section-new-property">
                  <h4>
                    <i className="fa fa-package"></i>
                    Gói tin
                  </h4>

                  {loadingPackage ? (
                    <div className="package-selector-loading">
                      <i className="fa fa-spinner fa-spin"></i>
                      <span>Đang tải thông tin gói...</span>
                    </div>
                  ) : (
                    <>
                      {/* Thông tin gói hiện tại */}
                      {packageInfo && (
                        <div className="current-package-info">
                          <div className="package-header-new-property">
                            <h5>
                              <i className="fa fa-info-circle"></i>
                              Gói hiện tại: <strong>{packageInfo?.displayName}</strong>
                            </h5>
                            <span className="package-expiry">
                              Hết hạn: {new Date(packageInfo.expiryDate).toLocaleDateString('vi-VN')}
                            </span>

                          </div>
                        </div>
                      )}

                      {/* Chọn loại tin , expired thì không cho chọn*/}
                      {packageInfo?.packageType === 'expired' ? (
                        <div className="package-expired">
                          <div className="expired-icon">
                            <i className="fa fa-exclamation-circle"></i>
                          </div>
                          <h5>Gói tin đã hết hạn</h5>
                          <p>Gói tin của bạn đã hết hạn. Vui lòng gia hạn gói để tiếp tục đăng tin.</p>
                          <button
                            type="button"
                            className="btn-package-new-properties btn-primary btn-upgrade"
                            onClick={handleUpgradeClick}
                          >
                            <i className="fa fa-refresh"></i>
                            Gia hạn gói ngay
                          </button>
                        </div>
                      ) : !hasAnyPostsLeft ? (
                        <div className="no-posts-left">
                          <div className="no-posts-icon">
                            <i className="fa fa-exclamation-triangle"></i>
                          </div>
                          <h5>Bạn đã hết lượt đăng tin</h5>
                          <p>Gói hiện tại của bạn đã hết số lượt đăng tin. Vui lòng nâng cấp gói để tiếp tục đăng tin.</p>
                          <button
                            type="button"
                            className="btn-package-new-properties btn-primary btn-upgrade"
                            onClick={handleUpgradeClick}
                          >
                            <i className="fa fa-arrow-up"></i>
                            Nâng cấp gói ngay
                          </button>
                        </div>
                      ) : (
                        <div className="post-type-selection">
                          <div className="form-group">
                            <h4>Loại tin đăng *</h4>
                            <select
                              name="postType"
                              value={formData.postType}
                              onChange={(e) => {
                                const selectedId = e.target.value;
                                handlePostTypeSelect(selectedId);

                                // Clear error khi chọn
                                if (errors.postType) {
                                  setErrors(prev => ({ ...prev, postType: '' }));
                                }
                              }}
                              className={`post-type-select ${errors.postType ? 'error' : ''}`}
                              style={{
                                color: (() => {
                                  if (!formData.postType) return '#999'; // Màu placeholder

                                  const selectedItem = availablePostTypes.find(item => item.postType._id === formData.postType);
                                  if (selectedItem) {
                                    // Sử dụng trực tiếp thuộc tính color từ API
                                    return selectedItem.postType.color || '#333';
                                  }
                                  return '#333'; // Màu mặc định
                                })(),
                                fontWeight: (() => {
                                  if (!formData.postType) return '400';

                                  const selectedItem = availablePostTypes.find(item => item.postType._id === formData.postType);
                                  if (selectedItem) {
                                    // Sử dụng priority để tính font weight
                                    const priority = selectedItem.postType.priority || 10;
                                    return priority <= 6 ? '600' : '400';
                                  }
                                  return '400';
                                })(),
                                fontSize: '16px'
                              }}
                            >
                              <option value="">Chọn loại tin đăng</option>
                              {availablePostTypes.map((item, index) => {
                                const isDisabled = item.remainingCount <= 0;
                                // Tính số sao dựa trên priority trực tiếp từ API
                                const priority = item.postType.priority || 10;
                                const stars = priority <= 6 ? Math.max(0, Math.min(5, 6 - priority)) : 0;
                                const starsText = stars > 0 ? ' ' + '★'.repeat(stars) : '';

                                return (
                                  <option
                                    key={index}
                                    value={item.postType._id}
                                    disabled={isDisabled}
                                    style={{
                                      color: isDisabled ? '#ccc' : (item.postType.color || '#333'),
                                      fontWeight: stars > 0 ? '600' : '400'
                                    }}
                                  >
                                    {item.postType.displayName}{starsText}
                                    {' '}({item.remainingCount} còn lại)
                                    {isDisabled ? ' - Hết lượt' : ''}
                                  </option>
                                );
                              })}
                            </select>
                            {errors.postType && <span className="error-text">{errors.postType}</span>}


                          </div>

                          <div className="upgrade-suggestion">
                            <p>
                              <i className="fa fa-lightbulb-o"></i>
                              Muốn đăng nhiều tin hơn?
                              <button
                                type="button"
                                className="btn-link upgrade-link"
                                onClick={handleUpgradeClick}
                              >
                                Nâng cấp gói ngay
                              </button>
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Thông tin chủ nhà */}
                <div className="form-section-new-property">
                  <h4>Thông tin chủ nhà</h4>
                  <p className="hint">Nhập các thông tin về người cho thuê</p>

                  <div className="form-group">
                    <label>Tiêu đề *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="VD: Cho thuê phòng trọ 18m2 giá rẻ tại Bình Thành"
                      className={errors.title ? 'error' : ''}
                    />
                    {errors.title && <span className="error-text">{errors.title}</span>}
                  </div>

                  <div className="form-row-new-property">
                    <div className="form-group">
                      <label>Danh mục thuê *</label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                      >
                        {categories.map(cat => (
                          <option key={cat.value} value={cat.value}>
                            {cat.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Tên người liên hệ *</label>
                      <input
                        type="text"
                        name="contactName"
                        value={formData.contactName}
                        onChange={handleInputChange}
                        placeholder="VD: Nguyễn Văn A"
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
                      value={formData.contactPhone}
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
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Nhập mô tả về nhà cho thuê..."
                      rows="4"
                      className={errors.description ? 'error' : ''}
                    />
                    {errors.description && <span className="error-text">{errors.description}</span>}
                  </div>
                </div>

                {/* Thông tin cơ bản & giá */}
                <div className="form-section-new-property">
                  <h4>Thông tin cơ bản & giá</h4>
                  <p className="hint">Nhập các thông tin về phòng cho thuê</p>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Giá thuê (VNĐ/tháng) *</label>
                      <input
                        type="text"
                        name="rentPrice"
                        value={formatNumber(formData.rentPrice)}
                        onChange={handlePriceChange}
                        placeholder="VD: 3.000.000"
                        className={errors.rentPrice ? 'error' : ''}
                      />
                      {errors.rentPrice && <span className="error-text">{errors.rentPrice}</span>}
                    </div>

                    <div className="form-group">
                      <label>Giá thuê khuyến mãi (VNĐ/tháng)</label>
                      <input
                        type="text"
                        name="promotionPrice"
                        value={formatNumber(formData.promotionPrice)}
                        onChange={handlePriceChange}
                        placeholder="VD: 2.500.000"
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
                        value={formatNumber(formData.deposit)}
                        onChange={handlePriceChange}
                        placeholder="VD: 3.000.000"
                        className={errors.deposit ? 'error' : ''}
                      />
                      {errors.deposit && <span className="error-text">{errors.deposit}</span>}
                    </div>

                    <div className="form-group">
                      <label>Diện tích (m²) *</label>
                      <input
                        type="number"
                        name="area"
                        value={formData.area}
                        onChange={handleInputChange}
                        placeholder="VD: 18"
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
                        value={formatNumber(formData.electricPrice)}
                        onChange={handlePriceChange}
                        placeholder="VD: 3.500"
                        className={errors.electricPrice ? 'error' : ''}
                      />
                      {errors.electricPrice && <span className="error-text">{errors.electricPrice}</span>}
                    </div>

                    <div className="form-group">
                      <label>Giá nước (VNĐ/m³)</label>
                      <input
                        type="text"
                        name="waterPrice"
                        value={formatNumber(formData.waterPrice)}
                        onChange={handlePriceChange}
                        placeholder="VD: 15.000"
                        className={errors.waterPrice ? 'error' : ''}
                      />
                      {errors.waterPrice && <span className="error-text">{errors.waterPrice}</span>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tối đa người ở/phòng</label>
                      <select
                        name="maxOccupants"
                        value={formData.maxOccupants}
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
                        value={formData.availableDate}
                        onChange={handleInputChange}
                        min={dayjs().format('YYYY-MM-DD')}
                        className={errors.availableDate ? 'error' : ''}
                      />
                      {errors.availableDate && <span className="error-text">{errors.availableDate}</span>}
                    </div>
                  </div>
                </div>

                {/* Tiện ích */}
                <div className="form-section-new-property">
                  <h4>Tiện ích cho thuê</h4>

                  <div className="form-group-new-property">
                    <label className="full-amenities-label">
                      <input
                        type="checkbox"
                        name="fullAmenities"
                        checked={formData.fullAmenities}
                        onChange={handleInputChange}
                        style={{ marginRight: '8px', fontSize: '16px' }}
                      />
                      Full tiện ích
                    </label>
                  </div>

                  <div className="amenities-grid">
                    {loadingAmenities ? (
                      <div className="loading-amenities">
                        <i className="fa fa-spinner fa-spin"></i>
                        Đang tải tiện ích...
                      </div>
                    ) : (
                      amenitiesList.map((amenity) => (
                        <label
                          key={amenity.value}
                          className={`amenity-item ${formData.fullAmenities ? "disabled" : ""}`}
                        >
                          <input
                            type="checkbox"
                            name="amenities"
                            value={amenity.value}
                            checked={formData.amenities.includes(amenity.value)}
                            onChange={handleInputChange}
                            disabled={formData.fullAmenities}
                          />
                          {amenity.icon && <i className={amenity.icon}></i>}
                          <span className="amenity-text-post">{amenity.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {errors.amenities && <span className="error-text">{errors.amenities}</span>}

                  <div className="form-group">
                    <h4>Quy định giờ giấc</h4>
                    <textarea
                      name="timeRules"
                      value={formData.timeRules}
                      onChange={handleInputChange}
                      placeholder="VD: Giờ giấc tự do, tắt đèn 22h..."
                      rows="3"
                    />
                  </div>
                  {errors.timeRules && <span className="error-text">{errors.timeRules}</span>}
                </div>

                {/* Nội quy */}
                <div className="form-section-new-property">
                  <h4>Nội quy</h4>
                  <div className="house-rules-grid">
                    {houseRulesList.map(rule => (
                      <label key={rule.value}>
                        <input
                          type="checkbox"
                          name="houseRules"
                          value={rule.value}
                          checked={formData.houseRules.includes(rule.value)}
                          onChange={handleInputChange}
                        />
                        {rule.label}
                      </label>
                    ))}
                  </div>
                  {errors.houseRules && <span className="error-text">{errors.houseRules}</span>}
                </div>

                {/* Địa chỉ */}
                <div className="form-section-new-property">
                  <h4>Địa chỉ</h4>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Tỉnh/Thành phố *</label>
                      <select
                        name="province"
                        value={formData.provinceId}
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
                        value={locationData.wards.find(w => w.name === formData.ward)?.code || ''}
                        onChange={handleInputChange}
                        className={errors.ward ? 'error' : ''}
                        disabled={locationData.loadingWards || !formData.provinceId}
                      >
                        <option value="">
                          {locationData.loadingWards ? 'Đang tải...' :
                            !formData.provinceId ? 'Chọn tỉnh trước' : 'Chọn phường/xã'}
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
                        value={formData.detailAddress}
                        onChange={handleInputChange}
                        placeholder="VD: Hẻm 566 Nguyễn Thái Sơn"
                        className={errors.detailAddress ? 'error' : ''}
                      />
                      {errors.detailAddress && <span className="error-text">{errors.detailAddress}</span>}
                    </div>
                  </div>

                  {/* Leaflet Map */}
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
                          <i className={`fa ${isManuallySet ? 'fa-hand' : 'fa-magic'}`} style={{ color: isManuallySet ? '#007bff' : '#007bff' }}></i>
                          <span>Trạng thái: <strong style={{ color: isManuallySet ? '#28a745' : '#007bff' }}>
                            {isManuallySet ? 'Đã chỉnh thủ công' : 'Tự động geocoding'}
                          </strong></span>
                        </div>
                      </div>
                      <p className="address-hint">💡 Nhấp vào bản đồ để chọn vị trí chính xác</p>

                      {routeInfo && (
                        <div className="route-info-panel">
                          <h5><i className="fa fa-route"></i> Thông tin đường đi</h5>
                          <div className="route-details">
                            <div className="route-detail-item">
                              <i className="fa fa-road"></i>
                              <span>Khoảng cách: <strong>{routeInfo.distance}</strong></span>
                            </div>
                            <div className="route-detail-item">
                              <i className="fa fa-clock"></i>
                              <span>Thời gian: <strong>{routeInfo.duration}</strong></span>
                            </div>
                            <div className="route-detail-item">
                              <i className="fa fa-map"></i>
                              <span>Từ: <strong>{routeInfo.startAddress}</strong></span>
                            </div>
                            <div className="route-detail-item">
                              <i className="fa fa-map-marker"></i>
                              <span>Đến: <strong>{routeInfo.endAddress}</strong></span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="map-container-wrapper" style={{ position: 'relative', display: 'flex' }}>
                        <div
                          ref={mapContainerRef}
                          className="trackasia-map-container"
                          style={{
                            height: '300px',
                            width: '100%'
                          }}
                        />

                        {/* Directions Panel - Floating trên map góc top-left */}
                        {routeInfo && routeInfo.steps && (
                          <div className="directions-panel-overlay">
                            <div className="directions-panel-header">
                              <h5>
                                <i className="fa fa-route"></i>
                                Chỉ đường ({routeInfo.distance}, {routeInfo.duration})
                              </h5>
                              <button
                                className="directions-close-btn"
                                onClick={clearRoute}
                                type="button"
                              >
                                <i className="fa fa-times"></i>
                              </button>
                            </div>
                            <div className="directions-steps">
                              {routeInfo.steps.map((step, index) => (
                                <div key={index} className="direction-step">
                                  <div className="step-icon">
                                    <i className={`fa ${getManeuverIcon(step.maneuver, step.instruction)}`}></i>
                                  </div>
                                  <div className="step-content">
                                    <div
                                      className="step-instruction"
                                      dangerouslySetInnerHTML={{
                                        __html: step.instruction || 'Tiếp tục đi thẳng'
                                      }}
                                    />
                                    <div className="step-distance">{step.distance}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>

                      <div className="location-buttons">
                        <button
                          className="btn location-btn"
                          onClick={getCurrentLocation}
                          disabled={gettingLocation}
                          type="button"
                        >
                          <i className="fa fa-location-arrow"></i>
                          {gettingLocation ? 'Đang lấy...' : 'Vị trí hiện tại'}
                        </button>

                        {/* <button
                          className="btn location-btn directions-btn"
                          onClick={getDirectionsFromCurrentLocation}
                          disabled={isGettingCurrentLocation || isCalculatingRoute || !formData.coordinates?.lat}
                          type="button"
                        >
                          {isGettingCurrentLocation || isCalculatingRoute ? (
                            <>
                              <i className="fa fa-spinner fa-spin"></i>
                              {isGettingCurrentLocation ? 'Đang lấy vị trí...' : 'Đang tính đường...'}
                            </>
                          ) : (
                            <>
                              <i className="fa fa-route"></i>
                              Chỉ đường đến đây
                            </>
                          )}
                        </button> */}

                        {routeInfo && (
                          <button
                            className="btn location-btn clear-btn"
                            onClick={clearRoute}
                            type="button"
                          >
                            <i className="fa fa-times"></i>
                            Xóa đường đi
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hình ảnh và video */}
                <div className="form-section-new-property">
                  <h4>Hình ảnh và video</h4>

                  <div className="form-group">
                    <label>Hình ảnh (tối đa 5 ảnh, ≤ 5 MB/ảnh, định dạng: jpeg, jpg, png, webp, gif, heic, svg) *</label>
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
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current.click()}
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
                    {/* {errors.images && <span className="error-text">{errors.images}</span>} */}

                    {formData.images.length > 0 && (
                      <div className="image-preview-grid">
                        {formData.images.map((img, index) => {
                          // Kiểm tra xem ảnh này có bị từ chối không
                          console.log('Checking image:', img.name, 'against rejected files:', rejectedFiles.images);
                          console.log('Current rejectedFiles state:', rejectedFiles);
                          const isRejected = rejectedFiles.images?.some(rejected => rejected.originalname === img.name);
                          const rejectedInfo = rejectedFiles.images?.find(rejected => rejected.originalname === img.name);
                          console.log('Image rejected status:', isRejected, 'Info:', rejectedInfo);

                          return (
                            <div key={index} className={`image-preview ${isRejected ? 'rejected' : ''}`}>
                              <img
                                src={img.url}
                                alt={`Preview ${index}`}
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
                                  setFormData(prev => ({
                                    ...prev,
                                    images: prev.images.filter((_, i) => i !== index)
                                  }));

                                  // Xóa validation info tương ứng
                                  setFileValidation(prev => ({
                                    ...prev,
                                    images: prev.images.filter((_, i) => i !== index)
                                  }));

                                  // Xóa khỏi danh sách rejected nếu có
                                  if (isRejected) {
                                    setRejectedFiles(prev => {
                                      const newRejectedFiles = {
                                        ...prev,
                                        images: prev.images.filter(rejected => rejected.originalname !== img.name)
                                      };

                                      // Nếu không còn rejected files nào, clear toàn bộ errors liên quan
                                      if (newRejectedFiles.images.length === 0 && newRejectedFiles.videos.length === 0) {
                                        setErrors(prevErrors => {
                                          const newErrors = { ...prevErrors };
                                          delete newErrors.images;
                                          delete newErrors.video;
                                          return newErrors;
                                        });
                                      }

                                      return newRejectedFiles;
                                    });
                                  } else {
                                    // Xóa lỗi validation khi xóa ảnh (trường hợp không phải rejected file)
                                    if (errors.images) {
                                      setErrors(prev => ({
                                        ...prev,
                                        images: ''
                                      }));
                                    }
                                  }
                                }}
                              >
                                <i className="fa fa-times"></i>
                              </button>

                              {/* File validation info */}
                              {fileValidation.images[index] && (
                                <div className={`file-validation-info ${fileValidation.images[index].validation.errors.length > 0 ? 'has-errors' :
                                    fileValidation.images[index].validation.warnings.length > 0 ? 'has-warnings' : ''
                                  }`}>
                                  <div className="file-validation-detail">
                                    <span>{img.name}</span>
                                    <span className="file-size-info">
                                      {img.originalSize && img.originalSize !== img.file.size && (
                                        <span className="file-size-original">{formatFileSize(img.originalSize)}</span>
                                      )}
                                      <span className={img.compressed ? 'file-size-compressed' : ''}>
                                        {formatFileSize(img.file.size)}
                                      </span>
                                      {img.compressed && (
                                        <span className="compression-badge">Đã nén</span>
                                      )}
                                    </span>
                                  </div>
                                  {fileValidation.images[index].validation.warnings.map((warning, wIndex) => (
                                    <div key={wIndex} className="validation-message">
                                      <i className="fa fa-exclamation-triangle"></i>
                                      {warning}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>

                  <div className="form-group">
                    <label>Chọn 1 video, định dạng: mp4, webm, ogg, mov, kích thước tối đa: 50 MB</label>
                    <input
                      type="file"
                      ref={videoInputRef}
                      onChange={handleVideoUpload}
                      accept="video/*"
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => videoInputRef.current.click()}
                    >
                      <i className="fa fa-video-camera"></i>
                      Chọn video
                    </button>
                    {/* {errors.video && <span className="error-text">{errors.video}</span>} */}

                    {formData.video && (
                      <div className="video-preview">
                        {(() => {
                          const isRejected = rejectedFiles.videos?.some(rejected => rejected.originalname === formData.video.name);
                          const rejectedInfo = rejectedFiles.videos?.find(rejected => rejected.originalname === formData.video.name);

                          return (
                            <div className={`video-container ${isRejected ? 'rejected' : ''}`} style={{ position: 'relative' }}>
                              <video
                                controls
                                style={{
                                  maxWidth: '300px',
                                  height: 'auto',
                                  filter: isRejected ? 'blur(3px) grayscale(50%) opacity(0.6)' : 'none',
                                  transition: 'filter 0.3s ease'
                                }}
                              >
                                <source src={formData.video.url} type={formData.video.file.type} />
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
                                  maxWidth: '300px'
                                }}>
                                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>⚠️</div>
                                  <div style={{ fontSize: '12px', textTransform: 'uppercase' }}>Bị từ chối</div>
                                  <div style={{ fontSize: '10px', marginTop: '4px', textAlign: 'center', padding: '0 8px' }}>{rejectedInfo?.reason}</div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <button
                          type="button"
                          className="remove-video"
                          onClick={() => {
                            const isRejected = rejectedFiles.videos?.some(rejected => rejected.originalname === formData.video.name);
                            setFormData(prev => ({
                              ...prev,
                              video: null
                            }));

                            // Xóa validation info
                            setFileValidation(prev => ({
                              ...prev,
                              videos: []
                            }));

                            // Xóa khỏi danh sách rejected nếu có
                            if (isRejected) {
                              setRejectedFiles(prev => {
                                const newRejectedFiles = {
                                  ...prev,
                                  videos: prev.videos.filter(rejected => rejected.originalname !== formData.video.name)
                                };

                                // Nếu không còn rejected files nào, clear toàn bộ errors liên quan
                                if (newRejectedFiles.images.length === 0 && newRejectedFiles.videos.length === 0) {
                                  setErrors(prevErrors => {
                                    const newErrors = { ...prevErrors };
                                    delete newErrors.images;
                                    delete newErrors.video;
                                    return newErrors;
                                  });
                                }

                                return newRejectedFiles;
                              });
                            } else {
                              // Xóa lỗi validation khi xóa video (trường hợp không phải rejected file), nếu có
                              if (errors.video) {
                                setErrors(prev => ({
                                  ...prev,
                                  video: ''
                                }));
                              }
                            }
                          }}
                        >
                          <i className="fa fa-times"></i>
                        </button>


                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit buttons */}
              <div className="form-actions-management">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className={`btn btn-primary ${isSubmitting ? 'loading' : ''}`}
                  disabled={isSubmitting}
                >
                  <i className="fa fa-paper-plane"></i>
                  {isSubmitting ? 'Đang đăng tin...' : 'Đăng tin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


    </div>
  );
};

export default NewProperty;