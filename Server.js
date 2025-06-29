require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = require("firebase/auth");
const { initializeApp } = require("firebase/app");
let parser = bodyParser.urlencoded({ extended: true });

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

const firebase = initializeApp(firebaseConfig);
const auth = getAuth(firebase);

var corsOptions = {
  origin: '*'
}
let corsPolicy = cors(corsOptions);
app.use(parser);
app.use(corsPolicy);


const client = new MongoClient(url, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
}
);


// POST /createUser
app.post('/createUser', async (req, res) => {
  try {

    const { email, password, nombre, apellido } = req.body;
    if (!email || !password || !nombre || !apellido) {
      return res.status(400).json({ mensaje: 'Faltan datos requeridos' });
    }

    // usuario Firebase
    const responseFirebase = await createUserWithEmailAndPassword(auth, email, password);

    const db = client.db("Examen2UX");
    const coleccion = db.collection("Usuarios");

    const usuario = {
      email,
      firebaseUid: responseFirebase.user.uid,
      password,
      nombre,
      apellido,
      posts: []
    };

    // guardar en MongoDB
    const result = await coleccion.insertOne(usuario);
    console.log("Resultado de Mongo:", result);

    res.status(201).json({
      mensaje: 'Usuario creado exitosamente en Firebase y MongoDB',
      idUsuarioMongo: result.insertedId,
      idUsuarioFirebase: responseFirebase.user.uid,
    });
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al crear usuario',
      error: error.message
    });
  }
});


// POST /logIn
app.post('/logIn', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Faltan email o password' });
    }

    // login Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const idFirebase = userCredential.user.uid;

    const db = client.db("Examen2UX");
    const usuariosCollection = db.collection("Usuarios");
    const postsdb = db.collection("Posts");

    // buscar usuario de mongo y posts del usuario
    const usuario = await usuariosCollection.findOne({ firebaseUid: idFirebase });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado en MongoDB' });
    }
    const postsUSER = await postsdb.find({ authorId: usuario._id.toString() }).toArray();

    res.json({
      email: usuario.email,
      nombre: usuario.nombre,
      apellido: usuario.apellido,
      postsUSER
    });
  } catch (error) {
    res.status(401).json({ mensaje: 'Credenciales inválidas', error: error.message });
  }
});


// POST /logOut
app.post('/logOut', async (req, res) => {
  try {
    await signOut(auth);
    res.status(200).send({ mensaje: 'Que tengas un lindo dia, hasta luego' });
  } catch (error) {
    res.status(500).json({
      mensaje: 'Error al cerrar sesión',
      error: error.message
    });
  }
});


// POST /createPost
app.post('/createPost', async (req, res) => {
  try {
    const { title, content, authorId } = req.body;
    if (!title || !content || !authorId) {
      return res.status(400).json({ mensaje: 'Faltan datos para crear el post' });
    }

    const db = client.db("Examen2UX");
    const usuariosCollection = db.collection("Usuarios");
    const postsCollection = db.collection("Posts");

    const usuario = await usuariosCollection.findOne({ email: authorId });
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    const newPost = { title, content, authorId: usuario._id };
    const result = await postsCollection.insertOne(newPost);

    //actualizar el usuario
    await usuariosCollection.updateOne({ _id: usuario._id }, { $push: { posts: result.insertedId } });

    res.status(201).json({ mensaje: 'Post creado exitosamente', postId: result.insertedId });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al crear post', error: error.message });
  }
});

// GET /listPost
app.get('/listPost', async (req, res) => {
  try {    
    const db = client.db("Examen2UX");
    const postsCollection = db.collection("Posts");
    const posts = await postsCollection.find().toArray();
    res.json({ posts });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al listar posts', error: error.message });
  }
});

// PUT /editPost/:id
app.put('/editPost/:id', async (req, res) => {
  try {
    const { title, content, authorId } = req.body;
    const { id } = req.params;

    if (!title || !content || !authorId) {
      return res.status(400).json({ mensaje: 'Faltan datos para actualizar' });
    }

    const db = client.db("Examen2UX");
    const postsCollection = db.collection("Posts");

    const result = await postsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { title, content } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ mensaje: 'Post no encontrado' });
    }

    res.json({ mensaje: 'Post actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar post', error: error.message });
  }
});

// DELETE /deletePost/:id
app.delete('/deletePost/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const db = client.db("Examen2UX");
    const postsCollection = db.collection("Posts");
    const usuariosCollection = db.collection("Usuarios");

    const post = await postsCollection.findOne({ _id: new ObjectId(id) });
    if (!post) {
      return res.status(404).json({ mensaje: 'El post no se encontró' });
    }

    const result = await postsCollection.deleteOne({ _id: new ObjectId(id) });

    await usuariosCollection.updateOne(
      { _id: post.authorId },
      { $pull: { posts: new ObjectId(id) } }
    );

    res.json({ mensaje: 'Post eliminado exitosamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar post', error: error.message });
  }
});

//YOURE SPEEDRUNNER YOURE SPEEDRUNNER YOURE TOO SLOW YOURE TOO SLOW

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});