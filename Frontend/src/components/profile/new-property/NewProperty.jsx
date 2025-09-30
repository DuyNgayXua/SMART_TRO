import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/vi';
import { toast } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";

import { postAPI } from '../../../services/propertiesAPI';
import { locationAPI } from '../../../services/locationAPI';
import amenitiesAPI from '../../../services/amenitiesAPI';
import './../ProfilePages.css';
import './NewProperty.css';

import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';



const defaultCenter = {
  lat: 16.056204,
  lng: 108.168202
};

// Icon mặc định Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

const geocodeAddress = async (address) => {
  try {
    const res = await locationAPI.geocodeAddress(address);
    console.log("Geocode via backend:", res.data);

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
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const lastAddressRef = useRef("");

  // Ref để nhớ toạ độ cuối cùng hợp lệ
  const lastCoordsRef = useRef(null);
  // Ref để theo dõi xem coordinates có được set thủ công không
  const isManuallySetRef = useRef(false);
  // Ref để lưu tọa độ thủ công
  const manualCoordsRef = useRef(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  // Cấu hình dayjs
  dayjs.extend(relativeTime);
  dayjs.locale("vi");

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

    // Địa chỉ
    province: '',
    district: '',
    ward: '',
    detailAddress: '',
    coordinates: defaultCenter,

    // Media
    images: [],
    video: null,

    // Trạng thái
    isForRent: true
  });

  const [errors, setErrors] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [isManuallySet, setIsManuallySet] = useState(false);

  const [showMap, setShowMap] = useState(false);

  // Location data from API
  const [locationData, setLocationData] = useState({
    provinces: [],
    districts: [],
    wards: [],
    loadingProvinces: false,
    loadingDistricts: false,
    loadingWards: false,
    geocoding: false
  });

  // Amenities data from API
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [loadingAmenities, setLoadingAmenities] = useState(false);

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

  // Get user's current location
  const getUserLocation = () => {
    if (!navigator.geolocation) {
      toast.warn('Trình duyệt không hỗ trợ định vị!');
      setFormData(prev => ({
        ...prev,
        coordinates: defaultCenter
      }));
      return;
    }

    setGettingLocation(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userCoords = { lat: latitude, lng: longitude };
        console.log("User location:", userCoords);
        
        // Đánh dấu là đã được set thủ công
        isManuallySetRef.current = true;
        setIsManuallySet(true);
        manualCoordsRef.current = userCoords;
        
        setFormData(prev => ({
          ...prev,
          coordinates: userCoords
        }));
        
        // Cập nhật lastCoordsRef để lưu tọa độ hợp lệ
        lastCoordsRef.current = userCoords;
        setGettingLocation(false);
      },
      (error) => {
        console.error('Error getting user location:', error);
        setGettingLocation(false);

        let errorMessage = '';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Người dùng từ chối chia sẻ vị trí';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Không thể xác định vị trí';
            break;
          case error.TIMEOUT:
            errorMessage = 'Hết thời gian chờ định vị';
            break;
          default:
            errorMessage = 'Lỗi không xác định khi định vị';
            break;
        }

        toast.error(`${errorMessage}. Sử dụng vị trí mặc định.`);
        setFormData(prev => ({
          ...prev,
          coordinates: defaultCenter
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0
      }
    );
  };

  // Initialize user location when component mounts
  useEffect(() => {
    // Đảm bảo coordinates luôn có giá trị ban đầu
    if (!formData.coordinates || !formData.coordinates.lat || !formData.coordinates.lng) {
      setFormData(prev => ({
        ...prev,
        coordinates: defaultCenter
      }));
      lastCoordsRef.current = defaultCenter;
    }
    getUserLocation();
  }, []);

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

  // Handle modal show/hide và Google Maps
  useEffect(() => {
    if (showModal) {
      // Delay để modal render hoàn toàn trước khi hiển thị map
      const timer = setTimeout(() => {
        setShowMap(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowMap(false);
    }
  }, [showModal]);

  // Load provinces when component mounts
  useEffect(() => {
    const loadProvinces = async () => {
      try {
        setLocationData(prev => ({ ...prev, loadingProvinces: true }));
        const provinces = await locationAPI.getProvinces();

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

  // Load districts when province changes
  useEffect(() => {
    const loadDistricts = async () => {
      if (!formData.province) {
        setLocationData(prev => ({ ...prev, districts: [], wards: [] }));
        setFormData(prev => ({ ...prev, district: '', ward: '' }));
        // Reset manual flag khi không có tỉnh
        isManuallySetRef.current = false;
        setIsManuallySet(false);
        manualCoordsRef.current = null;
        return;
      }

      try {
        setLocationData(prev => ({ ...prev, loadingDistricts: true }));
        const districts = await locationAPI.getDistricts(formData.province);
        setLocationData(prev => ({
          ...prev,
          districts: districts.data || [],
          loadingDistricts: false,
          wards: []
        }));
        setFormData(prev => ({ ...prev, district: '', ward: '' }));
        // Reset manual flag khi thay đổi tỉnh để cho phép geocoding tự động
        isManuallySetRef.current = false;
        setIsManuallySet(false);
        manualCoordsRef.current = null;
      } catch (error) {
        console.error('Error loading districts:', error);
        setLocationData(prev => ({ ...prev, loadingDistricts: false }));
      }
    };

    loadDistricts();
  }, [formData.province]);

  // Load wards when district changes
  useEffect(() => {
    const loadWards = async () => {
      if (!formData.district) {
        setLocationData(prev => ({ ...prev, wards: [] }));
        setFormData(prev => ({ ...prev, ward: '' }));
        return;
      }

      try {
        setLocationData(prev => ({ ...prev, loadingWards: true }));
        const wards = await locationAPI.getWards(formData.district);
        setLocationData(prev => ({
          ...prev,
          wards: wards.data || [],
          loadingWards: false
        }));
        setFormData(prev => ({ ...prev, ward: '' }));
      } catch (error) {
        console.error('Error loading wards:', error);
        setLocationData(prev => ({ ...prev, loadingWards: false }));
      }
    };

    loadWards();
  }, [formData.district]);

  // Geocode address when all address fields are filled
  useEffect(() => {
    const timer = setTimeout(() => {
      if (formData.province && formData.district && formData.ward && formData.detailAddress.trim()) {
        geocodeAddress();
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData.province, formData.district, formData.ward, formData.detailAddress]);

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
      let provinceName = "", districtName = "", wardName = "";

      // Province
      const province = locationData.provinces.find(
        p => String(p.code) === String(formData.province)
      );
      if (province) {
        provinceName = province.name;
      } else if (formData.province) {
        const res = await locationAPI.getProvinces();
        const found = res.data.find(p => String(p.code) === String(formData.province));
        provinceName = found ? found.name : "";
      }

      // District
      const district = locationData.districts.find(
        d => String(d.code) === String(formData.district)
      );
      if (district) {
        districtName = district.name;
      } else if (formData.district) {
        const res = await locationAPI.getDistricts(formData.province);
        const found = res.data.find(d => String(d.code) === String(formData.district));
        districtName = found ? found.name : "";
      }

      // Ward
      const ward = locationData.wards.find(
        w => String(w.code) === String(formData.ward)
      );
      if (ward) {
        wardName = ward.name;
      } else if (formData.ward) {
        const res = await locationAPI.getWards(formData.district);
        const found = res.data.find(w => String(w.code) === String(formData.ward));
        wardName = found ? found.name : "";
      }

      return {
        street: formData.detailAddress || "",
        ward: wardName || "",
        district: districtName || "",
        province: provinceName || "",
        country: "Vietnam"
      };
    } catch (err) {
      console.error("Error building full address payload:", err);
      return null;
    }
  };



  // --- Auto-update coordinates when address changes ---
  useEffect(() => {
    if (formData.detailAddress && formData.province && formData.district && formData.ward) {
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
  }, [formData.detailAddress, formData.ward, formData.district, formData.province, locationData]);





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




// Image upload handler
const handleImageUpload = (e) => {
  const files = Array.from(e.target.files);

  // kiểm tra tổng ảnh
  if (formData.images.length + files.length > 5) {
    toast.error("Bạn chỉ được chọn tối đa 5 ảnh.");
    e.target.value = null; // reset input
    return;
  }

  const existingFileNames = formData.images.map(img => img.name);
  const duplicateFiles = files.filter(f => existingFileNames.includes(f.name));

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

          // Thêm ảnh mới
          files.forEach(file => {
            const reader = new FileReader();
            reader.onload = (event) => {
              setFormData(prev => ({
                ...prev,
                images: [...prev.images, {
                  file,
                  url: event.target.result,
                  name: file.name
                }]
              }));
            };
            reader.readAsDataURL(file);
          });

          e.target.value = null; // reset input sau confirm
        }}
        onCancel={() => {
          e.target.value = null; // reset input sau khi cancel
        }}
      />,
      { autoClose: false }
    );

    return;
  }

  // nếu không có trùng → thêm ảnh mới
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, {
          file,
          url: event.target.result,
          name: file.name
        }]
      }));
    };
    reader.readAsDataURL(file);
  });

  e.target.value = null; // luôn reset input sau mỗi lần up
};




  // Video upload handler
