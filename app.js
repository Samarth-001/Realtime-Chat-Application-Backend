const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken')

// Connect to the db
require('./db/connection');

//Import FIles Here
const Users = require('./models/Users.js');
const Conversation = require('./models/conversation.js');
const Messages = require('./models/messages.js');

//App Use
const app = express();
app.use(express.json());
// app.use(express.urlencoded({ extended: false }));

const port = process.env.PORT || 8000;

// Routes
app.get('/', (req, res) => {
    res.send('Welcome');
});

app.post('/api/register', async (req, res, next) => {
    try {
        const { fullName, email, password } = req.body;
        if (!fullName || !email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const newUser = new Users({ fullName, email, password })
            bcrypt.hash(password, 10, (err, hashedPassword) => {
                newUser.set('password', hashedPassword);
                newUser.save();
                next();
            })
            return res.status(200).send('User registered successfully');
        }
    } catch (error) {
        console.log('err' + error);
        res.status(500).send(error);
    }
});

app.post('/api/login', async (req, res, next) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).send('Please fill all required fields');
        } else {
            const user = await Users.findOne({ email });
            if (!user) {
                res.status(400).send('User not registered');
            }
            else {
                const validateUser = await bcrypt.compare(password, user.password);
                if (!validateUser) {
                    res.status(400).send('Email or password is incorrect');
                }
                else {
                    const payload = {
                        userId: user._id,
                        email: user.email
                    }
                    const JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'THIS_IS_A_JWT_SECRET_KEY';
                    jwt.sign(payload, JWT_SECRET_KEY, { expiresIn: 84600 }, async (err, token) => {
                        await Users.updateOne({ _id: user.id }, {
                            $set: { token }
                        })
                        user.save();
                        next();
                    })
                }
                res.status(200).json({ user: { email: user.email, fullName: user.fullName, token: user.token } })
            }
        }

    } catch (error) {
        console.log(error)
    }
})

app.post('/api/conversation', async (req, res) => {
    try {
        const { senderId, receiverId } = req.body;
        const newConversation = new Conversation({ members: [senderId, receiverId] });
        await newConversation.save();
        res.status(200).send('Conversation created Successfully');
    } catch (error) {
        console.log(error)
    }
})

app.get('/api/conversation/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const conversations = await Conversation.find({ members: { $in: [userId] } })
        const conversationUserData = Promise.all(conversations.map(async (conversation) => {
            const receiverId = conversation.members.find((member) => member !== userId);
            const user = await Users.findById(receiverId);
            return { user: { email: user.email, fullName: user.fullName }, converesationId: conversation._id }
        }))
        res.status(200).json(await conversationUserData);
    } catch (error) {
        console.log(error);
    }
})

app.listen(port, () => {
    console.log('listening on port' + port);
})