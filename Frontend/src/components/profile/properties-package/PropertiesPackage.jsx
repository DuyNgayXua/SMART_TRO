import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import PropertiesPackageAPI from '../../../services/PropertiesPackageAPI.js';
import adminPackagePlanAPI from '../../../services/adminPackagePlanAPI';
import { createVNPayPaymentUrl, createPaymentOrder, createRenewalPaymentOrder } from '../../../services/paymentVNPayAPI';
import './PropertiesPackage.css';

const PropertiesPackage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // State management
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [durationUnit, setDurationUnit] = useState('day');
  const [duration, setDuration] = useState(3);
  const [addFastRent, setAddFastRent] = useState(false);
  const [pricing, setPricing] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState('vnpay');
  const [pricingLoading, setPricingLoading] = useState(false);

  // Migration modal states
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [currentUserProperties, setCurrentUserProperties] = useState([]);
  const [selectedPropertiesToMigrate, setSelectedPropertiesToMigrate] = useState([]);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [packageLimitsCheck, setPackageLimitsCheck] = useState(null);
  const [showMigrationSummary, setShowMigrationSummary] = useState(false);

  // Check if coming from payment history, upgrade mode, or renewal
  const fromPaymentHistory = searchParams.get('fromPaymentHistory') === 'true';
  const existingOrderId = searchParams.get('orderId');
  const isUpgrade = searchParams.get('upgrade') === 'true';
  const isRenewal = searchParams.get('renewal') === 'true';
  const upgradePackageId = searchParams.get('packageId');
  const upgradePackageName = decodeURIComponent(searchParams.get('packageName') || '');
  const upgradePackagePrice = parseInt(searchParams.get('packagePrice')) || 0;
  const upgradeDurationUnit = searchParams.get('durationUnit') || 'month';
  const upgradeDuration = parseInt(searchParams.get('duration')) || 1;
  const expiredPackageId = searchParams.get('expiredPackageId');
  const renewalPackageType = searchParams.get('packageType');
  const renewalPackageName = decodeURIComponent(searchParams.get('packageName') || '');


  // Load packages on component mount
  useEffect(() => {
    loadPackages();
  }, []);

  // Reload packages when page becomes visible (in case data was updated in admin)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Always reload when page becomes visible to get latest data
        loadPackages();
      }
    };

    const handleFocus = () => {
      // Reload when window gains focus
      loadPackages();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Handle URL parameters from payment history
  useEffect(() => {
    const fromPaymentHistory = searchParams.get('fromPaymentHistory');
    const urlPackageId = searchParams.get('packageId');
    const urlDurationUnit = searchParams.get('durationUnit');
    const urlDuration = searchParams.get('duration');

    if (fromPaymentHistory === 'true' && urlPackageId && packages.length > 0) {
      console.log('Loading from payment history with params:', {
        packageId: urlPackageId,
        durationUnit: urlDurationUnit,
        duration: urlDuration
      });

      // Pre-fill form with URL parameters
      setSelectedPackage(urlPackageId);
      setDurationUnit(urlDurationUnit || 'day');
      setDuration(parseInt(urlDuration) || 1);

      // Force recalculate pricing after setting params
      setTimeout(() => {
        if (packages.find(pkg => pkg._id === urlPackageId)) {
          calculatePrice();
        }
      }, 100);
    }
  }, [searchParams, packages]);

  // Recalculate price when selections change
  useEffect(() => {
    if (selectedPackage && duration > 0 && packages.length > 0) {
      console.log('Recalculating price with:', { selectedPackage, duration, durationUnit });
      calculatePrice();
    }
  }, [selectedPackage, durationUnit, duration, addFastRent, packages]);

  // Additional effect to ensure pricing calculation for payment history
  useEffect(() => {
    const fromPaymentHistory = searchParams.get('fromPaymentHistory');
    if (fromPaymentHistory === 'true' && selectedPackage && duration > 0 && packages.length > 0 && !pricing) {
      console.log('Force calculating pricing for payment history');
      calculatePrice();
    }
  }, [selectedPackage, duration, packages, pricing]);

  // Handle upgrade mode - auto select package and calculate pricing
  useEffect(() => {
    if (isUpgrade && upgradePackageId) {
      console.log('Loading upgrade mode with params:', {
        packageId: upgradePackageId,
        packageName: upgradePackageName,
        packagePrice: upgradePackagePrice,
        durationUnit: upgradeDurationUnit,
        duration: upgradeDuration
      });

      // Set upgrade parameters from URL
      setSelectedPackage(upgradePackageId);
      setDurationUnit(upgradeDurationUnit);
      setDuration(upgradeDuration);

      // Force recalculate pricing for upgrade mode
      setTimeout(() => {
        calculatePrice();
      }, 100);
    }
  }, [isUpgrade, upgradePackageId, upgradePackageName, upgradePackagePrice, upgradeDurationUnit, upgradeDuration]);

  // Handle renewal mode - show expired package info and allow renewal
  useEffect(() => {
    if (isRenewal && renewalPackageType === 'expired') {
      console.log('Loading renewal mode with params:', {
        packageType: renewalPackageType,
        packageName: renewalPackageName,
        expiredPackageId: expiredPackageId,
        packagePrice: upgradePackagePrice,
        duration: upgradeDuration,
        durationUnit: upgradeDurationUnit
      });

      // Set renewal parameters from URL 
      setDurationUnit(upgradeDurationUnit);
      setDuration(upgradeDuration);

      // Force recalculate pricing for renewal mode
      setTimeout(() => {
        calculatePrice();
      }, 100);

      // Show renewal message
      toast.info(`Đang gia hạn cho gói ${renewalPackageName}. Vui lòng chọn gói tin mới.`);
    }
  }, [isRenewal, renewalPackageType, renewalPackageName, expiredPackageId, upgradePackagePrice, upgradeDuration, upgradeDurationUnit]);

  // Load available packages
  const loadPackages = async () => {
    try {
      setLoading(true);
      const response = await adminPackagePlanAPI.getAvailablePackages();

      if (response.success) {
        console.log('Raw packages data:', response.data);
        console.log('Total packages received:', response.data?.length);

        // Filter active packages only (no duplicate removal since each package has unique _id)
        const activePackages = response.data.filter(pkg => pkg.isActive);
        console.log('Active packages:', activePackages.length, activePackages);

        const uniquePackages = activePackages
          .sort((a, b) => a.priority - b.priority); // Sort by priority

        console.log('Final filtered packages:', uniquePackages.length, uniquePackages);
        setPackages(uniquePackages);

        // Auto-select first package if none selected and not from payment history
        const fromPaymentHistory = searchParams.get('fromPaymentHistory');
        console.log('From payment history:', fromPaymentHistory);

      } else {
        toast.error('Không thể tải danh sách gói tin đăng');
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error('Lỗi khi tải danh sách gói tin đăng');
    } finally {
      setLoading(false);
    }
  };

  // Calculate package price based on selections
  const calculatePrice = async () => {
    try {
      setPricingLoading(true);

      // For upgrade mode, calculate pricing differently
      if (isUpgrade) {
        console.log('Calculating upgrade pricing for package:', {
          name: upgradePackageName,
          price: upgradePackagePrice,
          duration: upgradeDuration,
          durationUnit: upgradeDurationUnit
        });

        // Calculate upgrade package pricing - upgradePackagePrice is the total package price, not daily price
        // So we don't multiply by duration since it's already the total price for the selected duration
        const basePrice = upgradePackagePrice; // This is already the total package price
        const subtotalPrice = basePrice; // No discount applied
        console.log('Package price (total):', upgradePackagePrice, 'Duration:', upgradeDuration, upgradeDurationUnit);
        console.log('Base price:', basePrice, 'Subtotal price:', subtotalPrice);

        const vatAmount = Math.round(subtotalPrice * 0.08);
        const totalPrice = subtotalPrice + vatAmount;

        // Calculate daily price for display purposes
        let totalDaysForPackage = upgradeDuration;
        if (upgradeDurationUnit === 'month') {
          totalDaysForPackage = upgradeDuration * 30; // Approximate
        } else if (upgradeDurationUnit === 'year') {
          totalDaysForPackage = upgradeDuration * 365; // Approximate
        }

        const upgradePricing = {
          packageInfo: {
            _id: upgradePackageId,
            name: upgradePackageName,
            displayName: upgradePackageName,
            dailyPrice: Math.round(upgradePackagePrice / totalDaysForPackage), // Calculate actual daily price
            color: '#007bff'
          },
          pricing: {
            basePrice: basePrice,
            subtotal: subtotalPrice,
            vatAmount: vatAmount,
            totalPrice: totalPrice
          },
          timeline: {
            duration: upgradeDuration,
            durationUnit: upgradeDurationUnit,
            expiryDate: new Date(Date.now() + (upgradeDuration * (upgradeDurationUnit === 'year' ? 365 : upgradeDurationUnit === 'month' ? 30 : 1) * 24 * 60 * 60 * 1000)).toISOString(),
            expiryTime: '23:59'
          }
        };

        console.log('Upgrade pricing calculated:', upgradePricing);
        setPricing(upgradePricing);
        return;
      }

      // For renewal mode, calculate pricing similar to upgrade
      if (isRenewal) {
        console.log('Calculating renewal pricing for package:', {
          name: renewalPackageName,
          price: upgradePackagePrice,
          duration: upgradeDuration,
          durationUnit: upgradeDurationUnit
        });

        // Use upgrade package price if available, otherwise use default pricing
        const renewalPrice = upgradePackagePrice || 0;
        const basePrice = renewalPrice;
        const subtotalPrice = basePrice;
        console.log('Renewal package price (total):', renewalPrice, 'Duration:', upgradeDuration, upgradeDurationUnit);

        const vatAmount = Math.round(subtotalPrice * 0.08);
        const totalPrice = subtotalPrice + vatAmount;

        // Calculate daily price for display purposes
        let totalDaysForPackage = upgradeDuration;
        if (upgradeDurationUnit === 'month') {
          totalDaysForPackage = upgradeDuration * 30;
        } else if (upgradeDurationUnit === 'year') {
          totalDaysForPackage = upgradeDuration * 365;
        }

        const renewalPricing = {
          packageInfo: {
            _id: expiredPackageId,
            name: renewalPackageName,
            displayName: renewalPackageName,
            color: '#ffc107'
          },
          pricing: {
            basePrice: basePrice,
            subtotal: subtotalPrice,
            vatAmount: vatAmount,
            totalPrice: totalPrice
          },
          timeline: {
            duration: upgradeDuration,
            durationUnit: upgradeDurationUnit,
            expiryDate: new Date(Date.now() + (upgradeDuration * (upgradeDurationUnit === 'year' ? 365 : upgradeDurationUnit === 'month' ? 30 : 1) * 24 * 60 * 60 * 1000)).toISOString(),
            expiryTime: '23:59'
          }
        };

        console.log('Renewal pricing calculated:', renewalPricing);
        setPricing(renewalPricing);
        return;
      }

      // Regular pricing calculation for property posting
      const currentPkg = getCurrentPackage();
      console.log('Calculating price for package:', currentPkg);
      console.log('With duration:', duration, 'durationUnit:', durationUnit);

      if (!currentPkg) {
        console.log('No current package found, selectedPackage:', selectedPackage);
        console.log('Available packages:', packages.map(p => ({ id: p._id, name: p.displayName })));
        return;
      }

      const response = await PropertiesPackageAPI.calculatePrice(
        currentPkg._id, // Use package ID for API call to get accurate pricing
        duration,
        durationUnit,
        addFastRent
      );
      console.log('Price calculation response:', response);

      if (response.success) {
        console.log('Setting pricing data:', response.data);
        setPricing(response.data);
      } else {
        console.error('Price calculation failed:', response.message);
        toast.error('Không thể tính giá gói tin đăng: ' + (response.message || 'Lỗi không xác định'));
      }
    } catch (error) {
      console.error('Error calculating price:', error);
      toast.error('Lỗi khi tính giá gói tin đăng: ' + error.message);
    } finally {
      setPricingLoading(false);
    }
  };

  // Get package details
  const getCurrentPackage = () => {
    return packages.find(pkg => pkg._id === selectedPackage);
  };

  // Load user's current properties for migration
  const loadUserProperties = async () => {
    try {
      setMigrationLoading(true);
      const response = await PropertiesPackageAPI.getUserPropertiesForMigration();

      if (response.success) {
        setCurrentUserProperties(response.data.properties || []);
        console.log('Loaded user properties for migration:', response.data.properties);
      } else {
        toast.error('Không thể tải danh sách tin đăng hiện tại');
      }
    } catch (error) {
      console.error('Error loading user properties:', error);
      toast.error('Lỗi khi tải danh sách tin đăng');
    } finally {
      setMigrationLoading(false);
    }
  };

  // Check package limits for migration
  const checkPackageLimits = async (upgradePackageId, selectedProperties) => {
    try {
      const targetPackage = packages.find(pkg => pkg._id === upgradePackageId);
      if (!targetPackage) {
        toast.error('Không tìm thấy thông tin gói nâng cấp');
        return false;
      }

      // Group selected properties by post type
      const propertiesByType = selectedProperties.reduce((acc, property) => {
        const postTypeId = property.packageInfo?.postType?._id || 'basic';
        if (!acc[postTypeId]) {
          acc[postTypeId] = [];
        }
        acc[postTypeId].push(property);
        return acc;
      }, {});

      // Check each post type limit
      const limitsCheck = {};
      let allWithinLimits = true;

      for (const [postTypeId, properties] of Object.entries(propertiesByType)) {
        const postTypeName = properties[0]?.packageInfo?.postType?.displayName || 'Tin cơ bản';
        const count = properties.length;

        // Find limit in target package
        const limit = targetPackage.propertiesLimits?.find(
          l => l.packageType._id === postTypeId
        );

        if (!limit) {
          limitsCheck[postTypeId] = {
            postTypeName,
            count,
            limit: 0,
            allowed: 0,
            exceeded: true
          };
          allWithinLimits = false;
        } else {
          const allowedCount = limit.limit === -1 ? Infinity : limit.limit;
          const exceeded = count > allowedCount;

          limitsCheck[postTypeId] = {
            postTypeName,
            count,
            limit: limit.limit,
            allowed: allowedCount,
            exceeded
          };

          if (exceeded) {
            allWithinLimits = false;
          }
        }
      }

      setPackageLimitsCheck(limitsCheck);
      return allWithinLimits;
    } catch (error) {
      console.error('Error checking package limits:', error);
      toast.error('Lỗi khi kiểm tra giới hạn gói');
      return false;
    }
  };

  // Handle property selection for migration
  const handlePropertySelection = async (property, isSelected) => {
    let updatedSelection;

    if (isSelected) {
      updatedSelection = [...selectedPropertiesToMigrate, property];
    } else {
      updatedSelection = selectedPropertiesToMigrate.filter(p => p._id !== property._id);
    }

    setSelectedPropertiesToMigrate(updatedSelection);

    // Check limits when properties are selected
    if (updatedSelection.length > 0) {
      await checkPackageLimits(upgradePackageId, updatedSelection);
    } else {
      setPackageLimitsCheck(null);
    }
  };

  // Open migration modal
  const openMigrationModal = () => {
    setShowMigrationModal(true);
    loadUserProperties();
  };

  // Close migration modal
  const closeMigrationModal = () => {
    setShowMigrationModal(false);
    setSelectedPropertiesToMigrate([]);
    setPackageLimitsCheck(null);
  };



  // Handle payment
  const handlePayment = () => {
    if (!pricing) {
      toast.error('Vui lòng chọn giá gói');
      return;
    }

    if (!currentPackage && !isUpgrade && !isRenewal) {
      toast.error('Vui lòng chọn gói tin đăng');
      return;
    }

    // For upgrade mode, show migration modal first
    if (isUpgrade) {
      openMigrationModal();
      return;
    }

    // For renewal mode, proceed directly to payment
    if (isRenewal) {
      proceedToPayment();
      return;
    }

    proceedToPayment();
  };

  // Proceed to payment (after migration or directly)
  const proceedToPayment = async (migrationData = null) => {
    try {
      // Prepare payment data - không cần propertyId vì thanh toán cho toàn bộ tài khoản
      const paymentData = {
        packageInfo: {
          ...pricing.packageInfo,
          packageId: currentPackage?._id || upgradePackageId || expiredPackageId,
          _id: currentPackage?._id || upgradePackageId || expiredPackageId,
          name: currentPackage?.name || upgradePackageName || renewalPackageName,
          displayName: currentPackage?.displayName || upgradePackageName || renewalPackageName,
          dailyPrice: currentPackage?.dailyPrice || upgradePackagePrice,
        },
        pricing: pricing.pricing,
        timeline: {
          ...pricing.timeline,
          duration,
          durationUnit,
          durationDisplay: formatDurationDisplay()
        },
        paymentMethod: selectedPayment,
        isUpgrade: isUpgrade,
        isRenewal: isRenewal,
        // Thêm thông tin bắt buộc cho renewal
        packagePlanId: isRenewal ? expiredPackageId : (currentPackage?._id || upgradePackageId),
        totalAmount: pricing.pricing?.totalPrice || 0,
        renewalInfo: isRenewal ? {
          expiredPackageId: expiredPackageId,
          packageType: renewalPackageType,
          packageName: renewalPackageName,
          packagePlanId: expiredPackageId,
          totalAmount: pricing.pricing?.totalPrice || 0
        } : null,
        migration: migrationData // Add migration data if available
      };

      console.log('isRenewal flag:', isRenewal);
      console.log('Payment data:', paymentData);
      console.log('Selected payment method:', selectedPayment);

      // Navigate based on payment method
      if (selectedPayment === 'vnpay') {
        // Chuyển hướng trực tiếp đến VNPay sandbox
        // Bước 1: Tạo đơn hàng trước
        const orderData = {
          packagePlanId: paymentData.packagePlanId,
          totalAmount: paymentData.totalAmount,
          orderInfo: `Thanh toán gói ${paymentData.packageInfo.displayName}`,
          isUpgrade: paymentData.isUpgrade,
          isRenewal: paymentData.isRenewal,
          renewalInfo: paymentData.renewalInfo,
          migration: paymentData.migration
        };

        // Chọn API tạo order phù hợp
        let createOrderResponse;
        if (paymentData.isRenewal) {
          createOrderResponse = await createRenewalPaymentOrder(orderData);
        } else {
          createOrderResponse = await createPaymentOrder(orderData);
        }

        if (!createOrderResponse.success || !createOrderResponse.data.orderId) {
          toast.error('Không thể tạo đơn hàng: ' + (createOrderResponse.message || 'Lỗi không xác định'));
          return;
        }

        // Bước 2: Tạo URL VNPay với orderId
        toast.info('Đang chuyển hướng đến VNPay...');
        const vnpayResponse = await createVNPayPaymentUrl(createOrderResponse.data.orderId);
        console.log('VNPay payment URL response:', vnpayResponse);

        if (vnpayResponse.success && vnpayResponse.data.vnpayUrl) {
          // Chuyển hướng trực tiếp đến VNPay
          window.location.href = vnpayResponse.data.vnpayUrl;
        } else {
          toast.error('Không thể tạo liên kết thanh toán VNPay: ' + (vnpayResponse.message || 'Lỗi không xác định'));
        }
      } else {
        // Navigate to traditional payment page (SePay)
        navigate('/profile/payment', { state: paymentData });
      }
    } catch (error) {
      console.error('Error proceeding to payment:', error);
      toast.error('Lỗi khi chuẩn bị thanh toán: ' + error.message);
    }
  };

  // Confirm migration and proceed to payment
  const confirmMigration = async () => {
    try {
      if (selectedPropertiesToMigrate.length === 0) {
        toast.info('Không có tin đăng nào được chọn để chuyển đổi');
        closeMigrationModal();
        proceedToPayment();
        return;
      }

      // Final check of package limits
      const limitsValid = await checkPackageLimits(upgradePackageId, selectedPropertiesToMigrate);

      if (!limitsValid) {
        toast.error('Một số tin đăng vượt quá giới hạn của gói mới. Vui lòng bỏ chọn bớt.');
        return;
      }

      // Prepare migration data
      const migrationData = {
        selectedProperties: selectedPropertiesToMigrate.map(p => ({
          propertyId: p._id,
          currentPostType: p.packageInfo?.postType?._id,
          newPostType: p.packageInfo?.postType?._id // Keep same post type
        })),
        limitsUsage: packageLimitsCheck
      };

      console.log('Migration data prepared:', migrationData);

      closeMigrationModal();
      proceedToPayment(migrationData);

    } catch (error) {
      console.error('Error confirming migration:', error);
      toast.error('Lỗi khi xác nhận chuyển đổi tin đăng');
    }
  };

  // Back to my posts
  const handleBack = () => {
    navigate('/profile/my-posts');
  };

  // Render stars
  const renderStars = (count) => {
    return Array.from({ length: count }, (_, i) => (
      <i key={i} className="fa fa-star star-icon" style={{ color: '#ffc107' }}></i>
    ));
  };

  // Format duration display
  const formatDurationDisplay = () => {
    switch (durationUnit) {
      case 'day':
        return `${duration} ngày`;
      case 'month':
        // Tính số ngày thực tế cho từng tháng (giống logic backend)
        let totalDaysInMonths = 0;
        const currentDate = new Date();

        for (let i = 0; i < duration; i++) {
          const targetMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 0);
          totalDaysInMonths += targetMonth.getDate();
        }

        return `${duration} tháng (${totalDaysInMonths} ngày)`;
      case 'year':
        const totalDaysInYears = duration * 365; // Simplified calculation
        return `${duration} năm (${totalDaysInYears} ngày)`;
      default:
        return `${duration} ngày`;
    }
  };

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="spinner-container">
        <div className="spinner"></div>
        <span className="loading-text">Đang tải thông tin gói tin đăng...</span>
      </div>
    );
  }

  const currentPackage = getCurrentPackage();

  return (
    <div className="profile-content">
      <div className="property-package-container">
        {/* Back Button - Top Left */}
        <div className="top-back-button">
          <button className="btn-back-top" onClick={handleBack}>
            <i className="fa fa-arrow-left"></i>
            Quay lại danh sách tin
          </button>
        </div>

        <div className="package-main-content">
          {/* Package Selection */}
          <div className="package-selection-section">
            <h3>{isUpgrade ? 'Thông tin gói nâng cấp' : isRenewal ? 'Gia hạn gói tin' : 'Chọn gói tin đăng'}</h3>

            {/* Renewal Package Card Display */}
            {isRenewal && renewalPackageName && (
              <div className="selected-package-card">
                <div className="package-card-header">
                  <h4 className="package-title-properties-package">
                    <i className="fa fa-history" style={{ color: '#ffc107' }}></i>
                    {renewalPackageName}
                  </h4>
                  <div className="package-price-properties-package">
                    <span className="price-amount-properties-package">{PropertiesPackageAPI.formatPrice(upgradePackagePrice || 0)} VNĐ</span>
                    <span className="price-period">/{upgradeDuration || 1} {upgradeDurationUnit === 'month' ? 'tháng' : upgradeDurationUnit === 'year' ? 'năm' : 'ngày'}</span>
                  </div>
                </div>

                <div className="package-card-body">
                  {(() => {

                    // Since renewalPackageName contains the expired package name, we need to match it
                    const packageDetails = packages.find(pkg =>
                      pkg.displayName === renewalPackageName ||
                      pkg.name === renewalPackageName ||
                      pkg._id === expiredPackageId
                    );


                    if (packageDetails?.propertiesLimits) {
                      console.log('Found propertiesLimits for renewal:', packageDetails.propertiesLimits);
                      return (
                        <div>
                          <h5>Quyền lợi gói tin được kích hoạt lại</h5>
                          <div className="package-benefits">
                            {packageDetails.propertiesLimits.map((limit, index) => {
                              console.log('Processing renewal limit:', limit);
                              return (
                                <div key={index} className="benefit-item-upgrade">
                                  <i className="fa fa-check benefit-icon"></i>
                                  <span>
                                    {limit.limit === -1 ? 'Không giới hạn' : limit.limit} tin {limit.packageType?.displayName || limit.packageType?.name || 'TIN'}
                                  </span>
                                </div>
                              );
                            })}
                            <div className="benefit-item-upgrade">
                              <i className="fa fa-check benefit-icon"></i>
                              <span>{packageDetails.freePushCount || 0} lượt ĐẨY TIN</span>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Fallback benefits if no package details found
                    console.log('No renewal package details found, using fallback benefits');
                    return (
                      <div>
                        <h5>Quyền lợi gói tin (thông tin cơ bản):</h5>
                        <div className="package-benefits">
                          {[
                            { count: '5', type: 'TIN THƯỜNG' },
                            { count: '5', type: 'TIN VIP 1' },
                            { count: '1', type: 'TIN VIP NỔI BẬT' },
                            { count: '1', type: 'TIN VIP ĐẶC BIỆT' }
                          ].map((benefit, index) => (
                            <div key={index} className="benefit-item-upgrade">
                              <i className="fa fa-check benefit-icon"></i>
                              <span>{benefit.count} tin {benefit.type}</span>
                            </div>
                          ))}
                          <div className="benefit-item-upgrade">
                            <i className="fa fa-check benefit-icon"></i>
                            <span>5 lượt đẩy tin miễn phí</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Package Card Display */}
            {isUpgrade && upgradePackageName && (
              <div className="selected-package-card">
                <div className="package-card-header">
                  <h4 className="package-title-properties-package">{upgradePackageName}</h4>
                  <div className="package-price-properties-package">
                    <span className="price-amount-properties-package">{PropertiesPackageAPI.formatPrice(upgradePackagePrice)} VNĐ</span>
                    <span className="price-period">/{upgradeDuration} {upgradeDurationUnit === 'month' ? 'tháng' : upgradeDurationUnit === 'year' ? 'năm' : 'ngày'}</span>
                  </div>
                </div>

                <div className="package-card-body">
                  <h5>Quyền lợi gói tin</h5>
                  <div className="package-benefits">
                    {/* Find package details from packages array */}
                    {(() => {
                      const packageDetails = packages.find(pkg => pkg._id === upgradePackageId);
                      console.log('Upgrade package details:', packageDetails);
                      console.log('Looking for packageId:', upgradePackageId);
                      console.log('Available packages:', packages.map(p => ({ id: p._id, name: p.displayName })));

                      if (packageDetails?.propertiesLimits) {
                        console.log('Found propertiesLimits:', packageDetails.propertiesLimits);
                        return packageDetails.propertiesLimits.map((limit, index) => {
                          console.log('Processing limit:', limit);
                          return (
                            <div key={index} className="benefit-item-upgrade">
                              <i className="fa fa-check benefit-icon"></i>
                              <span>
                                {limit.limit === -1 ? 'Không giới hạn' : limit.limit} tin {limit.packageType?.displayName || limit.packageType?.name || 'TIN'}
                              </span>
                            </div>
                          );
                        });
                      }

                      // Fallback benefits if no package details found
                      console.log('No package details found, using fallback benefits');
                      return [
                        { count: '5', type: 'TIN THƯỜNG' },
                        { count: '5', type: 'TIN VIP 1' },
                        { count: '1', type: 'TIN VIP NỔI BẬT' },
                        { count: '1', type: 'TIN VIP ĐẶC BIỆT' }
                      ].map((benefit, index) => (
                        <div key={index} className="benefit-item-upgrade">
                          <i className="fa fa-check benefit-icon"></i>
                          <span>{benefit.count} tin {benefit.type}</span>
                        </div>
                      ));
                    })()}

                    {/* Additional benefits */}
                    <div className="benefit-item-upgrade">
                      <i className="fa fa-check benefit-icon"></i>
                      <span>{(() => {
                        const packageDetails = packages.find(pkg => pkg._id === upgradePackageId);
                        console.log('Finding freePushCount for packageId:', upgradePackageId, 'Found:', packageDetails);
                        return packageDetails?.freePushCount ?? 5;
                      })()} lượt đẩy tin miễn phí</span>
                    </div>

                    <div className="benefit-item-upgrade">
                      <i className="fa fa-check benefit-icon"></i>
                      <span>Tin được ưu tiên hiển thị</span>
                    </div>

                    <div className="benefit-item-upgrade">
                      <i className="fa fa-check benefit-icon"></i>
                      <span>Hỗ trợ khách hàng ưu tiên</span>
                    </div>
                  </div>
                </div>
              </div>
            )}



          </div>

          {/* Package Preview */}
          {currentPackage && (
            console.log('Rendering package preview for:', currentPackage),
            <div className="package-preview-section">
              <div className="preview-sample">
                <button
                  className="btn-preview"
                  onClick={() => window.open('/pricing', '_blank')}
                >
                  <i className="fa fa-eye"></i>
                  Xem trước mẫu {currentPackage.displayName}
                </button>
              </div>
              <div className="package-preview">
                <h4 style={{ color: currentPackage.color, textTransform: currentPackage.textStyle }}>
                  {currentPackage.displayName}
                  {currentPackage.stars > 0 && (
                    <span className="package-stars">
                      {renderStars(currentPackage.stars)}
                    </span>
                  )}
                </h4>
                <p>{currentPackage.description}</p>

                <ul className="package-features">
                  {currentPackage.features && currentPackage.features.map((feature, index) => (
                    <li key={index}>✓ {feature}</li>
                  ))}
                </ul>


              </div>
            </div>
          )}

          {/* Payment Method */}
          <div className="payment-method-section">
            <h3>Chọn phương thức thanh toán</h3>
            <div className="payment-options">
              <label className="payment-option">
                <input
                  type="radio"
                  name="payment"
                  value="vnpay"
                  checked={selectedPayment === 'vnpay'}
                  onChange={(e) => setSelectedPayment(e.target.value)}
                />
                <span className="payment-label">
                 <img className="payment-icon" src="https://res.cloudinary.com/dapvuniyx/image/upload/v1761911175/vnpay_xnbjkc.jpg" alt="" />
                  Thanh toán VNPay (Thẻ ATM, Internet Banking)
                </span>
              </label>
              <label className="payment-option">
                <input
                  type="radio"
                  name="payment"
                  value="sepay_qr"
                  checked={selectedPayment === 'sepay_qr'}
                  onChange={(e) => setSelectedPayment(e.target.value)}
                />
                <span className="payment-label">
                 <img className="payment-icon" src="https://res.cloudinary.com/dapvuniyx/image/upload/v1761911174/sepay_v5akjp.png" alt="" />
                  Thanh toán quét mã QR Code Sepay
                </span>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="action-button-payment">
            <button className="btn-payment" onClick={handlePayment} disabled={!pricing}>
              <i className="fa fa-credit-card"></i>
              Thanh toán
            </button>
          </div>
        </div>

        {/* Sidebar - Payment Summary */}
        <div className="package-sidebar">
          <div className="payment-summary">
            <h3>{isUpgrade ? 'Chi phí nâng cấp gói' : isRenewal ? 'Chi phí gia hạn gói' : 'Thông tin thanh toán'}</h3>

            {pricingLoading ? (
              <div className="pricing-loading">
                <div className="spinner"></div>
                <p>Đang tính giá gói tin đăng...</p>
              </div>
            ) : pricing ? (
              <div className="summary-details">
                {/* Loại gói tin */}
                <div className="summary-row">
                  <span>Loại gói tin:</span>
                  <span style={{
                    color: currentPackage?.color || pricing.packageInfo.color,
                    fontWeight: 'bold'
                  }}>
                    {upgradePackageName || `GÓI CƠ BẢN`}
                  </span>
                </div>

                {/* Giá gói */}
                <div className="summary-row">
                  <span>Tổng giá gói:</span>
                  <span>
                    {isUpgrade || isRenewal
                      ? `${PropertiesPackageAPI.formatPrice(upgradePackagePrice)} VNĐ`
                      : `${PropertiesPackageAPI.formatPrice(currentPackage?.dailyPrice || pricing.packageInfo.dailyPrice)} VNĐ`
                    }
                  </span>
                </div>

                {/* Thời hạn và đơn vị */}
                <div className="summary-row">
                  <span>Thời hạn:</span>
                  <span>{formatDurationDisplay()}</span>
                </div>
                {/* Ngày hết hạn */}
                <div className="summary-row">
                  <span>Ngày hết hạn:</span>
                  <span>
                    {pricing.timeline?.expiryTime && pricing.timeline?.expiryDate
                      ? `${pricing.timeline.expiryTime}, ${PropertiesPackageAPI.formatDate(pricing.timeline.expiryDate)}`
                      : 'Đang tính toán...'
                    }
                  </span>
                </div>
                {/* Tạm tính */}
                <div className="summary-row subtotal-row">
                  <span>Tạm tính:</span>
                  <span>{PropertiesPackageAPI.formatPrice(pricing.pricing?.subtotal || pricing.pricing?.basePrice || 0)} VNĐ</span>
                </div>

                {/* Phí VAT 8% */}
                <div className="summary-row">
                  <span>Phí VAT (8%):</span>
                  <span>{PropertiesPackageAPI.formatPrice(pricing.pricing?.vatAmount || 0)} VNĐ</span>
                </div>

                {/* Tổng giá */}
                <div className="summary-row total-row-properties-package">
                  <span>Tổng giá:</span>
                  <span className="total-price-properties-package">
                    {PropertiesPackageAPI.formatPrice(pricing.pricing?.totalPrice || 0)} VNĐ
                  </span>
                </div>
              </div>
            ) : (
              <div className="summary-placeholder">
                <p>
                  {fromPaymentHistory ? 'Đang tải thông tin thanh toán...' :
                    isUpgrade ? 'Đang tính chi phí nâng cấp gói...' :
                      isRenewal ? 'Đang tính chi phí gia hạn gói...' :
                        'Chọn gói tin đăng để xem chi tiết giá cả'}
                </p>
              </div>
            )}
          </div>

          {/* Free Posts Notice */}
          <div className="free-posts-notice">
            <div className="notice-icon">
              <i className="fa fa-gift"></i>
            </div>
            <div className="notice-content-properties-package">
              <h4>Ưu đãi đặc biệt!</h4>
              <p>Gói dùng thử miễn phí cho 3 tin đầu tiên, bắt đầu tính phí từ tin thứ 4.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Migration Modal */}
      {showMigrationModal && (
        <div className="migration-modal-overlay">
          <div className="migration-modal">
            <div className="migration-modal-header">
              <h3>Chuyển tin đăng sang gói mới</h3>
              <button className="close-btn-current-package" onClick={closeMigrationModal}>
                <i className="fa fa-times"></i>
              </button>
            </div>

            <div className="migration-modal-body">
              <div className="migration-info">
                <div className="info-box info-upgrade">
                  <div className='info-icon-migration'>
                    <h4>
                      <i className="fa fa-arrow-up"></i>
                      Nâng cấp lên: {upgradePackageName}</h4>
                    <p>Chọn các tin đăng hiện tại bạn muốn chuyển sang gói mới</p>
                    <small>
                      Tin đăng được chọn sẽ sử dụng hạn mức của gói mới.
                      Tin không được chọn sẽ tiếp tục với gói cũ đến hết hạn.
                    </small>
                  </div>
                </div>

                {packageLimitsCheck && (
                  <div className="limits-check">
                    <h4>Kiểm tra giới hạn gói mới:</h4>
                    {Object.entries(packageLimitsCheck).map(([postTypeId, check]) => (
                      <div
                        key={postTypeId}
                        className={`limit-row ${check.exceeded ? 'limit-exceeded' : 'limit-ok'}`}
                      >
                        <span className="post-type-migration">{check.postTypeName}</span>
                        <span className="count-migration">
                          {check.count}/{check.limit === -1 ? '∞' : check.limit}
                        </span>
                        {check.exceeded && (
                          <span className="exceeded-warning">
                            <i className="fa fa-exclamation-triangle"></i>
                            Vượt quá giới hạn
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="properties-list">
                <h4>Tin đăng hiện tại của bạn:</h4>

                {migrationLoading ? (
                  <div className="spinner-container">
                    <div className="spinner"></div>
                    <span className="loading-text">Đang tải danh sách tin đăng...</span>
                  </div>
                ) : currentUserProperties.length === 0 ? (
                  <div className="no-properties">
                    <i className="fa fa-info-circle"></i>
                    <p>Bạn chưa có tin đăng nào trong gói hiện tại</p>
                  </div>
                ) : (
                  <div className="properties-grid-migration">
                    {currentUserProperties.map(property => (
                      <div key={property._id} className="property-migration-item">
                        <label className="property-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedPropertiesToMigrate.some(p => p._id === property._id)}
                            onChange={(e) => handlePropertySelection(property, e.target.checked)}
                          />
                          <div className="property-info-migration">
                            <div className="property-image">
                              {property.images && property.images.length > 0 ? (
                                <img src={property.images[0]} alt={property.title} />
                              ) : (
                                <div className="no-image">
                                  <i className="fa fa-home"></i>
                                </div>
                              )}
                            </div>
                            <div className="property-details-migration">
                              <h5 className="property-title-migration">{property.title}</h5>
                              <div className="property-meta-migration">
                                <span className="property-price-migration">
                                  {PropertiesPackageAPI.formatPrice(property.rentPrice)} VNĐ
                                </span>
                                <span className="property-area-migration">
                                  <i className="fa fa-expand"></i>
                                  {property.area}m²</span>

                              </div>
                              <div className="location-row">
                                <i className="fa fa-map-marker"></i>
                                <span className="location-text">
                                  {property.detailAddress}, {property.ward}, {property.province}
                                </span>
                              </div>
                              <div className="property-meta-row">
                                <div className="meta-left">
                                  <div className="date-info">
                                    <i className="fa fa-calendar"></i>
                                    <span>Đăng: {formatDate(property.createdAt)}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="package-type-migration">
                                <span
                                  className="post-type-badge-migration"
                                  style={{
                                    backgroundColor: property.packageInfo?.postType?.color || '#6c757d',
                                    color: 'white'
                                  }}
                                >
                                  {(() => {
                                    const priority = property.packageInfo?.postType?.priority;
                                    const stars = priority <= 6 ? Math.max(0, Math.min(5, 6 - priority)) : 0;
                                    return stars > 0 && (
                                      <div className="post-type-stars-my-properties">
                                        {[...Array(stars)].map((_, index) => (
                                          <i key={index} className="fa fa-star star-icon-my-properties"></i>
                                        ))}
                                      </div>
                                    );
                                  })()}
                                  {property.packageInfo?.postType?.displayName || 'Tin cơ bản'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="migration-modal-footer">
              <div className="selected-count">
                <span>Đã chọn: {selectedPropertiesToMigrate.length} tin đăng</span>
              </div>
              <div className="modal-actions-properties-package">
                <button
                  className="btn-cancel"
                  onClick={closeMigrationModal}
                >
                  Hủy
                </button>
                <button
                  className="btn-skip"
                  onClick={() => {
                    closeMigrationModal();
                    proceedToPayment();
                  }}
                >
                  Bỏ qua, thanh toán
                </button>
                <button
                  className="btn-confirm"
                  onClick={confirmMigration}
                  disabled={packageLimitsCheck && Object.values(packageLimitsCheck).some(check => check.exceeded)}
                >
                  Xác nhận chuyển đổi ({selectedPropertiesToMigrate.length} tin)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PropertiesPackage;