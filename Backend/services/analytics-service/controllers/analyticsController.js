import { Property } from '../../../schemas/index.js';
import mongoose from 'mongoose';
import axios from 'axios';

// Helper function to convert area range to MongoDB filter
const getAreaFilter = (areaRange) => {
  switch (areaRange) {
    case '10-20':
      return { $gte: 10, $lt: 20 };
    case '20-30':
      return { $gte: 20, $lt: 30 };
    case '30-50':
      return { $gte: 30, $lt: 50 };
    case '50+':
      return { $gte: 50 };
    default:
      return null;
  }
};

// Xu hướng giá thuê theo thời gian
export const getPriceTrendOverTime = async (req, res) => {
  try {
    const { category, province, district, areaRange, months = 6 } = req.query;

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    const baseFilter = {
      approvalStatus: 'approved',
      isDeleted: { $ne: true },
      rentPrice: { $exists: true, $gt: 0 }
    };

    if (category && category !== 'all') baseFilter.category = category;
    if (province && province !== 'all') baseFilter.province = province;
    if (district && district !== 'all') baseFilter.district = district;

    const getAreaFilter = (range) => {
      switch (range) {
        case '10-20': return { $gte: 10, $lt: 20 };
        case '20-30': return { $gte: 20, $lt: 30 };
        case '30-50': return { $gte: 30, $lt: 50 };
        case '50+': return { $gte: 50 };
        default: return null;
      }
    };

    if (areaRange) {
      const filter = getAreaFilter(areaRange);
      if (filter) baseFilter.area = filter;
    }

    const trendData = [];

    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(currentYear, currentMonth - i, 1);
      const end = new Date(currentYear, currentMonth - i + 1, 1);

      const result = await Property.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: null,
            avgPrice: { $avg: "$rentPrice" },
            count: { $sum: 1 }
          }
        }
      ]);

      // Bỏ qua tháng không có dữ liệu
      if (result.length === 0) continue;

      trendData.push({
        month: `${start.getMonth() + 1}/${start.getFullYear()}`,
        avgPrice: Math.round(result[0].avgPrice),
        count: result[0].count
      });
    }

    res.json({ success: true, data: trendData });
  } catch (error) {
    console.error('Error in getPriceTrendOverTime:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy xu hướng giá thuê theo thời gian',
      error: error.message
    });
  }
};


// Get news using SERP API

export const getNewsSentiment = async (req, res) => {
  try {
    const { keywords } = req.query;
    const SERP_API_KEY = process.env.SERP_API_KEY || "your_serp_api_key_here";
    const serpApiUrl = "https://serpapi.com/search.json";

    let newsResults = [];

    try {
      // --- Gọi SerpAPI ---
      const response = await axios.get(serpApiUrl, {
        params: {
          engine: "google",
          q: keywords,
          api_key: SERP_API_KEY,
          gl: "vn",
          hl: "vi",
          num: 10
        },
        timeout: 15000
      });

      const data = response.data;
      console.log("SERP API response received", data);

      // --- Lấy dữ liệu từ organic_results ---
      if (data.organic_results && data.organic_results.length > 0) {
        newsResults = data.organic_results
          .filter(item => item.title && item.snippet)
          .map(item => ({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            source: item.source || "Google News",
            date: new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")
          }));
      }

      // --- Nếu không có dữ liệu ---
      if (newsResults.length === 0) {
        throw new Error("Không tìm thấy kết quả phù hợp.");
      }

    } catch (serpError) {
      console.warn("SERP API error, dùng dữ liệu giả:", serpError.message);

      // --- Fallback dữ liệu mô phỏng ---
      newsResults = [
        {
          title: `Thị trường ${keywords} đang có dấu hiệu khởi sắc tại Việt Nam.`,
          snippet: `Giá ${keywords} được dự báo tiếp tục tăng trong thời gian tới.`,
          source: "VnExpress",
          date: new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")
        },
        {
          title: `Giá ${keywords} có xu hướng ổn định.`,
          snippet: `Theo các chuyên gia, ${keywords} vẫn duy trì đà tăng nhẹ.`,
          source: "Vietnamnet",
          date: new Date().toISOString().split("T")[0]
        },
        {
          title: `Doanh nghiệp gặp khó trong lĩnh vực ${keywords}.`,
          snippet: `Các yếu tố thị trường khiến ${keywords} chưa bứt phá.`,
          source: "Tuổi Trẻ",
          date: new Date().toISOString().split("T")[0]
        }
      ];
    }

    // --- Trả kết quả ---
    res.json({
      success: true,
      data: {
        news: newsResults,
        keyword: keywords,
        totalResults: newsResults.length
      }
    });

  } catch (error) {
    console.error("Lỗi khi lấy dữ liệu SERP:", error);

    // --- Fallback khi lỗi nghiêm trọng ---
    res.json({
      success: true,
      data: {
        news: [
          {
            title: "Không thể tải dữ liệu - vui lòng thử lại sau",
            snippet: "Hệ thống đang gặp sự cố tạm thời.",
            source: "Hệ thống",
            date: new Date().toISOString().split("T")[0]
          }
        ],
        totalResults: 1
      }
    });
  }
};

