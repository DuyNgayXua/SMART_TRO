import React, { useState, useEffect, useRef } from 'react';
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { myPropertiesAPI } from '../../../services/myPropertiesAPI';
import { locationAPI } from '../../../services/locationAPI';
import amenitiesAPI  from '../../../services/amenitiesAPI';
import dayjs from 'dayjs';
import './EditPropertyModal.css';
import '../new-property/RejectedFiles.css';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const EditPropertyModal = ({ property, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [rejectedFiles, setRejectedFiles] = useState({ images: [], videos: [] });
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const lastAddressRef = useRef(null);
  const lastCoordsRef = useRef(null);


  // Location data
  const [locationData, setLocationData] = useState({
    provinces: [],
    districts: [],
    wards: [],
    loadingProvinces: false,
    loadingDistricts: false,
    loadingWards: false,
    geocoding: false
  });

  // Amenities data
  const [amenitiesData, setAmenitiesData] = useState({
    amenities: [],
    loading: false,
    error: null
  });

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

  const houseRulesList = [
    { value: 'no_smoking', label: 'Không hút thuốc' },
    { value: 'no_pets', label: 'Không nuôi thú cưng' },
    { value: 'no_parties', label: 'Không tổ chức tiệc' },
    { value: 'quiet_hours', label: 'Giữ yên tĩnh sau giờ quy định' },
    { value: 'no_overnight_guests', label: 'Không có khách qua đêm' },
    { value: 'keep_clean', label: 'Giữ vệ sinh khu vực chung' },
    { value: 'remove_shoes', label: 'Cởi giày trước khi vào nhà' }
  ];

  useEffect(() => {
    if (property) {
      // Initialize form với tất cả dữ liệu property
      console.log('Loading property for edit:', property);
      console.log('Property amenities:', property.amenities);
      
      // Process amenities - handle both populated objects and ID strings
      const processedAmenities = property.amenities ? 
        property.amenities.map(amenity => {
          const id = typeof amenity === 'object' ? amenity._id : amenity;
          console.log('Processing amenity:', amenity, '-> ID:', id);
          return id;
        }) : [];
      
      console.log('Processed amenities for form:', processedAmenities);
      
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

        // Địa chỉ - cần convert từ name về code
        province: property.province || '',
        district: property.district || '',
        ward: property.ward || '',
        detailAddress: property.detailAddress || '',
        coordinates: property.coordinates || { lat: 16.0583, lng: 108.2772 },

        // Media
        images: property.images || [],
        video: property.video || null,
        existingImages: property.images || [], // Track existing images
        newImages: [], // Track new uploaded images
        removedImages: [] // Track removed images
      });

      loadLocationData(property);
    }
  }, [property]);

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


      // Nếu có province code thì load districts
      if (property.province) {
        setLocationData(prev => ({ ...prev, loadingDistricts: true }));
        const districtsRes = await locationAPI.getDistricts(property.province);

        const districtsData = districtsRes.data || [];

        setLocationData(prev => ({
          ...prev,
          districts: districtsData,
          loadingDistricts: false
        }));

        // So sánh code trong danh sách với property.district
        if (property.district) {


          const districtData = districtsData.find(
            (d) => String(d.code) === String(property.district)
          );


          if (districtData) {
            setFormData(prev => ({ ...prev, district: String(districtData.code) }));

            // Nếu có district thì load wards
            setLocationData(prev => ({ ...prev, loadingWards: true }));
            const wardsRes = await locationAPI.getWards(districtData.code);
            const wardsData = wardsRes.data || [];


            setLocationData(prev => ({
              ...prev,
              wards: wardsData,
              loadingWards: false
            }));

            // Nếu DB có ward thì set lại luôn
            if (property.ward) {
              const wardData = wardsData.find(
                (w) => String(w.code) === String(property.ward)
              );
              if (wardData) {
                setFormData(prev => ({ ...prev, ward: String(wardData.code) }));
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('Error loading location data:', error);
      setLocationData(prev => ({
        ...prev,
        loadingProvinces: false,
        loadingDistricts: false,
        loadingWards: false
      }));
    }
  };

  // Load districts when province changes
  useEffect(() => {
    const loadDistricts = async () => {
      if (!formData.province) {
        setLocationData(prev => ({ ...prev, districts: [], wards: [] }));
        setFormData(prev => ({ ...prev, district: '', ward: '' }));
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
      } catch (error) {
        console.error('Error loading districts:', error);
        setLocationData(prev => ({ ...prev, loadingDistricts: false }));
      }
    };

    if (formData.province) {
      loadDistricts();
    }
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

    if (formData.district) {
      loadWards();
    }
  }, [formData.district]);

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
  // Image upload handler
  const handleImageUpload = (e) => {
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

    // Lấy danh sách tên ảnh đã có (cả ảnh cũ lẫn ảnh mới)
    const existingFileNames = [
      ...(formData.existingImages?.map(img => getFileName(img)) || []),
      ...(formData.newImages?.map(img => getFileName(img)) || [])
    ];

    const duplicateFiles = files.filter(f => existingFileNames.includes(f.name));

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

            // Thêm ảnh mới
            files.forEach(file => {
              const reader = new FileReader();
              reader.onload = (event) => {
                setFormData(prev => ({
                  ...prev,
                  newImages: [
                    ...(prev.newImages || []),
                    { file, url: event.target.result, name: file.name }
                  ]
                }));
              };
              reader.readAsDataURL(file);
            });

            e.target.value = null; // reset input
          }}
          onCancel={() => {
            e.target.value = null; // reset input
          }}
        />,
        { autoClose: false }
      );

      return;
    }

    // Nếu không có trùng → thêm ảnh mới
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData(prev => ({
          ...prev,
          newImages: [
            ...(prev.newImages || []),
            { file, url: event.target.result, name: file.name }
          ]
        }));
      };
      reader.readAsDataURL(file);
    });

    e.target.value = null; // reset input để chọn liên tiếp
  };



  // Video upload handler
  const handleVideoUpload = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    if (files.length > 1) {
      toast.error("Bạn chỉ được chọn tối đa 1 video");
      e.target.value = null;
      return;
    }

    const file = files[0];

    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video không được lớn hơn 50MB");
      e.target.value = null;
      return;
    }

    const newUrl = URL.createObjectURL(file);

    // Nếu đã có video và trùng tên
    if (formData.video && formData.video.name === file.name) {
      toast.warn(
        <ConfirmToast
          message={`Video "${file.name}" đã tồn tại. Bạn có muốn ghi đè không?`}
          onConfirm={() => {
            // Giải phóng URL cũ
            if (formData.video?.url) {
              URL.revokeObjectURL(formData.video.url);
            }

            setFormData((prev) => ({
              ...prev,
              video: {
                file,
                url: newUrl,
                name: file.name,
              },
              removeVideo: false,
            }));
            e.target.value = null;
            toast.dismiss();
          }}
          onCancel={() => {
            URL.revokeObjectURL(newUrl); // không dùng thì revoke luôn
            e.target.value = null;
            toast.dismiss();
          }}
        />,
        { autoClose: false }
      );
      return;
    }

    // Nếu chưa có hoặc khác tên
    if (formData.video?.url) {
      URL.revokeObjectURL(formData.video.url);
    }

    setFormData((prev) => ({
      ...prev,
      video: {
        file,
        url: newUrl,
        name: file.name,
      },
    }));

    e.target.value = null;
  };




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
    setFormData(prev => ({
      ...prev,
      newImages: prev.newImages.filter((_, i) => i !== index)
    }));
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
    const provinceName =
      locationData.provinces.find(p => String(p.code) === String(formData.province))?.name || "";
    const districtName =
      locationData.districts.find(d => String(d.code) === String(formData.district))?.name || "";
    const wardName =
      locationData.wards.find(w => String(w.code) === String(formData.ward))?.name || "";

    return {
      street: formData.detailAddress || "",
      ward: wardName || "",
      district: districtName || "",
      province: provinceName || "",
      country: "Vietnam",
    };
  };




  // Geocode address
  const geocodeAddressConst = async (addressPayload) => {
    if (!addressPayload) return null;

    try {
      setLocationData(prev => ({ ...prev, geocoding: true }));

      console.log("fullAddress payload:", addressPayload);
      const res = await locationAPI.geocodeAddress(addressPayload);

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


  useEffect(() => {
    if (formData.detailAddress && formData.province && formData.district && formData.ward) {
      const timer = setTimeout(async () => {
        const addressPayload = await getFullAddressPayload(formData, locationData);
        const payloadString = JSON.stringify(addressPayload);

        if (addressPayload && payloadString !== lastAddressRef.current) {
          lastAddressRef.current = payloadString;

          console.log("Geocoding payload (Edit):", addressPayload);
          const res = await geocodeAddressConst(addressPayload);

          if (res?.lat && res?.lng) {
            lastCoordsRef.current = res;
            setFormData(prev => ({ ...prev, coordinates: res }));
          } else if (lastCoordsRef.current) {
            setFormData(prev => ({ ...prev, coordinates: lastCoordsRef.current }));
          }
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [formData.detailAddress, formData.ward, formData.district, formData.province, locationData]);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const provinceData = locationData.provinces.find(
        (p) => String(p.code) === String(formData.province)
      );
      const districtData = locationData.districts.find(
        (d) => String(d.code) === String(formData.district)
      );
      const wardData = locationData.wards.find(
        (w) => String(w.code) === String(formData.ward)
      );

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
      formDataToSend.append("district", formData.district || "");
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


      console.log("Existing video:", formData.video);
      console.log("Payload FormData gửi lên:", Object.fromEntries(formDataToSend.entries()));

      // Hiển thị toast thông báo đang xử lý
      toast.info('Đang xử lý cập nhật tin đăng... Vui lòng đợi (có thể mất 1-2 phút do AI moderation)', {
        position: "top-center",
        autoClose: false, // Không tự đóng
        hideProgressBar: false,
        closeOnClick: false,
        pauseOnHover: false,
        draggable: false,
      });

      const response = await myPropertiesAPI.updateProperty(property._id, formDataToSend);

      // Đóng toast loading
      toast.dismiss();

      console.log('🔍 Full API response:', response);
      console.log('🔍 Result success:', response.success);
      console.log('🔍 Result data:', response.data);

      if (response.success) {
        // Kiểm tra nếu có files bị từ chối
        console.log('Checking rejectedFiles:', response.data?.rejectedFiles);
        if (response.data?.rejectedFiles) {
          console.log('Rejected files from backend:', response.data.rejectedFiles);
          console.log('Images rejected :', response.data.rejectedFiles.images);
          console.log('Videos rejected:', response.data.rejectedFiles.videos);
          setRejectedFiles(response.data.rejectedFiles);
          console.log('Updated rejectedFiles state');
          
          // Hiển thị toast với thông tin chi tiết về files bị từ chối
          if (response.data.rejectedFiles.images?.length > 0 || response.data.rejectedFiles.videos?.length > 0) {
            let rejectedMessage = 'Cập nhật thành công, nhưng một số file bị từ chối:\n';
            
            if (response.data.rejectedFiles.images?.length > 0) {
              rejectedMessage += '\nẢnh bị từ chối:\n';
              response.data.rejectedFiles.images.forEach((img, index) => {
                rejectedMessage += `${index + 1}. "${img.originalname}" - ${img.reason}\n`;
              });
            }
            
            if (response.data.rejectedFiles.videos?.length > 0) {
              rejectedMessage += '\nVideo bị từ chối:\n';
              response.data.rejectedFiles.videos.forEach((vid, index) => {
                rejectedMessage += `${index + 1}. "${vid.originalname}" - ${vid.reason}\n`;
              });
            }
            
            toast.warn(rejectedMessage.trim(), {
              position: "top-center",
              autoClose: 15000,
              hideProgressBar: false,
            });
          } else {
            toast.success("Cập nhật tin đăng thành công!");
          }
        } else {
          console.log('⚠️ No rejectedFiles in response or rejectedFiles is undefined/null');
          toast.success("Cập nhật tin đăng thành công!");
        }
        
        onSuccess();
      } else {
        if (response.errors) {
          setErrors(response.errors);
          
          // Xử lý rejected files từ validation error trong success case
          if (response.rejectedFiles) {
            console.log('📥 Rejected files from validation error (success case):', response.rejectedFiles);
            setRejectedFiles(response.rejectedFiles);
            console.log('📥 Updated rejectedFiles state from validation error (success case)');
          }
          
          const errorCount = Object.keys(response.errors).length;
          toast.error(`${response.message || 'Dữ liệu không hợp lệ'}\nCó ${errorCount} lỗi cần sửa. Vui lòng kiểm tra lại form.`, {
            position: "top-right",
            autoClose: 7000,
            hideProgressBar: false,
          });
        } else {
          toast.error(response.message || "Có lỗi xảy ra");
        }
      }
    } catch (error) {
      console.error("Error updating property:", error);
      
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
        } else {
          toast.error(responseData?.message || "Lỗi khi cập nhật tin đăng");
        }
      } else {
        toast.error("Lỗi khi cập nhật tin đăng");
      }
    } finally {
      setLoading(false);
    }
  };



  // Draggable Marker component
  const DraggableMarker = ({ position, onChange }) => {
    const [draggable] = useState(true);
    const markerRef = useRef(null);

    useMapEvents({
      click(e) {
        onChange(e.latlng);
      }
    });
    return (
      <Marker
        position={position}
        draggable={draggable}
        eventHandlers={{
          dragend: () => {
            const marker = markerRef.current;
            if (marker != null) {
              onChange(marker.getLatLng());
            }
          }
        }}
        icon={markerIcon}
        ref={markerRef}
      />
    );
  };


  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Chỉnh sửa tin đăng</h3>
          <button className="close-btn" onClick={onClose}>
            <i className="fa fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="edit-form">
          <div className="form-content">
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
                  Full tiện ích
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

              <div className="form-group">
                <label>Quy định giờ giấc</label>
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
                    value={formData.province || ''}
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
                    value={formData.district || ''}
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
                    value={formData.ward || ''}
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
                    value={formData.detailAddress || ''}
                    onChange={handleInputChange}
                    placeholder="VD: 123 Nguyễn Văn A"
                    className={errors.detailAddress ? 'error' : ''}
                  />

                  {errors.detailAddress && <span className="error-text">{errors.detailAddress}</span>}
                </div>
              </div>

              {/* Leaflet Map */}
              <div className="form-group">
                <label>Vị trí trên bản đồ</label>
                <div className="map-container" style={{ height: '250px', width: '100%' }}>
                  <MapContainer
                    center={formData.coordinates || { lat: '10.8533189', lng: '106.6501853' }}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={true}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution="&copy; OpenStreetMap contributors"
                    />
                    {formData.coordinates && (
                      <DraggableMarker
                        position={formData.coordinates}
                        onChange={(latlng) =>
                          setFormData(prev => ({
                            ...prev,
                            coordinates: { lat: latlng.lat, lng: latlng.lng }
                          }))
                        }
                      />
                    )}
                  </MapContainer>
                </div>

                <div className="coordinates-display">
                  <span>Vĩ độ: {formData.coordinates?.lat?.toFixed(7) || 'N/A'}</span>
                  <span>Kinh độ: {formData.coordinates?.lng?.toFixed(7) || 'N/A'}</span>
                </div>
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
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <i className="fa fa-upload"></i>
                  Chọn hình ảnh
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
                {errors.newImages && <p className="text-danger">{errors.newImages}</p>}
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
                          setFormData((prev) => ({
                            ...prev,
                            video: null,
                            removeVideo: true, // gửi flag cho backend
                          }));
                          // Xóa khỏi rejected files nếu có
                          if (isRejected) {
                            setRejectedFiles(prev => ({
                              ...prev,
                              videos: prev.videos.filter(rejected => rejected.originalname !== videoName)
                            }));
                          }
                        }}
                      >
                        <i className="fa fa-trash" style={{ fontSize: "20px", alignItems: "center", marginLeft: "5px" }}></i>
                      </button>
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

                {errors.video && <p className="text-danger">{errors.video}</p>}
              </div>


            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
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