const mongoose = require("mongoose");

const spaceSchema = new mongoose.Schema(
  {
    spaceId: { type: String, required: true, unique: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: "", trim: true, maxlength: 300 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["admin", "member"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
        lastReadAt: { type: Date, default: null },
      },
    ],
  },
  { timestamps: true }
);

spaceSchema.index({ "members.user": 1 });

spaceSchema.methods.memberOf = function (userId) {
  const id = userId?.toString();
  return this.members.find((m) => (m.user?._id || m.user)?.toString() === id);
};

module.exports = mongoose.model("Space", spaceSchema);
