const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    subscriptionId: { type: String, default: "", index: true }, // legacy field
    role: { type: String, enum: ["admin", "member", "super"], default: "member" },
    bio: { type: String, default: "Hey there! I am using Kalapila.", trim: true, maxlength: 200 },
    profilePic: { type: String, default: "" },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Public shape sent to other clients (never includes password)
userSchema.methods.toPublic = function () {
  return {
    _id: this._id,
    name: this.name,
    email: this.email,
    bio: this.bio,
    profilePic: this.profilePic,
    lastSeen: this.lastSeen,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
