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
import './../ProfilePages.css';
import './NewProperty.css';
import './RejectedFiles.css';
import './PackagePostTypeSelector.css';


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

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [images, setImages] = useState([]);
  const [videos, setVideos] = useState([]);

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

    // Package & Post Type
    postType: '',

    // Trạng thái
    isForRent: true
  });

  const [errors, setErrors] = useState({});
  const [rejectedFiles, setRejectedFiles] = useState({ images: [], videos: [] });
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

  // Package data
  const [packageInfo, setPackageInfo] = useState(null);
  const [availablePostTypes, setAvailablePostTypes] = useState([]);
  const [loadingPackage, setLoadingPackage] = useState(false);



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
        // console.log("User location:", userCoords);

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

  // Initialize user location and user info when component mounts
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

    // Không auto-fill thông tin liên hệ - để user tự nhập
  }, []);

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

    // Xóa lỗi validation và clear rejected files cache khi upload ảnh mới
    if (errors.images) {
      setErrors(prev => ({
        ...prev,
        images: ''
      }));
    }

    // Clear rejected files cache khi có ảnh mới được upload
    if (rejectedFiles.images?.length > 0) {
      console.log('Clearing rejected files cache on new image upload');
      setRejectedFiles(prev => ({
        ...prev,
        images: []
      }));
    }

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

    // clear error và rejected files cache nếu có
    if (errors.video) {
      setErrors(prev => ({
        ...prev,
        video: ''
      }));
    }

    // Clear rejected videos cache khi có video mới được upload
    if (rejectedFiles.videos?.length > 0) {
      console.log('Clearing rejected videos cache on new video upload');
      setRejectedFiles(prev => ({
        ...prev,
        videos: []
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
    const name = displayName?.toLowerCase() || '';
    if (name.includes('tin vip đặc biệt')) return 'TIN VIP ĐẶC BIỆT';
    if (name.includes('tin vip nổi bật')) return 'TIN VIP NỔI BẬT';
    if (name.includes('tin vip 1')) return 'TIN VIP 1';
    if (name.includes('tin vip 2')) return 'TIN VIP 2';
    if (name.includes('tin vip 3')) return 'TIN VIP 3';
    if (name.includes('tin thường')) return 'TIN THƯỜNG';
    return displayName;
  };

  const getPostTypeInfo = (displayName) => {
    const name = displayName?.toLowerCase() || '';
    if (name.includes('tin vip đặc biệt')) return { stars: 5, color: '#8b0000' };
    if (name.includes('tin vip nổi bật')) return { stars: 5, color: '#dc3545' };
    if (name.includes('tin vip 1')) return { stars: 4, color: '#e83e8c' };
    if (name.includes('tin vip 2')) return { stars: 3, color: '#fd7e14' };
    if (name.includes('tin vip 3')) return { stars: 2, color: '#20c997' };
    if (name.includes('tin thường')) return { stars: 0, color: '#6c757d' };
    return { stars: 0, color: '#6c757d' };
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

      // Tìm tên từ code để gửi lên backend
      const provinceData = locationData.provinces.find(p => p.code === formData.province);
      const districtData = locationData.districts.find(d => d.code === formData.district);
      const wardData = locationData.wards.find(w => w.code === formData.ward);

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
            district: '',
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

        getUserLocation();

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
          
          console.log('📈 Post type limit updated from server:', {
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
                            className="btn btn-primary btn-upgrade"
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
                            className="btn btn-primary btn-upgrade"
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
                                    const postTypeInfo = getPostTypeInfo(selectedItem.postType.displayName);
                                    return postTypeInfo.color;
                                  }
                                  return '#333'; // Màu mặc định
                                })(),
                                fontWeight: (() => {
                                  if (!formData.postType) return '400';
                                  
                                  const selectedItem = availablePostTypes.find(item => item.postType._id === formData.postType);
                                  if (selectedItem) {
                                    const postTypeInfo = getPostTypeInfo(selectedItem.postType.displayName);
                                    return postTypeInfo.stars > 0 ? '600' : '400';
                                  }
                                  return '400';
                                })(),
                                fontSize: '16px'
                              }}
                            >
                              <option value="">Chọn loại tin đăng</option>
                              {availablePostTypes.map((item, index) => {
                                const isDisabled = item.remainingCount <= 0;
                                const postTypeInfo = getPostTypeInfo(item.postType.displayName);
                                const starsText = postTypeInfo.stars > 0
                                  ? ' ' + '★'.repeat(postTypeInfo.stars)
                                  : '';

                                return (
                                  <option
                                    key={index}
                                    value={item.postType._id}
                                    disabled={isDisabled}
                                    style={{
                                      color: isDisabled ? '#ccc' : postTypeInfo.color,
                                      fontWeight: postTypeInfo.stars > 0 ? '600' : '400'
                                    }}
                                  >
                                    {formatPostTypeName(item.postType.displayName)}{' '}
                                    {starsText} {' '}
                                    ({item.remainingCount} còn lại)
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
                        <button type="button" className="btn btn-secondary btn-sm-location" onClick={getUserLocation} disabled={gettingLocation}>
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
                            </div>
                          );
                        })}
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