const handleVideoUpload = (e) => {
  const file = e.target.files[0];
  if (file.length > 1) {
    toast.error("Bạn chỉ được chọn tối đa 1 video");
    e.target.value = null;
    return;
  }
  if (!file) return;

  // Nếu đã có video trùng tên
  if (formData.video && formData.video.name === file.name) {
    toast.warn(
      <ConfirmToast
        message={`Video "${file.name}" đã tồn tại. Bạn có muốn ghi đè không?`}
        onConfirm={() => {
          const reader = new FileReader();
          reader.onload = (event) => {
            setFormData(prev => ({
              ...prev,
              video: {
                file,
                url: event.target.result,
                name: file.name
              }
            }));
          };
          reader.readAsDataURL(file);
        }}
        onCancel={() => {
          e.target.value = null; // clear input
        }}
      />,
      { autoClose: false }
    );
  } else {
    // Nếu chưa có video → thêm mới
    const reader = new FileReader();
    reader.onload = (event) => {
      setFormData(prev => ({
        ...prev,
        video: {
          file,
          url: event.target.result,
          name: file.name
        }
      }));
    };
    reader.readAsDataURL(file);
  }

  // Reset input để chọn cùng file liên tiếp vẫn trigger được
  e.target.value = null;

  // clear error nếu có
  if (errors.video) {
    setErrors(prev => ({
      ...prev,
      video: ''
    }));
  }
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


  // Submit form
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setIsSubmitting(true);

    try {
      toast.info('Đang xử lý đăng tin...', {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
      });

      // Tìm tên từ code để gửi lên backend
      const provinceData = locationData.provinces.find(p => p.code === formData.province);
      const districtData = locationData.districts.find(d => d.code === formData.district);
      const wardData = locationData.wards.find(w => w.code === formData.ward);

      // Đảm bảo coordinates luôn có giá trị hợp lệ - ưu tiên tọa độ thủ công
      let finalCoordinates;
      
      // Nếu có tọa độ thủ công, sử dụng tọa độ đó
      if (isManuallySetRef.current && manualCoordsRef.current) {
        finalCoordinates = manualCoordsRef.current;
        console.log("Using manually set coordinates:", finalCoordinates);
      } else if (formData.coordinates && formData.coordinates.lat && formData.coordinates.lng) {
        finalCoordinates = formData.coordinates;
        console.log("Using current coordinates:", finalCoordinates);
      } else {
        // Nếu coordinates không hợp lệ, thử geocode lại
        console.log("Coordinates invalid, attempting final geocode...");
        const addressPayload = await getFullAddressPayload(formData, locationData);
        if (addressPayload) {
          const coords = await geocodeAddress(addressPayload);
          if (coords && coords.lat && coords.lng) {
            finalCoordinates = coords;
            console.log("Final geocode successful:", coords);
          }
        }
      }

      // Nếu vẫn không có coordinates hợp lệ, sử dụng coordinates mặc định
      if (!finalCoordinates || !finalCoordinates.lat || !finalCoordinates.lng) {
        finalCoordinates = defaultCenter;
        console.log("Using default coordinates:", defaultCenter);
        toast.warn("Không thể xác định vị trí chính xác, sử dụng vị trí mặc định. Bạn có thể chỉnh sửa sau.");
      }

      const dataToSubmit = {
        ...formData,
        availableDate: formatDateForBackend(formData.availableDate),
        coordinates: finalCoordinates, // Đảm bảo coordinates được gửi ở root level
        // Gửi name để backend lưu trữ (vì schema yêu cầu name)
        province: provinceData?.name || formData.province,
        district: districtData?.name || formData.district, 
        ward: wardData?.name || formData.ward,
        // Giữ location object để backward compatibility
        location: {
          province: provinceData?.name || formData.province,
          district: districtData?.name || formData.district,
          ward: wardData?.name || formData.ward,
          detailAddress: formData.detailAddress,
          coordinates: finalCoordinates
        }
      };

      console.log('Data to submit:', dataToSubmit);
      console.log('Final coordinates being sent:', finalCoordinates);

      const result = await postAPI.createPost(dataToSubmit);

      if (result.success) {
        toast.success(`Đăng tin thành công! "${formData.title}" - Trạng thái: Chờ admin duyệt`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
        });

        setShowModal(false);

        // Reset form
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
          district: '',
          ward: '',
          detailAddress: '',
          coordinates: defaultCenter,
          images: [],
          video: null,
          isForRent: true
        });

        setErrors({});
        // Reset manual coordinate flags
        isManuallySetRef.current = false;
        setIsManuallySet(false);
        manualCoordsRef.current = null;
        lastAddressRef.current = "";
        lastCoordsRef.current = null;
        
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (videoInputRef.current) videoInputRef.current.value = '';
        getUserLocation();

      } else {
        if (result.errors) {
          setErrors(result.errors);
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

  // Map click handler trực tiếp trong component
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const clickedCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
        console.log("Map clicked, new coordinates:", clickedCoords);
        
        // Đánh dấu là đã được set thủ công
        isManuallySetRef.current = true;
        setIsManuallySet(true);
        manualCoordsRef.current = clickedCoords;
        
        setFormData(prev => ({ 
          ...prev, 
          coordinates: clickedCoords 
        }));
        
        // Cập nhật lastCoordsRef để lưu tọa độ hợp lệ
        lastCoordsRef.current = clickedCoords;
        
        console.log("Coordinates manually set to:", clickedCoords);
      },
    });
    return null;
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="post-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tạo tin đăng mới</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <i className="fa fa-times"></i>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="post-new-property">
              <div className="form-content">
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

                  <div className="form-row">
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
                        placeholder="VD: 3000000"
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
                        placeholder="VD: 2500000"
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
                        placeholder="VD: 3000000"
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
                        placeholder="VD: 3500"
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
                        placeholder="VD: 15000"
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

                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        name="fullAmenities"
                        checked={formData.fullAmenities}
                        onChange={handleInputChange}
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
                    <label>Quy định giờ giấc</label>
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
                        value={formData.province}
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
                      <label>Quận/Huyện *</label>
                      <select
                        name="district"
                        value={formData.district}
                        onChange={handleInputChange}
                        className={errors.district ? 'error' : ''}
                        disabled={locationData.loadingDistricts || !formData.province}
                      >
                        <option value="">
                          {locationData.loadingDistricts ? 'Đang tải...' :
                            !formData.province ? 'Chọn tỉnh trước' : 'Chọn quận/huyện'}
                        </option>
                        {locationData.districts.map(district => (
                          <option key={district.code} value={district.code}>
                            {district.name}
                          </option>
                        ))}
                      </select>
                      {errors.district && <span className="error-text">{errors.district}</span>}
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Phường/Xã *</label>
                      <select
                        name="ward"
                        value={formData.ward}
                        onChange={handleInputChange}
                        className={errors.ward ? 'error' : ''}
                        disabled={locationData.loadingWards || !formData.district}
                      >
                        <option value="">
                          {locationData.loadingWards ? 'Đang tải...' :
                            !formData.district ? 'Chọn quận trước' : 'Chọn phường/xã'}
                        </option>
                        {locationData.wards.map(ward => (
                          <option key={ward.code} value={ward.code}>
                            {ward.name}
                          </option>
                        ))}
                      </select>
                      {errors.ward && <span className="error-text">{errors.ward}</span>}
                    </div>

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
                    <label>Vị trí trên bản đồ</label>
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
                          <i className={`fa ${isManuallySet ? 'fa-hand-paper-o' : 'fa-magic'}`} style={{ color: isManuallySet ? '#28a745' : '#007bff' }}></i>
                          <span>Trạng thái: <strong style={{ color: isManuallySet ? '#28a745' : '#007bff' }}>
                            {isManuallySet ? 'Đã chỉnh thủ công' : 'Tự động geocoding'}
                          </strong></span>
                        </div>
                      </div>
                      <p className="address-hint">💡 Nhấp vào bản đồ để chọn vị trí chính xác</p>

                      <div>
                        <MapContainer
                          center={[formData.coordinates.lat, formData.coordinates.lng]}
                          zoom={13}
                          style={{ height: '300px', width: '100%' }}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={[formData.coordinates.lat, formData.coordinates.lng]} />
                          <MapClickHandler />
                        </MapContainer>
                      </div>

                      <div className="location-buttons">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={getUserLocation} disabled={gettingLocation}>
                          <i className={`fa ${gettingLocation ? 'fa-spinner fa-spin' : 'fa-location-arrow'}`}></i>
                          {gettingLocation ? 'Đang định vị...' : 'Lấy vị trí hiện tại'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                          // Reset về tọa độ mặc định và cho phép geocoding tự động
                          isManuallySetRef.current = false;
                          setIsManuallySet(false);
                          manualCoordsRef.current = null;
                          setFormData(prev => ({ ...prev, coordinates: defaultCenter }));
                          console.log("Reset to auto geocoding mode");
                        }}>
                          <i className="fa fa-refresh"></i>
                          Reset & Auto Geo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Hình ảnh và video */}
                <div className="form-section-new-property">
                  <h4>Hình ảnh và video</h4>

                  <div className="form-group">
                    <label>Hình ảnh (tối đa 5 ảnh) *</label>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      multiple
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => fileInputRef.current.click()}
                    >
                      <i className="fa fa-upload"></i>
                      Chọn hình ảnh
                    </button>
                    {errors.images && <span className="error-text">{errors.images}</span>}

                    {formData.images.length > 0 && (
                      <div className="image-preview-grid">
                        {formData.images.map((img, index) => (
                          <div key={index} className="image-preview">
                            <img src={img.url} alt={`Preview ${index}`} />
                            <button
                              type="button"
                              className="remove-image-new-property"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  images: prev.images.filter((_, i) => i !== index)
                                }));
                              }}
                            >
                              <i className="fa fa-times"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Video (tùy chọn)</label>
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
                    {errors.video && <span className="error-text">{errors.video}</span>}

                    {formData.video && (
                      <div className="video-preview">
                        <video controls style={{ maxWidth: '300px', height: 'auto' }}>
                          <source src={formData.video.url} type={formData.video.file.type} />
                        </video>
                        <button
                          type="button"
                          className="remove-video"
                          onClick={() => {
                            setFormData(prev => ({
                              ...prev,
                              video: null
                            }));
                          }}
                        >

                          Xóa video
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