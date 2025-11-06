import express from "express";
import { 
  getProvinces,
  getWards,
  geocodeAddress

} from "../controllers/locationController.js";

const router = express.Router();


// Address data routes (cập nhật cho cấu trúc mới)
router.get("/provinces", getProvinces);
router.get("/provinces/:provinceName/wards", getWards);
router.post("/geocode", geocodeAddress);


export default router;
