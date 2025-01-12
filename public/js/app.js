// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  axios.post('/login', { email, password })
    .then((response) => {
      // Store the JWT token in localStorage for later use
      localStorage.setItem('token', response.data.token);

      // Redirect to the upload page if login is successful
      window.location.href = '/upload.html';
    })
    .catch((error) => {
      console.error('Login failed:', error);
      alert('Login failed, please check your credentials.');
    });
});

// Handle video upload form submission
document.getElementById('uploadForm').addEventListener('submit', function (e) {
  e.preventDefault();

  const videoFile = document.getElementById('videoFile').files[0];
  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const genre = document.getElementById('genre').value;
  const token = localStorage.getItem('token');  // Get the token from localStorage

  // Prepare form data for the upload request
  const formData = new FormData();
  formData.append('video', videoFile);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('genre', genre);

  // Send the video upload request with the JWT token in the headers
  axios.post('/upload', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,  // Send the JWT token in the Authorization header
    },
  })
  .then((response) => {
    alert('Video uploaded successfully');
  })
  .catch((error) => {
    console.error('Upload failed:', error);
    alert('Upload failed, please try again.');
  });
});