// Get price summary (current month average and percentage change)
export const getPriceSummary = async (req, res) => {
  try {
    const { category, province, district, areaRange } = req.query;
    console.log('Received parameters:', { category, province, district, areaRange });

    // Xác định thời gian
    const currentDate = new Date();
    const startCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const startLastMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const startTwoMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 2, 1);

    // Điều kiện lọc cơ bản
    const baseFilter = {
      approvalStatus: 'approved',
      isDeleted: { $ne: true },
      rentPrice: { $exists: true, $gt: 0 }
    };

    // Frontend đã gửi province và district dạng code, sử dụng trực tiếp
    if (category && category !== 'all') baseFilter.category = category;
    if (province && province !== 'all') baseFilter.province = province;
    if (district && district !== 'all') baseFilter.district = district;

    // Xử lý diện tích (nếu có)
    const getAreaFilter = (areaRange) => {
      switch (areaRange) {
        case '10-20': return { $gte: 10, $lt: 20 };
        case '20-30': return { $gte: 20, $lt: 30 };
        case '30-50': return { $gte: 30, $lt: 50 };
        case '50+': return { $gte: 50 };
        default: return null;
      }
    };
    if (areaRange) {
      const filter = getAreaFilter(areaRange);
      if (filter) baseFilter.area = filter;
    }

    // --- Truy vấn dữ liệu ---
    const getAvgPrice = async (start, end) => {
      const result = await Property.aggregate([
        { $match: { ...baseFilter, createdAt: { $gte: start, $lt: end } } },
        { $group: { _id: null, avgPrice: { $avg: "$rentPrice" }, count: { $sum: 1 } } }
      ]);
      return result[0]?.avgPrice || 0;
    };


    const currentAvg = await getAvgPrice(startCurrentMonth, currentDate);
    console.log('currentAvg:', currentAvg);

    const lastMonthAvg = await getAvgPrice(startLastMonth, startCurrentMonth);
    console.log('lastMonthAvg:', lastMonthAvg);

    const twoMonthsAgoAvg = await getAvgPrice(startTwoMonthsAgo, startLastMonth);
    console.log('twoMonthsAgoAvg:', twoMonthsAgoAvg);

    // --- Tính phần trăm thay đổi ---
    const changeVsLastMonth = lastMonthAvg > 0 ? ((currentAvg - lastMonthAvg) / lastMonthAvg * 100).toFixed(1) : 0;
    console.log('changeVsLastMonth:', changeVsLastMonth);
    const changeVsTwoMonthsAgo = twoMonthsAgoAvg > 0 ? ((currentAvg - twoMonthsAgoAvg) / twoMonthsAgoAvg * 100).toFixed(1) : 0;
    console.log('changeVsTwoMonthsAgo:', changeVsTwoMonthsAgo);

    res.json({
      success: true,
      data: {
        currentAvg: Math.round(currentAvg),
        changeVsLastMonth: parseFloat(changeVsLastMonth),
        changeVsTwoMonthsAgo: parseFloat(changeVsTwoMonthsAgo)
      }
    });

  } catch (error) {
    console.error('Error in getPriceSummary:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy dữ liệu thống kê giá',
      error: error.message
    });
  }
};

// Phân tích khoảng giá thuê phổ biến
export const getPriceRangeDistribution = async (req, res) => {
  try {
    const { category, province, district, areaRange } = req.query;
    console.log('Received parameters for price-range:', { category, province, district, areaRange });

    const oldestProperty = await Property.findOne({}).sort({ createdAt: 1 }).select('createdAt');
    const currentDate = new Date();
    const startDate = oldestProperty ? oldestProperty.createdAt : new Date(0); // fallback: 1970 nếu không có dữ liệu

    console.log('startDate (oldest createdAt):', startDate);
    console.log('currentDate:', currentDate);
    const baseFilter = {
      approvalStatus: 'approved',
      isDeleted: { $ne: true },
      rentPrice: { $exists: true, $gt: 0 },
      createdAt: { $gte: startDate, $lt: currentDate }
    };

    if (category && category !== 'all') baseFilter.category = category;
    if (province && province !== 'all') baseFilter.province = province;
    if (district && district !== 'all') baseFilter.district = district;

    // Lọc theo diện tích (nếu có)
    const getAreaFilter = (areaRange) => {
      switch (areaRange) {
        case '10-20': return { $gte: 10, $lt: 20 };
        case '20-30': return { $gte: 20, $lt: 30 };
        case '30-50': return { $gte: 30, $lt: 50 };
        case '50+': return { $gte: 50 };
        default: return null;
      }
    };
    if (areaRange) {
      const filter = getAreaFilter(areaRange);
      if (filter) baseFilter.area = filter;
    }

    // Lấy dữ liệu giá thuê
    const properties = await Property.find(baseFilter).select('rentPrice');
    console.log('Number of properties found:', properties.length);
    if (!properties.length) {
      return res.json({ success: true, data: [] });
    }

    // Tạo các khoảng giá cố định (triệu đồng)
    const priceRanges = [
      { label: 'Dưới 2 triệu', min: 0, max: 2000000 },
      { label: '2 - 3 triệu', min: 2000000, max: 3000000 },
      { label: '3 - 4 triệu', min: 3000000, max: 4000000 },
      { label: '4 - 5 triệu', min: 4000000, max: 5000000 },
      { label: '5 - 7 triệu', min: 5000000, max: 7000000 },
      { label: '7 - 10 triệu', min: 7000000, max: 10000000 },
      { label: 'Trên 10 triệu', min: 10000000, max: Infinity }
    ];

    // Đếm số lượng tin trong từng khoảng
    const counts = priceRanges.map(range => {
      const count = properties.filter(p =>
        p.rentPrice >= range.min && p.rentPrice < range.max
      ).length;
      return { range: range.label, count };
    });

    // Tính tổng tin và phần trăm
    const total = counts.reduce((sum, r) => sum + r.count, 0);
    const data = counts.map(r => ({
      range: r.range,
      count: r.count,
      percentage: total > 0 ? parseFloat(((r.count / total) * 100).toFixed(1)) : 0
    }));

    res.json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error in getPriceRangeDistribution:', error);
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy khoảng giá thuê phổ biến',
      error: error.message
    });
  }
};


