/**
 * Room Routes - Định nghĩa endpoints cho rooms
 */
import express from 'express';
import roomController from '../controllers/roomController.js';
import authMiddleware from '../../shared/middleware/authMiddleware.js';
import landlordMiddleware from '../../shared/middleware/landlordMiddleware.js';
import validationMiddleware from '../../shared/middleware/validationMiddleware.js';
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 5 } });

const router = express.Router();

// Public
router.get('/search', authMiddleware, landlordMiddleware, roomController.searchRooms); // ?status=&minPrice=&maxPrice=&roomType=&search=
router.get('/statistics', authMiddleware, landlordMiddleware, roomController.statistics);
router.get('/check-room-number', authMiddleware, landlordMiddleware, roomController.checkRoomNumber);
router.get('/:id', authMiddleware, landlordMiddleware, roomController.getRoom);


router.post('/', authMiddleware, landlordMiddleware, validationMiddleware.validateRoom.bind(validationMiddleware), roomController.createRoom);
router.post('/transfer', authMiddleware, landlordMiddleware, roomController.transferRoom);
router.post('/:id/images', authMiddleware, landlordMiddleware, upload.array('images',5), roomController.uploadImages);
router.delete('/:id/images', authMiddleware, landlordMiddleware, roomController.deleteImage);
router.put('/:id', authMiddleware, landlordMiddleware, validationMiddleware.validateRoomUpdate.bind(validationMiddleware), roomController.updateRoom);
router.delete('/:id', authMiddleware, landlordMiddleware, roomController.deleteRoom);
router.patch('/:id/status', authMiddleware, landlordMiddleware, validationMiddleware.validateRoomStatus.bind(validationMiddleware), roomController.updateStatus);

export default router;
