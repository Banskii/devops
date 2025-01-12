const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  video_name: { type: String, required: true },
  video_url: { type: String, required: true },
  description: { type: String, required: true },
  genre: { type: String, required: true },
  // Other fields like metadata can go here
});

const Video = mongoose.model('Video', videoSchema);

module.exports = Video;
