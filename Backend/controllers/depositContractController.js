/**
 * Deposit Contract Controller - Xử lý hợp đồng đặt cọc
 */
import DepositContract from '../schemas/DepositContract.js';
import Room from '../schemas/Room.js';

// Tạo hợp đồng đặt cọc
export const createDepositContract = async (req, res) => {
    try {
        const { 
            roomId, 
            tenantName, 
            tenantPhone, 
            depositDate, 
            expectedMoveInDate, 
            depositAmount, 
            notes 
        } = req.body;

        // Kiểm tra phòng tồn tại và có sẵn
        const room = await Room.findById(roomId);
        if (!room) {
            return res.status(404).json({
                success: false,
                message: 'Phòng không tồn tại'
            });
        }

        if (room.status !== 'available') {
            return res.status(400).json({
                success: false,
                message: 'Phòng không có sẵn để đặt cọc'
            });
        }

        // Tạo hợp đồng cọc
        const depositContract = new DepositContract({
            room: roomId,
            tenantName,
            tenantPhone,
            depositDate: new Date(depositDate),
            expectedMoveInDate: new Date(expectedMoveInDate),
            depositAmount,
            roomPrice: room.price,
            notes,
            createdBy: req.user.userId || req.user.id
        });

        await depositContract.save();

        // Cập nhật trạng thái phòng thành reserved
        await Room.findByIdAndUpdate(roomId, { status: 'reserved' });

        // Populate thông tin phòng để trả về
        await depositContract.populate('room');

        res.status(201).json({
            success: true,
            message: 'Tạo hợp đồng đặt cọc thành công',
            data: depositContract
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi tạo hợp đồng đặt cọc',
            error: error.message
        });
    }
};

// Lấy danh sách hợp đồng đặt cọc
export const getDepositContracts = async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        
        const userId = req.user.userId || req.user.id;
        
        const filter = {
            createdBy: userId
        };
        if (status) filter.status = status;


        const contracts = await DepositContract.find(filter)
            .populate('room', 'roomNumber price area')
            .populate('createdBy', 'fullName email')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await DepositContract.countDocuments(filter);

        res.json({
            success: true,
            data: contracts,
            pagination: {
                current: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi lấy danh sách hợp đồng cọc',
            error: error.message
        });
    }
};

// Lấy thông tin chi tiết hợp đồng đặt cọc
export const getDepositContractById = async (req, res) => {
    try {
        const { id } = req.params;

        const contract = await DepositContract.findById(id)
            .populate('room')
            .populate('createdBy', 'fullName email');

        if (!contract) {
            return res.status(404).json({
                success: false,
                message: 'Hợp đồng cọc không tồn tại'
            });
        }

        res.json({
            success: true,
            data: contract
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi lấy thông tin hợp đồng cọc',
            error: error.message
        });
    }
};

// Cập nhật trạng thái hợp đồng đặt cọc
export const updateDepositContractStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const contract = await DepositContract.findById(id).populate('room');
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: 'Hợp đồng cọc không tồn tại'
            });
        }

        contract.status = status;
        await contract.save();

        // Nếu hủy hoặc hết hạn, cập nhật lại trạng thái phòng về available
        if (status === 'cancelled' || status === 'expired') {
            await Room.findByIdAndUpdate(contract.room._id, { status: 'available' });
        }

        res.json({
            success: true,
            message: 'Cập nhật trạng thái hợp đồng cọc thành công',
            data: contract
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi cập nhật trạng thái hợp đồng cọc',
            error: error.message
        });
    }
};

// Xóa hợp đồng đặt cọc
export const deleteDepositContract = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId || req.user.id;

        const contract = await DepositContract.findById(id).populate('room');
        if (!contract) {
            return res.status(404).json({
                success: false,
                message: 'Hợp đồng cọc không tồn tại'
            });
        }

        // Kiểm tra quyền xóa (chỉ người tạo mới được xóa)
        if (contract.createdBy.toString() !== userId.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Bạn không có quyền xóa hợp đồng này'
            });
        }

        // Xóa hợp đồng
        await DepositContract.findByIdAndDelete(id);

        // Cập nhật lại trạng thái phòng về available
        if (contract.room) {
            await Room.findByIdAndUpdate(contract.room._id, { status: 'available' });
        }

        res.json({
            success: true,
            message: 'Xóa hợp đồng cọc thành công'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Có lỗi xảy ra khi xóa hợp đồng cọc',
            error: error.message
        });
    }
};
