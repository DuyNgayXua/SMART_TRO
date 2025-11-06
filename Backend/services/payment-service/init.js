/**
 * Payment Service Initialization
 * Khởi động các service cần thiết cho payment module
 */
import orderAutoCancelService from './services/orderAutoCancelService.js';

/**
 * Khởi động tất cả payment services
 */
export const initPaymentServices = () => {
    try {
        console.log('Initializing Payment Services...');
        
        // Khởi động order auto-cancel service
        orderAutoCancelService.start();
        
       
        
        console.log('Payment Services initialized successfully');
        
    } catch (error) {
        console.error('Error initializing Payment Services:', error);
        throw error;
    }
};

/**
 * Dừng tất cả payment services (cho graceful shutdown)
 */
export const stopPaymentServices = () => {
    try {
        console.log('Stopping Payment Services...');
        
        // Dừng order auto-cancel service
        orderAutoCancelService.stop();
        
       
        console.log('Payment Services stopped successfully');
        
    } catch (error) {
        console.error('Error stopping Payment Services:', error);
        throw error;
    }
};

export default {
    initPaymentServices,
    stopPaymentServices
};
