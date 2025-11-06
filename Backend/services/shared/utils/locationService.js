import axios from "axios";

// Cache tạm trong RAM (nếu server restart thì mất)
const cache = {
  provinces: null,
  wardsByProvince: {},
  lastFetchTime: null
};

// Giới hạn thời gian cache (5 phút)
const CACHE_DURATION = 5 * 60 * 1000;

// Hàm delay tiện ích
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hàm gọi API với retry khi bị 429
const safeAxiosGet = async (url, retries = 3, backoff = 2000) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await axios.get(url);
      return res;
    } catch (error) {
      if (error.response?.status === 429) {
        console.warn(`Rate limited (429). Retry ${attempt}/${retries} after ${backoff}ms`);
        await delay(backoff);
        backoff *= 2; // exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error("Failed after multiple retries due to rate limiting.");
};

export const fetchProvinces = async () => {
  try {
    // Dùng cache nếu có và chưa hết hạn
    if (cache.provinces && Date.now() - cache.lastFetchTime < CACHE_DURATION) {
      return cache.provinces;
    }

    const res = await safeAxiosGet("https://vietnamlabs.com/api/vietnamprovince");
    if (res.data.success) {
      const provinces = res.data.data.map((province) => ({
        id: province.id,
        code: province.id,
        name: province.province,
        licensePlates: province.licensePlates,
      }));

      // Lưu cache
      cache.provinces = provinces;
      cache.lastFetchTime = Date.now();
      return provinces;
    }
    return [];
  } catch (error) {
    console.error("Error in fetchProvinces:", error);
    return [];
  }
};

export const fetchWards = async (provinceName) => {
  try {
    if (!provinceName) return [];

    //  Check cache
    if (cache.wardsByProvince[provinceName]) {
      return cache.wardsByProvince[provinceName];
    }

    const encodedProvinceName = encodeURIComponent(provinceName);
    let allWards = [];
    let offset = 0;
    let hasMore = true;
    const limit = 50;

    while (hasMore) {
      const url = `https://vietnamlabs.com/api/vietnamprovince?province=${encodedProvinceName}&limit=${limit}&offset=${offset}`;
      const res = await safeAxiosGet(url);

      if (res.data.success && res.data.data) {
        const wards = res.data.data.wards || [];
        const pagination = res.data.pagination || {};

        allWards = allWards.concat(wards);
        hasMore = pagination.hasMore === true;
        offset += limit;

        if (offset > 10000) {
          console.warn("Safety break: offset > 10000");
          break;
        }
      } else {
        console.error("API response not successful:", res.data);
        break;
      }
    }

    const formattedWards = allWards.map((ward, index) => ({
      id: index,
      code: ward.name,
      name: ward.name,
      mergedFrom: ward.mergedFrom || [],
    }));

    // Lưu cache để lần sau không gọi lại
    cache.wardsByProvince[provinceName] = formattedWards;
    return formattedWards;
  } catch (error) {
    console.error("Error in fetchWards:", error);
    return [];
  }
};
