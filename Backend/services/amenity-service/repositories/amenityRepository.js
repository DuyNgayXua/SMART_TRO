import Amenity from '../../../schemas/Amenity.js';

class AmenityRepository {
  async findAll(filter = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      sortBy = 'displayOrder',
      sortOrder = 1,
      category,
      isActive,
      search,
      owner
    } = options;

    const query = { ...filter };
    
    // Add owner filter - null means global, specific owner means private
    if (owner !== undefined) {
      if (owner === null) {
        query.owner = null; // Only global amenities
      } else {
        query.$or = [
          { owner: null }, // Global amenities
          { owner: owner }  // Owner's private amenities
        ];
      }
    }
    
    // Add category filter
    if (category) {
      query.category = category;
    }
    
    // Add active filter
    if (typeof isActive === 'boolean') {
      query.isActive = isActive;
    }
    
    // Add search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { key: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder, createdAt: -1 };

    const [amenities, total] = await Promise.all([
      Amenity.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      Amenity.countDocuments(query)
    ]);

    return {
      amenities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  async findById(id) {
    return await Amenity.findById(id).lean();
  }

  async findByKey(key, owner = null) {
    const query = { key };
    if (owner) {
      query.owner = owner;
    } else {
      query.owner = null;
    }
    return await Amenity.findOne(query).lean();
  }

  async create(amenityData) {
    const amenity = new Amenity(amenityData);
    return await amenity.save();
  }

  async update(id, amenityData) {
    return await Amenity.findByIdAndUpdate(
      id,
      { ...amenityData, updatedAt: new Date() },
      { new: true, runValidators: true }
    );
  }

  async delete(id) {
    return await Amenity.findByIdAndDelete(id);
  }

  async getCategories() {
    return await Amenity.distinct('category');
  }

  async getActiveAmenities(owner = null) {
    const query = { isActive: true };
    
    if (owner) {
      query.$or = [
        { owner: null }, // Global amenities
        { owner: owner }  // Owner's private amenities
      ];
    } else {
      query.owner = null; // Only global amenities if no owner specified
    }
    
    return await Amenity.find(query)
      .sort({ displayOrder: 1, name: 1 })
      .lean();
  }

  async updateDisplayOrder(amenityId, newOrder) {
    return await Amenity.findByIdAndUpdate(
      amenityId,
      { displayOrder: newOrder },
      { new: true }
    );
  }

  async bulkUpdateOrder(orderUpdates) {
    const operations = orderUpdates.map(({ id, displayOrder }) => ({
      updateOne: {
        filter: { _id: id },
        update: { displayOrder }
      }
    }));

    return await Amenity.bulkWrite(operations);
  }
}

export default new AmenityRepository();
