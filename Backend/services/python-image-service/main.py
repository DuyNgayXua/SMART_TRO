"""
SMART TRO - Image Feature Extraction Service
ResNet50-based visual search for property rental images
Google Lens-style image search functionality
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import tensorflow as tf
from tensorflow.keras.applications.resnet50 import ResNet50, preprocess_input
import numpy as np
import io
from PIL import Image
import logging
import uvicorn
import time
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="SMART TRO Image Search Service",
    description="ResNet50-based image feature extraction for property rental search like Google Lens",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware for Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", 
        "http://127.0.0.1:3000",
        "http://localhost:5000",
        "http://127.0.0.1:5000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ResNet50FeatureExtractor:
    """
    ResNet50-based feature extractor for image similarity search
    Extracts 2048-dimensional feature vectors from property images
    """
    
    def __init__(self):
        self.model = None
        self.model_name = "ResNet50"
        self.feature_dimension = 2048
        self.input_size = (224, 224)
        self.is_loaded = False
        
    def load_model(self):
        """Load ResNet50 model for feature extraction"""
        if self.model is None:
            logger.info("Loading ResNet50 model for property image search...")
            start_time = time.time()
            
            try:
                # Load ResNet50 without classification head
                self.model = ResNet50(
                    weights='imagenet',           # Pre-trained weights
                    include_top=False,            # Remove classification layer
                    pooling='avg',                # Global average pooling
                    input_shape=(224, 224, 3)    # Standard input shape
                )
                
                # Make model non-trainable for inference
                self.model.trainable = False
                
                load_time = time.time() - start_time
                self.is_loaded = True
                
                logger.info(f"ResNet50 loaded successfully in {load_time:.2f}s")
                logger.info(f"Model output shape: {self.model.output_shape}")
                logger.info(f"Feature dimension: {self.feature_dimension}")
                
                return True
                
            except Exception as e:
                logger.error(f"Failed to load ResNet50: {e}")
                self.is_loaded = False
                return False
                
        return True
    
    def preprocess_image(self, image_bytes):
        """
        Preprocess image for ResNet50 inference
        - Resize to 224x224
        - Convert to RGB
        - Normalize pixel values
        """
        try:
            # Load image from bytes
            pil_image = Image.open(io.BytesIO(image_bytes))
            
            # Convert to RGB if needed
            if pil_image.mode != 'RGB':
                pil_image = pil_image.convert('RGB')
                logger.info(f"Converted image from {pil_image.mode} to RGB")
            
            # Resize to ResNet50 input size
            pil_image = pil_image.resize(self.input_size, Image.Resampling.LANCZOS)
            
            # Convert to numpy array
            img_array = np.array(pil_image, dtype=np.float32)
            
            # Add batch dimension [1, 224, 224, 3]
            img_array = np.expand_dims(img_array, axis=0)
            
            # ResNet50 preprocessing (ImageNet normalization)
            img_array = preprocess_input(img_array)
            
            logger.info(f"Image preprocessed to shape: {img_array.shape}")
            return img_array
            
        except Exception as e:
            logger.error(f"Image preprocessing error: {e}")
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid image format or corrupted file: {e}"
            )
    
    def extract_features(self, image_bytes):
        """
        Extract 2048-dimensional feature vector using ResNet50
        Returns normalized feature vector for similarity search
        """
        try:
            # Ensure model is loaded
            if not self.load_model():
                raise HTTPException(
                    status_code=500, 
                    detail="ResNet50 model failed to load"
                )
            
            # Preprocess image
            processed_image = self.preprocess_image(image_bytes)
            
            # Extract features
            start_time = time.time()
            logger.info("Extracting ResNet50 features...")
            
            # Forward pass through ResNet50
            features = self.model.predict(processed_image, verbose=0)
            
            extraction_time = time.time() - start_time
            
            # Normalize feature vector for cosine similarity
            feature_vector = features[0]  # Remove batch dimension
            norm = np.linalg.norm(feature_vector)
            if norm > 0:
                feature_vector = feature_vector / norm
            
            # Convert to Python list for JSON serialization
            feature_list = feature_vector.tolist()
            
            logger.info(f"Extracted {len(feature_list)}-dim features in {extraction_time:.2f}s")
            
            return {
                "embedding": feature_list,
                "dimension": len(feature_list),
                "model": self.model_name,
                "extraction_time_ms": round(extraction_time * 1000, 2),
                "normalized": True
            }
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Feature extraction failed: {e}")
            raise HTTPException(
                status_code=500, 
                detail=f"Feature extraction error: {e}"
            )

# Initialize feature extractor
feature_extractor = ResNet50FeatureExtractor()

@app.on_event("startup")
async def startup_event():
    """Load ResNet50 model on service startup"""
    logger.info("Starting SMART TRO Image Search Service...")
    logger.info("Google Lens-style visual search for property rentals")
    
    # Pre-load model to avoid first request delay
    success = feature_extractor.load_model()
    
    if success:
        logger.info("Service ready for property image processing!")
        logger.info(f"API docs available at: http://localhost:8001/docs")
    else:
        logger.error("Service startup failed - ResNet50 loading error")

@app.get("/")
async def root():
    """Service information and health check"""
    return {
        "service": "SMART TRO Image Search Service",
        "description": "Google Lens-style visual search for property rentals",
        "version": "1.0.0",
        "model": feature_extractor.model_name,
        "feature_dimension": feature_extractor.feature_dimension,
        "model_loaded": feature_extractor.is_loaded,
        "tensorflow_version": tf.__version__,
        "endpoints": {
            "health": "GET /health",
            "extract_features": "POST /extract-features",
            "batch_extract": "POST /batch-extract",
            "api_docs": "GET /docs"
        },
        "status": "ready" if feature_extractor.is_loaded else "loading"
    }

@app.get("/health")
async def health_check():
    """Detailed health check for monitoring"""
    return {
        "status": "healthy" if feature_extractor.is_loaded else "loading",
        "model_loaded": feature_extractor.is_loaded,
        "model_name": feature_extractor.model_name,
        "feature_dimension": feature_extractor.feature_dimension,
        "tensorflow_version": tf.__version__,
        "python_version": f"{tf.version.VERSION}",
        "timestamp": time.time(),
        "uptime": "ready"
    }

@app.post("/extract-features")
async def extract_image_features(file: UploadFile = File(...)):
    """
    Extract ResNet50 features from property image
    
    Use for:
    - Property image search (like Google Lens)
    - Building image similarity database
    - Visual search by room type, furniture, etc.
    
    Returns:
    - embedding: 2048-dimensional normalized feature vector
    - dimension: 2048 
    - model: ResNet50
    - extraction_time_ms: processing time
    """
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(
            status_code=400,
            detail=f"File must be an image. Received: {file.content_type}"
        )
    
    try:
        # Read image data
        image_bytes = await file.read()
        file_size_mb = len(image_bytes) / (1024 * 1024)
        
        logger.info(f"Processing property image: {file.filename} ({file_size_mb:.2f}MB)")
        
        # Validate file size (max 10MB for performance)
        if file_size_mb > 10:
            raise HTTPException(
                status_code=400, 
                detail="Image too large. Maximum size: 10MB"
            )
        
        # Extract ResNet50 features
        result = feature_extractor.extract_features(image_bytes)
        print("result Extract ResNet50 features:", result)
        
        return {
            "success": True,
            "filename": file.filename,
            "file_size_mb": round(file_size_mb, 2),
            **result,
            "message": f"Successfully extracted {result['dimension']}-dimensional ResNet50 features",
            "use_case": "Property image similarity search"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing {file.filename}: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Internal processing error: {e}"
        )

@app.post("/batch-extract") 
async def batch_extract_features(files: list[UploadFile] = File(...)):
    """
    Extract features from multiple property images
    Useful for:
    - Batch processing existing property database
    - Building image search index
    - Property portfolio analysis
    
    Max 20 images per batch for performance
    """
    
    if len(files) > 20:
        raise HTTPException(
            status_code=400, 
            detail="Maximum 20 images per batch for performance reasons"
        )
    
    results = []
    total_processing_time = 0
    successful_count = 0
    
    logger.info(f"Batch processing {len(files)} property images...")
    
    for i, file in enumerate(files):
        try:
            # Validate file type
            if not file.content_type or not file.content_type.startswith('image/'):
                results.append({
                    "filename": file.filename,
                    "success": False,
                    "error": f"Invalid file type: {file.content_type}"
                })
                continue
            
            # Process image
            image_bytes = await file.read()
            result = feature_extractor.extract_features(image_bytes)
            
            total_processing_time += result['extraction_time_ms']
            successful_count += 1
            
            results.append({
                "filename": file.filename,
                "success": True,
                "embedding": result['embedding'],
                "dimension": result['dimension'],
                "extraction_time_ms": result['extraction_time_ms'],
                "normalized": result['normalized']
            })
            
            logger.info(f"[{i+1}/{len(files)}] Processed: {file.filename}")
            
        except Exception as e:
            logger.error(f"[{i+1}/{len(files)}] Failed: {file.filename} - {e}")
            results.append({
                "filename": file.filename,
                "success": False,
                "error": str(e)
            })
    
    return {
        "success": True,
        "batch_info": {
            "total_files": len(files),
            "successful": successful_count,
            "failed": len(files) - successful_count,
            "success_rate": round(successful_count / len(files) * 100, 1),
            "total_processing_time_ms": round(total_processing_time, 2),
            "avg_processing_time_ms": round(total_processing_time / max(successful_count, 1), 2)
        },
        "results": results,
        "model": feature_extractor.model_name,
        "feature_dimension": feature_extractor.feature_dimension
    }

if __name__ == "__main__":
    # Run with optimized settings for image processing
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        # reload=True,
        log_level="info",
        access_log=True,
        workers=1  # Single worker for consistent model loading
    )
