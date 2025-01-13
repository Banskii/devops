const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const path = require('path'); // Required for static file serving

const User = require('./models/user'); // Import the User model
const Video = require('./models/Video');
const Watchlist = require('./models/watchlist');

const multer = require('multer');
const { Storage } = require('@google-cloud/storage');

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const cors = require('cors');
const ffmpeg = require('fluent-ffmpeg');
const mysql = require('mysql2')
require('dotenv').config();

const app = express();
const port = 3002;


// Serve static files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());

// Middleware to parse JSON request bodies
app.use(bodyParser.json());



// Google cloud storage
const Cloudstorage = new Storage({
  keyFilename : process.env.Keyfilename
});
const bucket = Cloudstorage.bucket(process.env.Bucket_name);
const upload = multer({
  storage : multer.memoryStorage(),
  limits : { fileSize: 50 * 1024 * 1024 },
});



// MongoDB connection string
const dbUri = "mongodb+srv://tekenaotus:UPZDYYt0waZDQSv5@cluster0.8o0rm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
// Connect to MongoDB using Mongoose
mongoose.connect(dbUri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("MongoDB connected");
    
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });



// amazon rds mysql database connection
const db = mysql.createConnection({
  host: 'database.cef1ze2v7zq7.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: 'Tekesotus11.',
  database: 'watchlist',
  port: 3306,
  charset: 'utf8mb4'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1); // Exit if the connection fails
  }
  console.log('Connected to MySQL database');
});



// User Registration Route
app.post('/register', async (req, res) => {
  const { email, firstname, lastname, password } = req.body;

  try {
    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Determine if the user is admin based on the email
    // const role = email === adminEmail ? 'admin' : 'user';

    // Create new user
    const newUser = new User({
      email,
      firstname,
      lastname,
      password,
//      role, // Set the role based on the email
    });

    // Save the user to the database
    await newUser.save();
    res.status(201).json({ message: 'User created successfully' });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// User Login Route
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare entered password with stored password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }


    const token = jwt.sign(
      { email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h'}
    );
    // Login successful, do not send the role
    res.status(200).json({
      message: 'Login successful', token: token});

  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ message: 'Server error' });
  }
});



// Upload Route to handle file uploads to Google Cloud Storage
app.post('/upload', upload.single('videoFile'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // Get file information
  const file = req.file;

  const tempFilePath = path.join(__dirname, 'uploads', Date.now() + '-' + file.originalname);

  // Write buffer to temporary file
  fs.writeFileSync(tempFilePath, file.buffer);

  // Use FFmpeg to extract video metadata
  ffmpeg(tempFilePath)
  .on('start', commandLine => {
    console.log('FFmpeg command:', commandLine); // Logs the command being executed
  })
  .on('stderr', stderr => {
    console.error('FFmpeg stderr:', stderr); // Logs any errors from FFmpeg
  })
  .on('error', (err, stdout, stderr) => {
    console.error('Error extracting metadata:', err);
    console.error('FFmpeg stderr:', stderr); // Detailed FFmpeg error message
    return res.status(500).json({ message: 'Error extracting metadatas' });
  })

    .ffprobe((err, metadata) => {
      // Remove the temporary file after processing
      fs.unlinkSync(tempFilePath);
      if (err) {
        console.error('Error extracting ffprobe:', err);
        return res.status(500).json({ message: 'Error extracting metadataa' });
      }

    // Extract required metadata
      const { format, streams } = metadata;
      const duration = format.duration; // Duration in seconds
      const videoSize = file.size; // Size of the video in bytes
      const videoFormat = format.format_name; // Video format (e.g., mp4, mkv)
      const resolution = streams[0].width + 'x' + streams[0].height; // Video resolution (e.g., 1920x1080)

    // Get metadata from request body (title, description, genre)
      const { title, description, genre } = req.body;

    // Ensure metadata fields are provided
    if (!title || !description || !genre) {
      return res.status(400).json({ message: 'Missing required metadata fields' });
    }

    // Prepare the file for Google Cloud Storage
    const blob = bucket.file(Date.now() + '-' + file.originalname); // Unique file name
    const blobStream = blob.createWriteStream();

    blobStream.on('finish', () => {
      // Once the file is uploaded, get its URL
      const fileUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      // Save metadata to MySQL (including the video URL)
      const sqlQuery = 'INSERT INTO videos (video_name, video_url, description, title, genre, duration, video_size, video_format, resolution, upload_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())';
      const videoData = [file.originalname, fileUrl, description, title, genre, duration, videoSize, videoFormat, resolution];

      // Insert metadata into the database
      db.query(sqlQuery, videoData, (err, result) => {
        if (err) {
          console.error('Error saving metadata to database:', err);
          return res.status(500).json({ message: 'Error saving metadata' });
        }

        // Return success response
        res.status(200).json({
          message: 'File uploaded and metadata saved successfully',
          fileUrl,
        });
      });
    });

    blobStream.on('error', (err) => {
      console.error('Error uploading file to GCS:', err);
      res.status(500).json({ message: 'Error uploading file' });
    });

    // End the stream and upload the file
    blobStream.end(file.buffer);
  });
});



