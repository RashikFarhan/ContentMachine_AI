const axios = require('axios');
async function test() {
  try {
    const res = await axios.post('http://localhost:5000/api/youtube/upload', {
      workspaceId: '4d37ef0a-5706-4766-9441-282f52106c3a',
      videoUrl: null,
      title: 'test',
      description: 'test'
    });
    console.log("Success:", res.data);
  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}
test();
