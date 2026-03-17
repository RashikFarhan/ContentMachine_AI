const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
    const form = new FormData();

    // Create a dummy jpg
    fs.writeFileSync('test_dummy.jpg', 'fake image data');

    form.append('files', fs.createReadStream('test_dummy.jpg'));

    try {
        const response = await axios.post('http://localhost:5000/api/local-media/upload', form, {
            headers: form.getHeaders(),
        });
        console.log("Success:", response.data);
    } catch (error) {
        if (error.response) {
            console.log("Error response:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.log("Error:", error.message);
        }
    } finally {
        fs.unlinkSync('test_dummy.jpg');
    }
}

testUpload();