app.get('/videos', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'videos.html'));
});

app.get('/watchlist', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'watchlist.html'));
});


app.get('/videos/api', async (req, res) => {
  try {
    // Fetch the list of videos from the MySQL database
    const sqlQuery = 'SELECT id, video_name, video_url, description, genre FROM videos';

    db.query(sqlQuery, (err, result) => {
      if (err) {
        console.error('Error fetching videos from DB:', err);
        return res.status(500).json({ message: 'Error fetching videos' });
      }

      // Send the video list as response
      res.json(result);
    });
  } catch (err) {
    console.error('Error fetching videos:', err);
    res.status(500).json({ message: 'Error fetching videos' });
  }
});



app.get('/videos/:videoId', (req, res) => {
  const { videoId } = req.params;

  // Query the database for the video details
  const sqlQuery = 'SELECT video_url FROM videos WHERE id = ?';

  db.query(sqlQuery, [videoId], (err, result) => {
    if (err || result.length === 0) {
      console.error('Error fetching video from DB:', err);
      return res.status(404).json({ message: 'Video not found' });
    }

    const videoUrl = result[0].video_url;

    // Redirect to the video URL stored in the database
    res.redirect(videoUrl);
  });
});



// Route to add a video to the shared watchlist
app.post('/watchlist/add', async (req, res) => {
    const { videoId, videoName, videoUrl, description, genre } = req.body;

    try {
        // Find or create the shared watchlist
        let watchlist = await Watchlist.findOne();

        if (!watchlist) {
            // Create a new watchlist if it doesn't exist
            watchlist = new Watchlist({ videos: [] });
        }

        // Check if the video is already in the watchlist
        const videoExists = watchlist.videos.some(video => video.video_name === videoName);

        if (videoExists) {
            return res.status(400).json({ message: 'Video already in the watchlist' });
        }

        // Add the new video to the watchlist
        watchlist.videos.push({ videoId, video_name: videoName, video_url: videoUrl, description, genre });
        await watchlist.save();

        res.status(200).json({ message: 'Video added to watchlist' });
    } catch (err) {
        console.error('Error adding video to watchlist:', err);
        res.status(500).json({ message: 'Failed to add video to watchlist' });
    }
});

// Route to get all videos from the watchlist
app.get('/watchlist/api', async (req, res) => {
    try {
        const watchlist = await Watchlist.findOne();

        if (!watchlist) {
            return res.status(404).json({ message: 'Watchlist not found' });
        }

        res.json(watchlist.videos);  // Return the list of videos in the watchlist
    } catch (err) {
        console.error('Error fetching watchlist:', err);
        res.status(500).json({ message: 'Failed to fetch watchlist' });
    }
});



app.get('/', (req, res) => {
  res.status(200).send('Hello Worlds!!');
});



app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});



app.get('/upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});



app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the Express server
if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
}
module.exports = app;
