/**
 * Invoice Repository - Tương tác DB cho hóa đơn
 */
import { Invoice, Contract, Room, Tenant } from '../../../schemas/index.js';
import mongoose from 'mongoose';

class InvoiceRepository {
    async create(data) {
        try {
            const invoice = new Invoice(data);
            return await invoice.save();
        } catch (error) {
            throw new Error('Error creating invoice: ' + error.message);
        }
    }

    async findById(id) {
        try {
            return await Invoice.findById(id)
                .populate('contract', 'startDate endDate monthlyRent deposit')
                .populate('room', 'roomNumber property')
                .populate('tenant', 'fullName phone email')
                .populate('landlord', 'name email phone')
                .populate('createdBy', 'name')
                .populate('updatedBy', 'name');
        } catch (error) {
            throw new Error('Error finding invoice: ' + error.message);
        }
    }

    async list({ page = 1, limit = 10, landlord, room, tenant, contract, status, month, year, sortBy = 'issueDate', sortOrder = 'desc' }) {
        try {
            const query = {};
            
            if (landlord) query.landlord = landlord;
            if (room) query.room = room;
            if (tenant) query.tenant = tenant;
            if (contract) query.contract = contract;
            if (status) {
                // Handle status as either string or array
                if (Array.isArray(status)) {
                    query.status = { $in: status };
                } else {
                    query.status = status;
                }
            }

            // Filter by month and year
            if (month || year) {
                const dateQuery = {};
                if (year) {
                    const startOfYear = new Date(year, 0, 1);
                    const endOfYear = new Date(year, 11, 31, 23, 59, 59);
                    dateQuery.$gte = startOfYear;
                    dateQuery.$lte = endOfYear;
                }
                if (month && year) {
                    const startOfMonth = new Date(year, month - 1, 1);
                    const endOfMonth = new Date(year, month, 0, 23, 59, 59);
                    dateQuery.$gte = startOfMonth;
                    dateQuery.$lte = endOfMonth;
                }
                query.issueDate = dateQuery;
            }

            const skip = (page - 1) * limit;
            const sortOptions = {};
            sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

            const [items, total] = await Promise.all([
                Invoice.find(query)
                    .populate('contract', 'startDate endDate monthlyRent')
                    .populate('room', 'roomNumber property')
                    .populate('tenant', 'fullName phone')
                    .populate('landlord', 'name')
                    .sort(sortOptions)
                    .skip(skip)
                    .limit(limit),
                Invoice.countDocuments(query)
            ]);

            return { 
                items, 
                pagination: { 
                    page: Number(page), 
                    pages: Math.ceil(total / limit) || 1, 
                    total,
                    limit: Number(limit)
                } 
            };
        } catch (error) {
            throw new Error('Error listing invoices: ' + error.message);
        }
    }

    async update(id, data) {
        try {
            return await Invoice.findByIdAndUpdate(id, data, { new: true })
                .populate('contract', 'startDate endDate monthlyRent')
                .populate('room', 'roomNumber property')
                .populate('tenant', 'fullName phone')
                .populate('landlord', 'name');
        } catch (error) {
            throw new Error('Error updating invoice: ' + error.message);
        }
    }

    async delete(id) {
        try {
            return await Invoice.findByIdAndDelete(id);
        } catch (error) {
            throw new Error('Error deleting invoice: ' + error.message);
        }
    }

    // Tìm hóa đơn cuối cùng của hợp đồng để lấy chu kỳ
    async getLastInvoiceByContract(contractId) {
        try {
            return await Invoice.findOne({ contract: contractId })
                .sort({ periodEnd: -1 })
                .select('periodStart periodEnd');
        } catch (error) {
            throw new Error('Error getting last invoice: ' + error.message);
        }
    }

    // Kiểm tra trùng lắp chu kỳ
    async checkPeriodOverlap(contractId, periodStart, periodEnd, excludeId = null) {
        try {
            const query = {
                contract: contractId,
                $or: [
                    // Chu kỳ mới bắt đầu trong chu kỳ cũ
                    { 
                        periodStart: { $lte: periodStart },
                        periodEnd: { $gt: periodStart }
                    },
                    // Chu kỳ mới kết thúc trong chu kỳ cũ
                    { 
                        periodStart: { $lt: periodEnd },
                        periodEnd: { $gte: periodEnd }
                    },
                    // Chu kỳ mới bao trùm chu kỳ cũ
                    {
                        periodStart: { $gte: periodStart },
                        periodEnd: { $lte: periodEnd }
                    }
                ]
            };

            if (excludeId) {
                query._id = { $ne: excludeId };
            }

            const overlapping = await Invoice.findOne(query);
            return !!overlapping;
        } catch (error) {
            throw new Error('Error checking period overlap: ' + error.message);
        }
    }

    // Thống kê hóa đơn theo chủ trọ
    async getStatsByLandlord(landlordId) {
        try {
            const pipeline = [
                { $match: { landlord: new mongoose.Types.ObjectId(landlordId) } },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$totalAmount' }
                    }
                }
            ];

            const stats = await Invoice.aggregate(pipeline);
            
            const summary = {
                total: 0,
                totalAmount: 0,
                paid: { count: 0, amount: 0 },
                pending: { count: 0, amount: 0 },
                overdue: { count: 0, amount: 0 },
                draft: { count: 0, amount: 0 }
            };

            stats.forEach(stat => {
                summary.total += stat.count;
                summary.totalAmount += stat.totalAmount;
                
                if (summary[stat._id]) {
                    summary[stat._id].count = stat.count;
                    summary[stat._id].amount = stat.totalAmount;
                }
            });

            return summary;
        } catch (error) {
            throw new Error('Error getting invoice stats: ' + error.message);
        }
    }

    // Đánh dấu thanh toán
    async markAsPaid(id, paymentData) {
        try {
            const updateData = {
                status: 'paid',
                paidDate: paymentData.paidDate || new Date(),
                paymentMethod: paymentData.paymentMethod,
                transactionId: paymentData.transactionId,
                updatedBy: paymentData.updatedBy
            };

            return await Invoice.findByIdAndUpdate(id, updateData, { new: true })
                .populate('contract', 'startDate endDate monthlyRent')
                .populate('room', 'roomNumber property')
                .populate('tenant', 'fullName phone')
                .populate('landlord', 'name');
        } catch (error) {
            throw new Error('Error marking invoice as paid: ' + error.message);
        }
    }

    // Tạo invoice number tự động
    async generateInvoiceNumber() {
        try {
            return await Invoice.generateInvoiceNumber();
        } catch (error) {
            throw new Error('Error generating invoice number: ' + error.message);
        }
    }
}

export default new InvoiceRepository();