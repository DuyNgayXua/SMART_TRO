import axios from "axios";
import { fetchProvinces, fetchWards } from "../../shared/utils/locationService.js";

// Cập nhật để sử dụng vietnamlabs.com API (loại bỏ districts, wardId)
export const getProvinces = async (req, res) => {
  try {
    const provinces = await fetchProvinces();
    res.status(200).json({ success: true, data: provinces });
  } catch (error) {
    console.error('Error in getProvinces:', error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách tỉnh thành" });
  }
};

// Lấy danh sách phường/xã theo tỉnh (cập nhật cho cấu trúc mới)
export const getWards = async (req, res) => {
  try {
    const { provinceName } = req.params;
    const wards = await fetchWards(provinceName);
    res.status(200).json({ success: true, data: wards });
  } catch (error) {
    console.error('Error in getWards:', error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách phường xã" });
  }
};


const LOCATIONIQ_API_KEY = process.env.LOCATIONIQ_API_KEY;

// Geocoding với LocationIQ
export const geocodeAddress = async (req, res) => {
  try {
    const { address } = req.body; // Object address
    console.log("Received geocoding request for address:", address);
    if (!address) {
      return res.status(400).json({
        success: false,
        message: "Thiếu object address trong request body",
      });
    }

    const { street, ward, province, country } = address;
    // console.log("Geocoding request:", { street, ward, province, country });

    if (!street && !ward && !province) {
      return res.status(400).json({
        success: false,
        message: "Vui lòng cung cấp đủ thông tin địa chỉ",
      });
    }

    // Gọi structured search API (cập nhật cho cấu trúc mới)
    const response = await axios.get(
      `https://us1.locationiq.com/v1/search/structured`,
      {
        params: {
          key: LOCATIONIQ_API_KEY,
          street: street || "",
          suburb: ward || "",      // Phường/Xã
          state: province || "",   // Tỉnh/TP
          country: country || "Vietnam",
          format: "json",
          limit: 10,
        },
        timeout: 10000,
      }
    );

    const results = response.data;
    // console.log("Geocoding results:", results);

    if (results && results.length > 0) {
      const best = results.sort((a, b) => b.importance - a.importance)[0];
      const coordinates = {
        lat: parseFloat(best.lat),
        lng: parseFloat(best.lon),
      };

      return res.status(200).json({
        success: true,
        data: {
          coordinates,
          display_name: best.display_name,
          boundingbox: best.boundingbox,
        },
      });
    } else {
      return res.status(200).json({
        success: false,
        message: "Không tìm thấy địa chỉ chính xác",
        data: null,
      });
    }
  } catch (error) {
    console.error("Geocoding error (LocationIQ):", error);

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: "Quá nhiều yêu cầu (rate limit), vui lòng thử lại sau",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Lỗi khi tìm kiếm địa chỉ",
      data: null,
    });
  }
};




