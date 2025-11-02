/**
 * Invoice Controller - Xử lý logic nghiệp vụ cho hóa đơn
 */
import invoiceRepository from '../repositories/invoiceRepository.js';
import { Contract, Room, Tenant, User, Invoice } from '../../../schemas/index.js';
import { sendInvoiceEmail, sendEmail } from '../../emailService.js';

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
            waterNewReading = 0,
            sendZaloInvoice = false
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
            const waterBillingType = contract.waterChargeType === 'per_person' ? 'perPerson' : 'perCubicMeter';

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

            // Kiểm tra trùng lắp chu kỳ (DISABLED - cho phép tạo lại hóa đơn cho cùng kỳ)
            // const hasOverlap = await invoiceRepository.checkPeriodOverlap(
            //     contractId, finalPeriodStart, finalPeriodEnd
            // );

            // if (hasOverlap) {
            //     return res.status(400).json({
            //         success: false,
            //         message: 'Chu kỳ hóa đơn bị trùng lắp với hóa đơn khác'
            //     });
            // }

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
            
            // Gửi email thông báo hóa đơn nếu được yêu cầu
            if (sendZaloInvoice) {
                
                try {
                    const tenantInfo = await Tenant.findById(contract.tenants[0]._id);
                    const roomInfo = await Room.findById(contract.room._id);
                    const landlordInfo = await User.findById(landlordId);
                    
                    console.log('   Tenant email:', tenantInfo.email);
                    console.log('   Room:', roomInfo.roomNumber);
                    
                    if (!tenantInfo.email) {
                        console.warn('⚠️ Tenant has no email, skipping notification');
                    } else {
                        // Tạo QR code thanh toán
                        const bankCode = process.env.SEPAY_BANK_CODE || 'MBBank';
                        const accountNumber = process.env.SEPAY_ACCOUNT_NUMBER || '0382173105';
                        const accountName = process.env.SEPAY_ACCOUNT_NAME || 'TRUONG CONG DUY';
                        
                        // Format nội dung chuyển khoản
                        const transferContent = `THANH TOAN HOA DON PHONG ${roomInfo.roomNumber} - ${new Date(finalPeriodStart).toLocaleDateString('vi-VN')} DEN ${new Date(finalPeriodEnd).toLocaleDateString('vi-VN')}`;
                        const formattedContent = transferContent
                            .normalize('NFD')
                            .replace(/[\u0300-\u036f]/g, '')
                            .replace(/\//g, '-')
                            .toUpperCase();
                        
                        // Tạo QR URL
                        const qrCodeUrl = `https://qr.sepay.vn/img?acc=${accountNumber}&bank=${bankCode}&amount=${invoice.totalAmount}&des=${encodeURIComponent(formattedContent)}`;
                        
                        // Cập nhật invoice với QR code
                        await Invoice.findByIdAndUpdate(invoice._id, {
                            $set: {
                                paymentQRCode: qrCodeUrl,
                                paymentQRContent: formattedContent
                            }
                        });
                        
                        // Tạo email HTML với QR code
                        const emailSubject = `Hóa đơn phòng ${roomInfo.roomNumber} - Tháng ${new Date(finalPeriodStart).getMonth() + 1}/${new Date(finalPeriodStart).getFullYear()}`;
                        
                        const emailContent = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
                                <h2 style="color: #333; text-align: center;">HÓA ĐƠN TIỀN PHÒNG</h2>
                                
                                <div style="margin: 20px 0;">
                                    <p><strong>Phòng:</strong> ${roomInfo.roomNumber}</p>
                                    <p><strong>Kỳ thanh toán:</strong> ${new Date(finalPeriodStart).toLocaleDateString('vi-VN')} - ${new Date(finalPeriodEnd).toLocaleDateString('vi-VN')}</p>
                                    <p><strong>Ngày lập:</strong> ${new Date(invoice.issueDate).toLocaleDateString('vi-VN')}</p>
                                    <p><strong>Hạn thanh toán:</strong> ${new Date(invoice.dueDate).toLocaleDateString('vi-VN')}</p>
                                </div>

                                <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <h3 style="color: #333; margin-top: 0;">Chi tiết thanh toán:</h3>
                                    ${invoice.charges?.map(charge => `
                                        <div style="display: flex; justify-content: space-between; margin: 5px 0;">
                                            <span>${charge.description}</span>
                                            <span>${charge.amount.toLocaleString('vi-VN')} VNĐ</span>
                                        </div>
                                    `).join('') || ''}
                                    ${invoice.discount > 0 ? `
                                        <div style="display: flex; justify-content: space-between; margin: 5px 0; color: #e74c3c;">
                                            <span>Giảm giá</span>
                                            <span>-${invoice.discount.toLocaleString('vi-VN')} VNĐ</span>
                                        </div>
                                    ` : ''}
                                    <hr style="margin: 10px 0; border: none; border-top: 2px solid #333;">
                                    <div style="display: flex; justify-content: space-between; margin: 10px 0; font-size: 18px; font-weight: bold; color: #e74c3c;">
                                        <span>TỔNG CỘNG</span>
                                        <span>${invoice.totalAmount.toLocaleString('vi-VN')} VNĐ</span>
                                    </div>
                                </div>

                                <div style="text-align: center; margin: 30px 0;">
                                    <h3 style="color: #333;">Quét mã QR để thanh toán</h3>
                                    <img src="${qrCodeUrl}" alt="QR Code thanh toán" style="max-width: 300px; border: 2px solid #ddd; border-radius: 8px; padding: 10px;" />
                                    <p style="margin-top: 10px; color: #666; font-size: 14px;">
                                        <strong>Ngân hàng:</strong> ${bankCode}<br/>
                                        <strong>Số tài khoản:</strong> ${accountNumber}<br/>
                                        <strong>Chủ tài khoản:</strong> ${accountName}<br/>
                                        <strong>Số tiền:</strong> ${invoice.totalAmount.toLocaleString('vi-VN')} VNĐ<br/>
                                        <strong>Nội dung:</strong> ${formattedContent}
                                    </p>
                                </div>

                                <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; border-left: 4px solid #ffc107;">
                                    <p style="margin: 0; color: #856404;">
                                        <strong>Lưu ý:</strong> Vui lòng thanh toán đúng số tiền và nội dung chuyển khoản để hệ thống tự động xác nhận thanh toán.
                                    </p>
                                </div>

                                ${invoice.notes ? `
                                    <div style="margin: 20px 0; padding: 10px; background-color: #f8f9fa; border-radius: 5px;">
                                        <p style="margin: 0;"><strong>Ghi chú:</strong></p>
                                        <p style="margin: 5px 0 0 0;">${invoice.notes}</p>
                                    </div>
                                ` : ''}

                                <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
                                    <p>Cảm ơn bạn đã tin tưởng sử dụng dịch vụ của chúng tôi!</p>
                                    ${landlordInfo.phone ? `<p>Liên hệ: ${landlordInfo.phone}</p>` : ''}
                                </div>
                            </div>
                        `;
                        
                        // Gửi email
                        const emailResult = await sendEmail({
                            to: tenantInfo.email,
                            subject: emailSubject,
                            html: emailContent
                        });
                        
                        if (emailResult.success) {
                            console.log('✅ Invoice email with QR code sent successfully');
                        } else {
                            console.error('❌ Failed to send email:', emailResult.error);
                        }
                    }
                } catch (emailError) {
                    console.error('❌ Error sending email:', emailError.message);
                }
            } else {
                console.log('📧 Email notification skipped (sendZaloInvoice = false)');
            }
            
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
                fromDate,
                toDate,
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
                fromDate: fromDate ? new Date(fromDate) : undefined,
                toDate: toDate ? new Date(toDate) : undefined,
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
            const { fromDate, toDate } = req.query;
            
            const stats = await invoiceRepository.getStatsByLandlord(landlordId, { fromDate, toDate });
            
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