/**
 * AWS Rekognition Service for Content Moderation - Direct S3 Analysis
 */
import AWS from 'aws-sdk';

// Configure AWS
const rekognition = new AWS.Rekognition({
  region: process.env.AWS_REGION || 'ap-southeast-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

/**
 * Analyze image content using AWS Rekognition
 */
export const analyzeImageContent = async (imageBuffer) => {
  try {
    console.log('Analyzing image with AWS Rekognition...');

    const params = {
      Image: {
        Bytes: imageBuffer
      },
      MinConfidence: 50
    };

    // Detect unsafe content
    const moderationResult = await rekognition.detectModerationLabels(params).promise();
    
    // Process moderation labels
    const moderationAnalysis = processModerationLabels(moderationResult.ModerationLabels);
    
    return moderationAnalysis;

  } catch (error) {
    console.error('AWS Rekognition image analysis error:', error);
    throw new Error(`Image analysis failed: ${error.message}`);
  }
};

/**
 * Analyze video content using AWS Rekognition from S3 key (Direct)
 */
export const analyzeVideoContentFromS3 = async (s3Key) => {
  try {
    console.log(`Starting video analysis with AWS Rekognition for S3 key: ${s3Key}`);

    const params = {
      Video: {
        S3Object: {
          Bucket: process.env.AWS_S3_BUCKET || 's3tranquochuy',
          Name: s3Key
        }
      },
      MinConfidence: 50
    };
    
    console.log(`AWS Rekognition params:`, params);

    // Start content moderation job
    const jobResult = await rekognition.startContentModeration(params).promise();
    const jobId = jobResult.JobId;
    console.log(`Video moderation job started: ${jobId}`);

    // Wait for job completion and get results
    const moderationResult = await waitForModerationJob(jobId);
    
    // Process video moderation results
    const videoAnalysis = processVideoModerationResults(moderationResult);
    
    console.log(`Video analysis completed for: ${s3Key}`);
    
    return videoAnalysis;

  } catch (error) {
    console.error('AWS Rekognition video analysis error:', error);
    throw new Error(`Video analysis failed: ${error.message}`);
  }
};

/**
 * Legacy function for backward compatibility (deprecated)
 */
export const analyzeVideoContent = async (videoUrl) => {
  console.log(`analyzeVideoContent is deprecated. Use analyzeVideoContentFromS3 instead.`);
  throw new Error('This function is deprecated. Videos should be uploaded directly to S3.');
};

/**
 * Wait for video moderation job to complete
 */
const waitForModerationJob = async (jobId, maxWaitTime = 60000) => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const params = { JobId: jobId };
    const result = await rekognition.getContentModeration(params).promise();
    
    if (result.JobStatus === 'SUCCEEDED') {
      return result;
    } else if (result.JobStatus === 'FAILED') {
      throw new Error('Video moderation job failed');
    }
    
    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error('Video moderation job timeout');
};

/**
 * Process AWS Rekognition moderation labels for images
 */
const processModerationLabels = (moderationLabels) => {
  // AWS Rekognition categories mapping
  const categoryMap = {
    'Violence': 'violence',
    'Weapons': 'weapons', 
    'Graphic Violence Or Gore': 'gore',
    'Nudity': 'explicit',
    'Suggestive': 'explicit',
    'Drugs': 'drugs',
    'Tobacco': 'drugs',
    'Hate Symbols': 'terrorism',
    'Extremism': 'terrorism'
  };

  // Initialize categories with 0
  const categories = {
    violence: 0,
    weapons: 0,
    gore: 0,
    explicit: 0,
    drugs: 0,
    terrorism: 0
  };

  const violations = [];
  let maxConfidence = 0;

  // Process each moderation label
  moderationLabels.forEach(label => {
    const category = categoryMap[label.Name];
    const confidence = label.Confidence / 100; // Convert to 0-1 range
    
    if (category && confidence > categories[category]) {
      categories[category] = confidence;
      maxConfidence = Math.max(maxConfidence, confidence);
    }
  });

  // Check thresholds
  const thresholds = {
    violence: 0.7,
    weapons: 0.7,
    gore: 0.6,
    explicit: 0.8,
    drugs: 0.7,
    terrorism: 0.8
  };

  let isApproved = true;

  Object.keys(categories).forEach(category => {
    const score = categories[category];
    const threshold = thresholds[category];
    
    if (score > threshold) {
      isApproved = false;
      violations.push({
        category,
        score: Math.round(score * 100),
        threshold: Math.round(threshold * 100),
        message: getCategoryMessage(category, score)
      });
    }
  });

  return {
    isApproved,
    status: isApproved ? 'approved' : 'rejected',
    confidence: Math.round((1 - maxConfidence) * 100) / 100,
    categories,
    violations,
    message: isApproved 
      ? 'Nội dung được phê duyệt' 
      : `Lý do: ${violations.map(v => v.message).join(', ')}`,
    details: {
      provider: 'AWS Rekognition',
      totalViolations: violations.length,
      riskLevel: getRiskLevel(maxConfidence),
      rawLabels: moderationLabels
    }
  };
};

/**
 * Process video moderation results
 */
const processVideoModerationResults = (moderationResult) => {
  if (!moderationResult.ModerationLabels || moderationResult.ModerationLabels.length === 0) {
    return {
      isApproved: true,
      status: 'approved',
      confidence: 1.0,
      categories: {},
      message: 'Video được phê duyệt',
      details: { provider: 'AWS Rekognition', type: 'video' }
    };
  }

  // Process video labels (similar to image but with timestamps)
  const categoryMap = {
    'Violence': 'violence',
    'Weapons': 'weapons',
    'Graphic Violence Or Gore': 'gore',
    'Nudity': 'explicit',
    'Suggestive': 'explicit',
    'Drugs': 'drugs',
    'Tobacco': 'drugs',
    'Hate Symbols': 'terrorism',
    'Extremism': 'terrorism'
  };

  const categories = {
    violence: 0,
    weapons: 0,
    gore: 0,
    explicit: 0,
    drugs: 0,
    terrorism: 0
  };

  const violations = [];
  let maxConfidence = 0;

  // Video thresholds (slightly lower than images)
  const videoThresholds = {
    violence: 0.65,
    weapons: 0.7,
    gore: 0.55,
    explicit: 0.8,
    drugs: 0.7,
    terrorism: 0.8
  };

  // Process video moderation labels
  moderationResult.ModerationLabels.forEach(labelDetection => {
    const label = labelDetection.ModerationLabel;
    const category = categoryMap[label.Name];
    const confidence = label.Confidence / 100;
    
    if (category && confidence > categories[category]) {
      categories[category] = confidence;
      maxConfidence = Math.max(maxConfidence, confidence);
    }
  });

  // Check video thresholds
  let isApproved = true;

  Object.keys(categories).forEach(category => {
    const score = categories[category];
    const threshold = videoThresholds[category];
    
    if (score > threshold) {
      isApproved = false;
      violations.push({
        category,
        score: Math.round(score * 100),
        threshold: Math.round(threshold * 100),
        message: getVideoCategoryMessage(category, score)
      });
    }
  });

  return {
    isApproved,
    status: isApproved ? 'approved' : 'rejected',
    confidence: Math.round((1 - maxConfidence) * 100) / 100,
    categories,
    violations,
    message: isApproved 
      ? 'Video được phê duyệt' 
      : `Lý do: ${violations.map(v => v.message).join(', ')}`,
    details: {
      provider: 'AWS Rekognition',
      type: 'video',
      totalViolations: violations.length,
      riskLevel: getRiskLevel(maxConfidence),
      jobId: moderationResult.JobId
    }
  };
};

/**
 * Get category message for images
 */
const getCategoryMessage = (category, score) => {
  const messages = {
    violence: `Phát hiện nội dung bạo lực `,
    weapons: `Phát hiện vũ khí `,
    gore: `Phát hiện nội dung máu me `,
    explicit: `Phát hiện nội dung không phù hợp `,
    drugs: `Phát hiện nội dung ma túy `,
    terrorism: `Phát hiện nội dung cực đoan `
  };

  return messages[category] || `Phát hiện nội dung vi phạm (${Math.round(score * 100)}%)`;
};

/**
 * Get category message for videos
 */
const getVideoCategoryMessage = (category, score) => {
  const messages = {
    violence: `Phát hiện nội dung bạo lực trong video `,
    weapons: `Phát hiện vũ khí trong video `,
    gore: `Phát hiện nội dung máu me trong video `,
    explicit: `Phát hiện nội dung không phù hợp trong video `,
    drugs: `Phát hiện nội dung ma túy trong video `,
    terrorism: `Phát hiện nội dung cực đoan trong video `
  };

  return messages[category] || `Phát hiện nội dung vi phạm trong video`;
};

/**
 * Determine risk level
 */
const getRiskLevel = (maxScore) => {
  if (maxScore < 0.3) return 'low';
  if (maxScore < 0.6) return 'medium';
  if (maxScore < 0.8) return 'high';
  return 'critical';
};


export default {
  analyzeImageContent,
  analyzeVideoContent
};
