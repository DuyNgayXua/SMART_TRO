/**
 * Script để xóa index key_1 cũ trong collection amenities
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const dropAmenityKeyIndex = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');

    const db = mongoose.connection.db;
    const amenitiesCollection = db.collection('amenities');

    // Lấy danh sách indexes hiện tại
    console.log('\nCurrent indexes:');
    const indexes = await amenitiesCollection.indexes();
    console.log(JSON.stringify(indexes, null, 2));

    // Xóa index key_1
    try {
      await amenitiesCollection.dropIndex('key_1');
      console.log('\n✅ Successfully dropped index: key_1');
    } catch (error) {
      if (error.code === 27) {
        console.log('\n⚠️  Index key_1 does not exist (already dropped)');
      } else {
        throw error;
      }
    }

    // Hiển thị indexes sau khi xóa
    console.log('\nIndexes after drop:');
    const indexesAfter = await amenitiesCollection.indexes();
    console.log(JSON.stringify(indexesAfter, null, 2));

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

dropAmenityKeyIndex();
