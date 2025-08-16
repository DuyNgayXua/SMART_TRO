import express from "express";
import { getLocationFromCoords, getNearbyHostels } from "../controllers/locationController.js";

const router = express.Router();

router.post("/", getLocationFromCoords);
router.post("/nearby-hostels", getNearbyHostels);

export default router;
