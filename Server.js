require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = require("firebase/auth");
const { initializeApp } = require("firebase/app");
let parser = bodyParser.urlencoded({ extended: true });

var corsOptions = {
    origin: '*'
}
let corsPolicy = cors(corsOptions);
app.use(parser);
app.use(corsPolicy);


const port = process.env.PORT;
const url = process.env.MONGO_URL;

const firebaseConfig = {
    apiKey: process.env.FB_APIKEY,
    authDomain: process.env.FB_AUTHDOMAIN,
    projectId: process.env.FB_PROJECTID,
    storageBucket: process.env.FB_STORAGEBUCKET,
    messagingSenderId: process.env.FB_MESSAGINGSENDERID,
    appId: process.env.FB_APPID,
    measurementId: process.env.FB_MEASUREMENTID
};

const client = new MongoClient(url, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
}
);

const firebase = initializeApp(firebaseConfig);
const auth = getAuth(firebase);

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});