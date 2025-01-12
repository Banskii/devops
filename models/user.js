// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Video = require('./Video');

// User schema
const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    password: { type: String, required: true },
    watchlist: [{type: mongoose.Schema.Types.ObjectId, ref: 'Video' }]
});

// Method to hash passwords before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Method to compare password during login
userSchema.methods.comparePassword = function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);


module.exports = User;
