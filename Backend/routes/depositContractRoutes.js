/**
 * Deposit Contract Routes - API routes cho hợp đồng đặt cọc
 */
import express from 'express';
import authMiddleware from '../services/shared/middleware/authMiddleware.js';
import {
    createDepositContract,
    getDepositContracts,
    getDepositContractById,
    updateDepositContractStatus,
    deleteDepositContract
} from '../controllers/depositContractController.js';

const router = express.Router();

// Tất cả routes đều cần authentication
router.use(authMiddleware);

// POST /api/deposit-contracts - Tạo hợp đồng đặt cọc
router.post('/', createDepositContract);

// GET /api/deposit-contracts - Lấy danh sách hợp đồng đặt cọc
router.get('/', getDepositContracts);

// GET /api/deposit-contracts/:id - Lấy thông tin chi tiết hợp đồng đặt cọc
router.get('/:id', getDepositContractById);

// PUT /api/deposit-contracts/:id/status - Cập nhật trạng thái hợp đồng đặt cọc
router.put('/:id/status', updateDepositContractStatus);

// DELETE /api/deposit-contracts/:id - Xóa hợp đồng đặt cọc
router.delete('/:id', deleteDepositContract);

export default router;
