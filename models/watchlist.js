const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema({
    videos: [
        {
            video_name: {
                type: String,
                required: true
            },
            video_url: {
                type: String,
                required: true
            },
            description: {
                type: String,
                required: true
            },
            genre: {
                type: String,
                required: true
            }
        }
    ]
});

// Create a model based on the schema
const Watchlist = mongoose.model('Watchlist', watchlistSchema);

module.exports = Watchlist;

