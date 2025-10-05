/**
 * Invoice Controller - Xử lý logic nghiệp vụ cho hóa đơn
 */
import invoiceRepository from '../repositories/invoiceRepository.js';
import { Contract, Room, Tenant } from '../../../schemas/index.js';

class InvoiceController {
    // Tạo hóa đơn mới
    async create(req, res) {
        try {
        const {
            contractId,
            issueDate,
            dueDate,
            charges,
            discount = 0,
            notes,
            periodStart,
            periodEnd,
            electricOldReading = 0,
            electricNewReading = 0,
            waterOldReading = 0,
            waterNewReading = 0
            // Bỏ qua electricRate, waterRate, waterBillingType, waterPricePerPerson từ request
            // Sẽ lấy từ hợp đồng thay thế
        } = req.body;

            const landlordId = req.user.userId;

            // Kiểm tra hợp đồng tồn tại và thuộc về landlord
            const contract = await Contract.findOne({ 
                _id: contractId,
                landlord: landlordId,
                status: 'active'
            }).populate('room').populate('tenants');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hợp đồng hoặc hợp đồng không thuộc về bạn'
                });
            }

            // Lấy thông tin billing từ hợp đồng
            const electricRate = contract.electricPrice || 3500;
            const waterRate = contract.waterPrice || 20000;
            const waterPricePerPerson = contract.waterPricePerPerson || 50000;
            
            // Debug contract water charge info
            console.log('Contract water info:', {
                waterChargeType: contract.waterChargeType,
                waterPrice: contract.waterPrice,
                waterPricePerPerson: contract.waterPricePerPerson
            });
            
            // Map waterChargeType từ contract sang invoice format
            // 'fixed' = theo khối (m³), 'per_person' = theo người
            const waterBillingType = contract.waterChargeType === 'per_person' ? 'perPerson' : 'perCubicMeter';
            
            console.log('Final waterBillingType:', waterBillingType);

            // Xác định chu kỳ nếu không được cung cấp
            let finalPeriodStart = periodStart ? new Date(periodStart) : null;
            let finalPeriodEnd = periodEnd ? new Date(periodEnd) : null;

            if (!finalPeriodStart || !finalPeriodEnd) {
                // Lấy hóa đơn cuối cùng của hợp đồng này
                const lastInvoice = await invoiceRepository.getLastInvoiceByContract(contractId);
                
                if (lastInvoice) {
                    // Nếu có hóa đơn trước đó, bắt đầu từ ngày kết thúc của hóa đơn trước
                    finalPeriodStart = new Date(lastInvoice.periodEnd);
                    finalPeriodStart.setDate(finalPeriodStart.getDate() + 1);
                } else {
                    // Nếu chưa có hóa đơn nào, bắt đầu từ ngày thuê
                    finalPeriodStart = new Date(contract.startDate);
                }

                // Tự động tính chu kỳ 1 tháng
                if (!finalPeriodEnd) {
                    finalPeriodEnd = new Date(finalPeriodStart);
                    finalPeriodEnd.setMonth(finalPeriodEnd.getMonth() + 1);
                    finalPeriodEnd.setDate(finalPeriodEnd.getDate() - 1);
                }
            }

            // Kiểm tra trùng lắp chu kỳ
            const hasOverlap = await invoiceRepository.checkPeriodOverlap(
                contractId, finalPeriodStart, finalPeriodEnd
            );

            if (hasOverlap) {
                return res.status(400).json({
                    success: false,
                    message: 'Chu kỳ hóa đơn bị trùng lắp với hóa đơn khác'
                });
            }

            // Validate charges
            if (!charges || !Array.isArray(charges) || charges.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Vui lòng nhập ít nhất một khoản thu'
                });
            }

            // Tính toán số tiền
            let subtotal = 0;
            const processedCharges = charges.map(charge => {
                const amount = charge.quantity * (charge.unitPrice || charge.amount);
                subtotal += amount;
                
                return {
                    ...charge,
                    amount: amount,
                    unitPrice: charge.unitPrice || charge.amount
                };
            });

            const totalAmount = subtotal - discount;

            // Tạo invoice number
            const invoiceNumber = await invoiceRepository.generateInvoiceNumber();

            // Tạo hóa đơn
            const invoiceData = {
                invoiceNumber,
                contract: contractId,
                room: contract.room._id,
                tenant: contract.tenants[0]._id, // Lấy tenant đầu tiên
                landlord: landlordId,
                issueDate: issueDate ? new Date(issueDate) : new Date(),
                dueDate: new Date(dueDate),
                periodStart: finalPeriodStart,
                periodEnd: finalPeriodEnd,
                electricOldReading,
                electricNewReading,
                electricRate,
                waterOldReading,
                waterNewReading,
                waterRate,
                waterBillingType,
                waterPricePerPerson,
                charges: processedCharges,
                subtotal,
                discount,
                totalAmount,
                status: 'sent',
                notes,
                createdBy: landlordId
            };

            const invoice = await invoiceRepository.create(invoiceData);
            
            res.status(201).json({
                success: true,
                data: invoice,
                message: 'Tạo hóa đơn thành công'
            });
        } catch (error) {
            console.error('Create invoice error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi tạo hóa đơn',
                error: error.message
            });
        }
    }

    // Lấy danh sách hóa đơn
    async list(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                room,
                tenant,
                contract,
                status,
                month,
                year,
                sortBy = 'issueDate',
                sortOrder = 'desc'
            } = req.query;

            const landlord = req.user.userId;

            // Map 'unpaid' frontend status to backend statuses
            let statusFilter = status;
            if (status === 'unpaid') {
                statusFilter = ['draft', 'sent'];
            }

            const data = await invoiceRepository.list({
                page: Number(page),
                limit: Number(limit),
                landlord,
                room,
                tenant,
                contract,
                status: statusFilter,
                month: month ? Number(month) : undefined,
                year: year ? Number(year) : undefined,
                sortBy,
                sortOrder
            });

            res.json({ success: true, data });
        } catch (error) {
            console.error('List invoices error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy danh sách hóa đơn',
                error: error.message
            });
        }
    }

    // Lấy chi tiết hóa đơn
    async get(req, res) {
        try {
            const { id } = req.params;
            const invoice = await invoiceRepository.findById(id);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hóa đơn'
                });
            }

            // Kiểm tra quyền truy cập
            if (req.user.role === 'landlord' && 
                invoice.landlord._id.toString() !== req.user.userId) {
                return res.status(403).json({
                    success: false,
                    message: 'Không có quyền xem hóa đơn này'
                });
            }

            res.json({ success: true, data: invoice });
        } catch (error) {
            console.error('Get invoice error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thông tin hóa đơn',
                error: error.message
            });
        }
    }

    // Cập nhật hóa đơn
    async update(req, res) {
        try {
            const { id } = req.params;
            const updateData = { ...req.body };
            updateData.updatedBy = req.user.userId;

            const invoice = await invoiceRepository.update(id, updateData);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hóa đơn'
                });
            }

            res.json({
                success: true,
                data: invoice,
                message: 'Cập nhật hóa đơn thành công'
            });
        } catch (error) {
            console.error('Update invoice error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi cập nhật hóa đơn',
                error: error.message
            });
        }
    }

    // Đánh dấu đã thanh toán
    async markAsPaid(req, res) {
        try {
            const { id } = req.params;
            const { paymentMethod, transactionId, paidDate } = req.body;

            const paymentData = {
                paymentMethod,
                transactionId,
                paidDate: paidDate ? new Date(paidDate) : new Date(),
                updatedBy: req.user.userId
            };

            const invoice = await invoiceRepository.markAsPaid(id, paymentData);
            
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hóa đơn'
                });
            }

            res.json({
                success: true,
                data: invoice,
                message: 'Đánh dấu thanh toán thành công'
            });
        } catch (error) {
            console.error('Mark as paid error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi đánh dấu thanh toán',
                error: error.message
            });
        }
    }

    // Xóa hóa đơn
    async delete(req, res) {
        try {
            const { id } = req.params;
            
            const invoice = await invoiceRepository.findById(id);
            if (!invoice) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hóa đơn'
                });
            }

            // Chỉ cho phép xóa hóa đơn draft hoặc chưa thanh toán
            if (invoice.status === 'paid') {
                return res.status(400).json({
                    success: false,
                    message: 'Không thể xóa hóa đơn đã thanh toán'
                });
            }

            await invoiceRepository.delete(id);
            
            res.json({
                success: true,
                message: 'Xóa hóa đơn thành công'
            });
        } catch (error) {
            console.error('Delete invoice error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi xóa hóa đơn',
                error: error.message
            });
        }
    }

    // Thống kê hóa đơn
    async getStats(req, res) {
        try {
            const landlordId = req.user.userId;
            const stats = await invoiceRepository.getStatsByLandlord(landlordId);
            
            res.json({ success: true, data: stats });
        } catch (error) {
            console.error('Get invoice stats error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thống kê hóa đơn',
                error: error.message
            });
        }
    }

    // Lấy thông tin để tạo hóa đơn mới (chu kỳ tiếp theo)
    async getNewInvoiceInfo(req, res) {
        try {
            const { contractId } = req.params;
            const landlordId = req.user.userId;

            // Kiểm tra hợp đồng
            const contract = await Contract.findOne({
                _id: contractId,
                landlord: landlordId,
                status: 'active'
            }).populate('room', 'roomNumber monthlyRent')
              .populate('tenants', 'fullName phone');

            if (!contract) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy hợp đồng'
                });
            }

            // Lấy hóa đơn cuối cùng
            const lastInvoice = await invoiceRepository.getLastInvoiceByContract(contractId);
            
            let suggestedPeriodStart, suggestedPeriodEnd;
            
            if (lastInvoice) {
                // Bắt đầu từ ngày sau khi kết thúc hóa đơn trước
                suggestedPeriodStart = new Date(lastInvoice.periodEnd);
                suggestedPeriodStart.setDate(suggestedPeriodStart.getDate() + 1);
            } else {
                // Bắt đầu từ ngày thuê
                suggestedPeriodStart = new Date(contract.startDate);
            }

            // Chu kỳ 1 tháng
            suggestedPeriodEnd = new Date(suggestedPeriodStart);
            suggestedPeriodEnd.setMonth(suggestedPeriodEnd.getMonth() + 1);
            suggestedPeriodEnd.setDate(suggestedPeriodEnd.getDate() - 1);

            // Đề xuất ngày đáo hạn (15 ngày sau ngày lập)
            const suggestedDueDate = new Date();
            suggestedDueDate.setDate(suggestedDueDate.getDate() + 15);

            res.json({
                success: true,
                data: {
                    contract: {
                        id: contract._id,
                        room: contract.room,
                        tenants: contract.tenants,
                        monthlyRent: contract.monthlyRent,
                        electricPrice: contract.electricPrice,
                        waterPrice: contract.waterPrice,
                        waterPricePerPerson: contract.waterPricePerPerson,
                        waterChargeType: contract.waterChargeType,
                        servicePrice: contract.servicePrice,
                        currentElectricIndex: contract.currentElectricIndex,
                        currentWaterIndex: contract.currentWaterIndex
                    },
                    suggestedPeriod: {
                        start: suggestedPeriodStart,
                        end: suggestedPeriodEnd
                    },
                    suggestedDueDate,
                    lastInvoice: lastInvoice ? {
                        periodStart: lastInvoice.periodStart,
                        periodEnd: lastInvoice.periodEnd,
                        electricNewReading: lastInvoice.electricNewReading,
                        waterNewReading: lastInvoice.waterNewReading
                    } : null
                }
            });
        } catch (error) {
            console.error('Get new invoice info error:', error);
            res.status(500).json({
                success: false,
                message: 'Lỗi server khi lấy thông tin hóa đơn mới',
                error: error.message
            });
        }
    }
}

export default new InvoiceController();