const express = require('express');
const cors = require('cors');
const axios = require('axios');
const FormData = require('form-data');
const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Telegram Bot Configuration - Yahan aapka token aur chat ID daalein
const TELEGRAM_BOT_TOKEN = "8312788837:AAHfcaUZihg8xc8Wbu7GLdUdWlK3WWrQEA4";
const TELEGRAM_CHAT_ID = "7528977004";

// Health check endpoint
app.get('/', (req, res) => {
    res.json({ 
        status: 'Telegram Photo API is running',
        message: 'Use POST /api/send-photo to send photos',
        bot_token: TELEGRAM_BOT_TOKEN.substring(0, 10) + '...',
        chat_id: TELEGRAM_CHAT_ID
    });
});

// Send photo to Telegram
app.post('/api/send-photo', async (req, res) => {
    try {
        const { photoData, gesture, text } = req.body;
        
        if (!photoData) {
            return res.status(400).json({ 
                success: false,
                error: 'No photo data provided' 
            });
        }

        console.log('📸 Photo received for Telegram:', {
            gesture,
            text,
            dataLength: photoData.length
        });

        // Remove data URL prefix
        const base64Data = photoData.replace(/^data:image\/jpeg;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Create form data
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', buffer, {
            filename: `gesture_${Date.now()}.jpg`,
            contentType: 'image/jpeg'
        });
        
        const caption = `🤖 Hand Gesture Detected\n\n` +
                       `Gesture: ${gesture || 'Unknown'}\n` +
                       `Text: ${text || 'HELLO'}\n` +
                       `Time: ${new Date().toLocaleString()}\n` +
                       `Server: Vercel`;
        
        formData.append('caption', caption);

        // Send to Telegram
        const response = await axios.post(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                }
            }
        );

        console.log('✅ Telegram response:', response.data);
        
        res.json({ 
            success: true, 
            message: 'Photo sent to Telegram successfully',
            telegramResponse: response.data 
        });
        
    } catch (error) {
        console.error('❌ Error sending photo:', error.message);
        
        res.status(500).json({ 
            success: false,
            error: 'Failed to send photo to Telegram',
            details: error.message 
        });
    }
});

// Get bot info (for verification)
app.get('/api/bot-info', async (req, res) => {
    try {
        const response = await axios.get(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe`
        );
        res.json({
            success: true,
            botInfo: response.data
        });
    } catch (error) {
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch bot info',
            details: error.message 
        });
    }
});

// Test endpoint
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'API is working!',
        timestamp: new Date().toISOString(),
        endpoints: {
            sendPhoto: 'POST /api/send-photo',
            botInfo: 'GET /api/bot-info',
            health: 'GET /'
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🤖 Bot Token: ${TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
    console.log(`💬 Chat ID: ${TELEGRAM_CHAT_ID}`);
});
