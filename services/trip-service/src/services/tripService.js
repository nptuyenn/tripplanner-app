export function createTripService(Trip) {
  return {
    async list(ownerId) {
      return Trip.find({ owner: ownerId }).sort({ startDate: 1, createdAt: -1 }).lean();
    },

    async create(ownerId, data) {
      return Trip.create({ ...data, owner: ownerId });
    },

    async update(ownerId, tripId, data) {
      return Trip.findOneAndUpdate(
        { _id: tripId, owner: ownerId },
        { $set: data },
        { new: true, runValidators: true },
      ).lean();
    },

    async remove(ownerId, tripId) {
      return Trip.findOneAndDelete({ _id: tripId, owner: ownerId }).lean();
    },
  };
}
